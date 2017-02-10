var _      = require('underscore');
var async = require('async');
var millstone = require('millstone');
var StyleTrans = require('./style_trans');
var InlineRenderer = require('./renderer/inline-renderer');
var InlineTranslator = require('./translator/inline-translator');

// configure grainstore from optional args passed + defaults
var grainstore_defaults = {
    map: {
        srid: 3857
    },
    datasource: {
        type: "postgis",
        //host: "localhost", // let default be driven by env/lib
        //user: "postgres",  // let default be driven by env/lib
        geometry_field: "the_geom_webmercator",
        extent: "-20037508.3,-20037508.3,20037508.3,20037508.3",
        srid: 3857,
        max_size: 10
    }
};

var supportedDatasourceTypes = {
    geometry: {
        type: 'postgis',
        prop: 'geometry_field'
    },
    raster: {
        type: 'pgraster',
        prop: 'raster_field'
    }
};

// MML builder interface
//
// opts must have:
// `dbname`   - name of database
//
// opts may have:
// `sql`             - sql to constrain the map by (can be an array)
// `ids`             - optional array<string> of layer identifiers to override the default layer id/name: `layer{index}`
// `gcols`           - optional array of geometry column string names (defaulting to type 'geometry')
//                      or objects with {type: 'column_type', name: 'column_name'} where:
//                          - name is mandatory
//                          - type is optional, accepted values ['geometry', 'raster'] (default: 'geometry')
// `extra_ds_opts`   - optional array of extra datasource options
// `geom_type`       - [polygon|point] to specify which default style to use
// `style`           - Carto style to override the built in style store (can be an array)
// `style_version`   - Version of the carto style override (can be an array)
// `interactivity`   - Comma separated list of grid fields (can be an array)
// `layer`           - Interactivity layer index, to use with token and grids
// `dbuser`          - Database username
// `dbpassword`      - Database password
// `dbhost`          - Database host
// `dbport`          - Database port
//
// @param optional_args
//     You may pass in a third argument to override grainstore defaults.
//     `map` specifies the output map projection.
//     `datasource` specifies postgis details from Mapnik postgis plugin:
//                  https://github.com/mapnik/mapnik/wiki
//     `cachedir` is base directory to put localized external resources into
//     `carto_env` carto renderer environment options, see
//                 http://github.com/mapbox/carto/blob/v0.9.5/lib/carto/renderer.js#L71
//     `mapnik_version` is target version of mapnik, defaults to ``2.0.2``
//     `mapnik_tile_format` for the tiles, see https://github.com/mapnik/mapnik/wiki/OutputFormats
//     `default_style_version` is the default version for CartoCSS styles. Defaults to '2.0.0'
//
//     eg.
//     {
//       map: {srid: 3857},
//       datasource: {
//         type: "postgis",
//         host: "localhost",
//         user: "postgres",
//         geometry_field: "the_geom_webmercator",
//         extent: "-20037508.3,-20037508.3,20037508.3,20037508.3",
//         srid: 3857,
//         max_size: 10
//       }
//     }
//
function MMLBuilder(params, options) {
    this.renderer = options.renderer || new InlineRenderer();
    this.translator = options.translator || new InlineTranslator();

    this.params = params || {};
    // core variables
    var requiredParams = ['dbname', 'sql', 'style'];
    requiredParams.forEach(function(paramKey) {
        if (!params.hasOwnProperty(paramKey)) {
            throw new Error("Options must include '" + paramKey + "'");
        }
    });

    this.options = options || {};
    this.options.cachedir = this.options.cachedir || '/tmp/millstone';
    this.target_mapnik_version = options.mapnik_version || '2.0.2';
    this.default_style_version = options.default_style_version || '2.0.0';

    this.grainstore_datasource = _.defaults(_.clone(options.datasource || {}), grainstore_defaults.datasource);

    // Allow overriding db authentication with options
    if ( params.dbuser ) {
        this.grainstore_datasource.user = params.dbuser;
    }
    if ( params.dbpassword ) {
        this.grainstore_datasource.password = params.dbpassword;
    }
    if ( params.dbhost ) {
        this.grainstore_datasource.host = params.dbhost;
    }
    if ( params.dbport ) {
        this.grainstore_datasource.port = params.dbport;
    }

    this.grainstore_map = _.defaults(options.map || {}, grainstore_defaults.map);
    if ( options.mapnik_tile_format ) {
        this.grainstore_map.format = options.mapnik_tile_format;
    }

    this.interactivity = params.interactivity;
    if ( _.isString(this.interactivity) ) {
      this.interactivity = [ this.interactivity ];
    } else if ( this.interactivity )  {
      for (var i=0; i<this.interactivity.length; ++i) {
        if ( this.interactivity[i] && ! _.isString(this.interactivity[i]) ) {
          throw new Error("Invalid interactivity value type for layer " + i + ": " + typeof(this.interactivity[i]));
        }
      }
    }
    this.interactivity_layer = params.layer || 0;
    if (!Number.isFinite(this.interactivity_layer)) {
        throw new Error("Invalid (non-integer) layer value type: " + this.interactivity_layer);
    }

    // Millstone configuration
    //
    // Resources are shared between all maps, and ensured
    // to be localized on every call to the "toXML" method.
    //
    // Caller should take care of purging unused resources based
    // on its usage of the "toXML" method.
    this.millstoneOptions = {
        base: this.options.cachedir +  '/base',
        cache: this.options.cachedir + '/cache'
    };
}

