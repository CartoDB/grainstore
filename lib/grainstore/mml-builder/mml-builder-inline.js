'use strict';

var _ = require('underscore');
var millstone = require('millstone');
var StyleTrans = require('../style_trans');
var carto = require('carto');
var debug = require('debug')('grainstore:mml-builder-inline');
var debugXml = require('debug')('grainstore:mml-builder-inline:xml');

// configure grainstore from optional args passed + defaults
var grainstoreDefaults = {
    map: {
        srid: 3857,
        'maximum-extent': '-20037508.3,-20037508.3,20037508.3,20037508.3'
    },
    datasource: {
        type: 'postgis',
        // host: "localhost", // let default be driven by env/lib
        // user: "postgres",  // let default be driven by env/lib
        geometry_field: 'the_geom_webmercator',
        extent: '-20037508.3,-20037508.3,20037508.3,20037508.3',
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
// @param params
// params must have:
// `dbname`   - name of database
//
// params may have:
// `sql`             - sql to constrain the map by (can be an array)
// `ids`             - optional array<string> of layer identifiers to override the default layer id/name: `layer{index}`
// `gcols`           - optional array of geometry column string names (defaulting to type 'geometry')
//                      or objects with {type: 'column_type', name: 'column_name'} where:
//                          - name is mandatory
//                          - type is optional, accepted values ['geometry', 'raster'] (default: 'geometry')
// `extra_ds_opts`   - optional array of extra datasource options (will only be used when missing from global datasource)
// `datasource_extend` - optional array of extra datasource options (will override the global datasource)
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
// @param options
//     You may pass in a second argument to override grainstore defaults.
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
function MMLBuilderInline (params, options) {
    this.params = params || {};
    // core variables
    var requiredParams = ['dbname', 'sql'];

    requiredParams.forEach(function (paramKey) {
        if (!Object.prototype.hasOwnProperty.call(params, paramKey)) {
            throw new Error("Options must include '" + paramKey + "'");
        }
    });

    this.options = options || {};
    this.options.cachedir = this.options.cachedir || '/tmp/millstone';
    this.target_mapnik_version = options.mapnik_version || '2.0.2';
    this.default_style_version = options.default_style_version || '2.0.0';

    this.grainstore_datasource = _.defaults(_.clone(options.datasource || {}), grainstoreDefaults.datasource);

    // Allow overriding db authentication with options
    if (params.dbuser) {
        this.grainstore_datasource.user = params.dbuser;
    }
    if (params.dbpassword) {
        this.grainstore_datasource.password = params.dbpassword;
    }
    if (params.dbhost) {
        this.grainstore_datasource.host = params.dbhost;
    }
    if (params.dbport) {
        this.grainstore_datasource.port = params.dbport;
    }

    this.grainstore_map = _.defaults(options.map || {}, grainstoreDefaults.map);
    if (options.mapnik_tile_format) {
        this.grainstore_map.format = options.mapnik_tile_format;
    }
    if (params.markers_symbolizer_caches) {
        this.grainstore_map.markers_symbolizer_caches = params.markers_symbolizer_caches;
    }

    this.interactivity = params.interactivity;
    if (_.isString(this.interactivity)) {
        this.interactivity = [this.interactivity];
    } else if (this.interactivity) {
        for (var i = 0; i < this.interactivity.length; ++i) {
            if (this.interactivity[i] && !_.isString(this.interactivity[i])) {
                throw new Error('Invalid interactivity value type for layer ' + i + ': ' + typeof (this.interactivity[i]));
            }
        }
    }
    this.interactivity_layer = params.layer || 0;
    if (!Number.isFinite(this.interactivity_layer)) {
        throw new Error('Invalid (non-integer) layer value type: ' + this.interactivity_layer);
    }
}

module.exports = MMLBuilderInline;

MMLBuilderInline.prototype.set = function (property, value) {
    var isOption = Object.prototype.hasOwnProperty.call(this, property) && !_.isFunction(this[property]);

    if (!isOption) {
        throw new Error('Setting "' + property + '" is not allowed');
    }

    this[property] = _.extend(this[property], value);

    return this; // allow chaining
};

MMLBuilderInline.prototype.toXML = function (callback) {
    var style = this.params.style;
    var styleVersion = this.params.style_version || this.default_style_version;

    this.render(style, styleVersion, callback);
};

MMLBuilderInline.prototype.render = function (styleIn, version, callback) {
    const self = this;
    let style = '';
    let mml;

    try {
        if (styleIn) {
            style = this.transformStyle(styleIn, version);
        }
        mml = this.toMML(style);
    } catch (err) {
        return callback(err);
    }

    // Millstone configuration
    //
    // Resources are shared between all maps, and ensured
    // to be localized on every call to the "toXML" method.
    //
    // Caller should take care of purging unused resources based
    // on its usage of the "toXML" method.
    //
    var millstoneOptions = {
        mml: mml,
        base: this.options.cachedir + '/base',
        cache: this.options.cachedir + '/cache'
    };

    millstone.resolve(millstoneOptions, function renderResolvedMml (err, mml) {
        if (err) {
            return callback(err, null);
        }

        // NOTE: we _need_ a new object here because carto writes into it
        var cartoEnv = _.defaults({}, self.options.carto_env);
        var cartoOptions = { mapnik_version: self.target_mapnik_version };

        // carto.Renderer may throw during parse time (before nextTick is called)
        // See https://github.com/mapbox/carto/pull/187
        try {
            var r = new carto.Renderer(cartoEnv, cartoOptions);
            debug('Renderer.render start');

            var xml = r.render(mml);
            debugXml('output', xml);

            process.nextTick(function () {
                return callback(null, xml);
            });
        } catch (err) {
            return callback(err, null);
        }
    });
};

MMLBuilderInline.prototype.transformStyle = function (styleIn, version) {
    styleIn = Array.isArray(styleIn) ? styleIn : [styleIn];

    var style = [];

    var styleTransformer = new StyleTrans();

    for (var i = 0; i < styleIn.length; ++i) {
        if (styleIn[i].replace(/^\s+|\s+$/g, '').length === 0) {
            throw new Error('style' + i + ': CartoCSS is empty');
        }

        var v = _.isArray(version) ? version[i] : version;
        if (!v) {
            v = this.default_style_version;
        }
        style[i] = styleTransformer.transform(styleIn[i], v, this.target_mapnik_version);
    }

    return style;
};

MMLBuilderInline.prototype.baseMML = function () {
    var tables = Array.isArray(this.params.sql) ? this.params.sql : [this.params.sql];

    var mml = {};
    mml.srs = '+init=epsg:' + this.grainstore_map.srid;
    mml['maximum-extent'] = this.grainstore_map['maximum-extent'];
    mml.format = this.grainstore_map.format || 'png';
    mml.Layer = [];
    if (this.grainstore_map.markers_symbolizer_caches) {
        mml.markers_symbolizer_caches_disabled = this.grainstore_map.markers_symbolizer_caches.disabled.toString();
    }

    for (var i = 0; i < tables.length; ++i) {
        var table = tables[i];

        var datasource = _.clone(this.grainstore_datasource);
        datasource.table = table;
        datasource.dbname = this.params.dbname;
        if (this.params.search_path) {
            datasource.search_path = this.params.search_path;
        }

        if (this.params.gcols && this.params.gcols[i]) {
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
                    throw new Error('Unsupported geometry column type for layer ' + i + ': ' + gcol.type);
                }
            }
        }

        if (this.params.datasource_extend && this.params.datasource_extend[i]) {
            datasource = _.extend(datasource, this.params.datasource_extend[i]);
        }

        if (this.params.extra_ds_opts) {
            datasource = _.defaults(datasource, this.params.extra_ds_opts[i]);
        }

        var layer = {};
        layer.id = getLayerName(this.params, i);
        layer.name = layer.id;
        layer.srs = '+init=epsg:' + datasource.srid;
        layer.properties = getLayerProperties(this.params, i);
        layer.Datasource = datasource;

        mml.Layer.push(layer);
    }

    if (this.interactivity) {
        if (this.interactivity[this.interactivity_layer]) {
            if (_.isString(this.interactivity[this.interactivity_layer])) {
                mml.interactivity = {
                    layer: mml.Layer[this.interactivity_layer].id,
                    fields: this.interactivity[this.interactivity_layer].split(',')
                };
            } else {
                throw new Error('Unexpected interactivity format: ' + this.interactivity[this.interactivity_layer]);
            }
        }
    }

    return mml;
};