module.exports = MMLBuilder;

MMLBuilder.prototype.set = function (property, value) {
    var isOption = this.hasOwnProperty(property) && !_.isFunction(this[property]);

    if (!isOption) {
        throw new Error('Setting "' + property + '" is not allowed');
    }

    this[property] = _.extend(this[property], value);

    return this; // allow chaining
};

MMLBuilder.prototype.toXML = function(callback) {
    var style = this.params.style;
    var style_version = this.params.style_version || this.default_style_version;

    this.render(style, style_version, callback);
};

MMLBuilder.prototype.render = function(styles, version, callback){
    var self = this;

    styles = Array.isArray(styles) ? styles : [ styles ];

    async.waterfall([
        function translateStyles(callback) {
            self.translate(styles, version, callback);
        },
        function resolveResources(translatedStyles, callback) {
            var millstoneOptions = _.defaults({}, self.millstoneOptions);

            try {
                millstoneOptions.mml = self.toMML(translatedStyles);
            } catch (err) {
                return callback(err);
            }

            millstone.resolve(millstoneOptions, callback)
        },
        function renderXML(mml, callback) {
            // NOTE: we _need_ a new object here because carto writes into it
            var carto_env = _.defaults({}, self.options.carto_env);
            var carto_options = { mapnik_version: self.target_mapnik_version };

            self.renderer.getXML(mml, carto_options, carto_env, callback);
        }
    ], callback);
};

MMLBuilder.prototype.translate = function (styles, versions, callback) {
    var self = this;
    var targetMapnikVersion = this.target_mapnik_version;
    var translatedStyles = [];

    versions = versions || this.default_style_version;

    async.eachOf(styles, function (style, index, callback) {
        var version = _.isArray(versions) ? versions[index] : versions;

        style = style.replace(/^\s+|\s+$/g, '');

        if (style.length === 0) {
            return callback(new Error('style' + index + ': CartoCSS is empty'));
        }

        self.translator.transform(style, version, targetMapnikVersion, function (err, translatedStyle) {
            if (err) {
                return callback(err);
            }

            translatedStyles[index] = translatedStyle;

            callback();
        });
    }, function (err) {
        if (err) {
            return callback(err);
        }

        callback(null, translatedStyles);
    });
};

MMLBuilder.prototype.baseMML = function() {
    var tables = Array.isArray(this.params.sql) ? this.params.sql : [ this.params.sql ];

    var mml   = {};
    mml.srs   = '+init=epsg:' + this.grainstore_map.srid;
    mml.format = this.grainstore_map.format || 'png';
    mml.Layer = [];

    for (var i=0; i<tables.length; ++i) {
        var table = tables[i];

        var datasource = _.clone(this.grainstore_datasource);
        datasource.table = table;
        datasource.dbname = this.params.dbname;
        if (!!this.params.search_path) {
            datasource.search_path = this.params.search_path;
        }

        if ( this.params.gcols && this.params.gcols[i] ) {
            if (_.isString(this.params.gcols[i])) {
                datasource.geometry_field = this.params.gcols[i];
            } else {
                var gcol = this.params.gcols[i];
                gcol.type = gcol.type || 'geometry';
                var dsOpts = supportedDatasourceTypes[gcol.type];
                if (dsOpts && gcol.name) {
                    delete datasource.geometry_field;
                    datasource.type = dsOpts.type;
                    datasource[dsOpts.prop] = gcol.name;
                } else {
                    throw new Error("Unsupported geometry column type for layer " + i + ": " + gcol.type);
                }
            }
        }

        if ( this.params.datasource_extend && this.params.datasource_extend[i] ) {
            datasource = _.extend(datasource, this.params.datasource_extend[i]);
        }

        if ( this.params.extra_ds_opts ) {
            datasource = _.defaults(datasource, this.params.extra_ds_opts[i]);
        }

        var layer = {};
        layer.id = getLayerName(this.params, i);
        layer.name       = layer.id;
        layer.srs        = '+init=epsg:' + this.grainstore_datasource.srid;
        layer.Datasource = datasource;

        mml.Layer.push(layer);

    }

    if ( this.interactivity ) {
        if ( this.interactivity[this.interactivity_layer] ) {
            if ( _.isString(this.interactivity[this.interactivity_layer]) ) {
                mml.interactivity = {
                    layer: mml.Layer[this.interactivity_layer].id,
                    fields: this.interactivity[this.interactivity_layer].split(',')
                };
            } else {
                throw new Error("Unexpected interactivity format: " + this.interactivity[this.interactivity_layer]);
            }
        }
    }

    return mml;
};

MMLBuilder.prototype.toMML = function(style_in){

    var base_mml = this.baseMML();
    base_mml.Stylesheet = [];

    var style = Array.isArray(style_in) ? style_in : [ style_in ];
    var t = new StyleTrans();

    for (var i=0; i<style.length; ++i) {
        var stylesheet  = {};
        if ( _.isArray(style_in) ) {
            stylesheet.id   = 'style' + i;
            stylesheet.data = t.setLayerName(style[i], getLayerName(this.params, i));
        } else {
            stylesheet.id   = 'style.mss';
            stylesheet.data = style[i];
        }
        base_mml.Stylesheet.push(stylesheet);
    }

    return base_mml;
};

function getLayerName(params, i) {
    var layerName = 'layer' + i;

    if ( params.ids && !!params.ids[i] ) {
        layerName = params.ids[i];
    }

    return layerName;
}