MMLBuilderInline.prototype.toMML = function (styleIn) {
    var baseMML = this.baseMML();
    baseMML.Stylesheet = [];

    var style = Array.isArray(styleIn) ? styleIn : [styleIn];
    var t = new StyleTrans();

    for (var i = 0; i < style.length; ++i) {
        var stylesheet = {};
        if (_.isArray(styleIn)) {
            stylesheet.id = 'style' + i;
            stylesheet.data = t.setLayerName(style[i], getLayerName(this.params, i));
        } else {
            stylesheet.id = 'style.mss';
            stylesheet.data = style[i];
        }
        baseMML.Stylesheet.push(stylesheet);
    }

    return baseMML;
};

function getLayerName (params, i) {
    var layerName = 'layer' + i;

    if (params.ids && !!params.ids[i]) {
        layerName = params.ids[i];
    }

    return layerName;
}

var ZOOM_PROPS = ['minzoom', 'maxzoom'];
const SUPPORTED_PROPS = {
    // minzoom and maxzoom are included in zoom
    'minimum-scale-denominator': true, /* double */
    'maximum-scale-denominator': true, /* double */
    queryable: true, /* boolean */
    'clear-label-cache"': true, /* boolean */
    'cache-features': true, /* boolean */
    'group-by"': true, /* string */
    'buffer-size': true, /* int */
    'maximum-extent': true /* string */
};
function getLayerProperties (params, i) {
    var properties = {};

    var zooms = params.zooms || [];
    var zoom = zooms[i] || {};
    ZOOM_PROPS.forEach(function (prop) {
        if (Object.prototype.hasOwnProperty.call(zoom, prop) && Number.isFinite(zoom[prop])) {
            properties[prop] = zoom[prop];
        }
    });

    Object.keys(params).forEach(function (key, index) {
        if (Object.prototype.hasOwnProperty.call(SUPPORTED_PROPS, key)) {
            if (Array.isArray(params[key])) {
                properties[key] = params[key][i];
            } else {
                properties[key] = params[key];
            }
        }
    });

    return properties;
}
