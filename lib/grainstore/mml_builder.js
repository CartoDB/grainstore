var _      = require('underscore');
var carto  = require('carto');
var millstone = require('millstone');

var StyleTrans = require('./style_trans');

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
//     `styles` specifies the default styles
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
//       },
//       styles: {
//         point: "default point style",
//         polygon: "default polygon style",  
//       }
//     }
//
// @param init_callback
//   init_callback(err, payload) will be invoked on complete initialization
//   see me.init for more info
//
function MMLBuilder(params, options) {
//    var opts = {
//        sql: sql,
//        style: style,
//        style_version: style_version,
//        interactivity: interactivity,
//        ttl: 0,
//        datasource_extend: datasource_extend,
//        extra_ds_opts: extra_ds_opts,
//        gcols: geom_columns
//    };
    params = params || {};
    options = options || {};
    options.cachedir = options.cachedir || '/tmp/millstone';

    // core variables
    var requiredParams = ['dbname', 'sql', 'style'];
    requiredParams.forEach(function(paramKey) {
        if (!params.hasOwnProperty(paramKey)) {
            throw new Error("Options must include '" + paramKey + "'");
        }
    });

    var target_mapnik_version = options.mapnik_version || '2.0.2';
    var default_style_version = options.default_style_version || '2.0.0';

    var grainstore_map        = options.map        || {};
    // NOTE: we clone this to avoid changing default settings with an override
    var grainstore_datasource = options.datasource ? _.clone(options.datasource) : {};

    grainstore_map        = _.defaults(grainstore_map, grainstore_defaults.map);
    grainstore_datasource = _.defaults(grainstore_datasource, grainstore_defaults.datasource);

    // Allow overriding db authentication with options
    if ( params.dbuser ) {
        grainstore_datasource.user = params.dbuser;
    }
    if ( params.dbpassword ) {
        grainstore_datasource.password = params.dbpassword;
    }
    if ( params.dbhost ) {
        grainstore_datasource.host = params.dbhost;
    }
    if ( params.dbport ) {
        grainstore_datasource.port = params.dbport;
    }

    if ( options.mapnik_tile_format ) {
        grainstore_map.format = options.mapnik_tile_format;
    }

    // MML Builder definition
    var me = {};

    // render CartoCSS to Mapnik XML
    //
    // @param style the CartoCSS
    // @param version the version of the given CartoCSS
    // @param callback function(err, compiled_XML)
    //
    me.render = function(style_in, version, callback){
        style_in = Array.isArray(style_in) ? style_in : [ style_in ];

        var style = [];

        // TODO: rewrite this horrible function

        var t = new StyleTrans();

        try {
            for ( var i=0; i<style_in.length; ++i ) {
              if ( style_in[i].replace(/^\s+|\s+$/g, '').length === 0 ) {
                return callback(new Error("style"+i+": CartoCSS is empty"));
              }
              var v = _.isArray(version) ? version[i] : version;
              if ( ! v ) {
                  v = default_style_version;
              }
              style[i] = t.transform(style_in[i], v, target_mapnik_version);
            }
        } catch (err) {
            return callback(err, null);
        }

        var mml;
        try {
          mml = me.toMML(style);
        } catch (err) {
          return callback(err, null);
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
            base:  options.cachedir +  '/base',
            cache: options.cachedir + '/cache'
        };
        millstone.resolve(millstoneOptions, function renderResolvedMml(err, mml) {

          if ( err ) {
            return callback(err, null);
          }

          // NOTE: we _need_ a new object here because carto writes into it
          var carto_env = _.defaults({}, options.carto_env);
          var carto_options = { mapnik_version: target_mapnik_version };

          // carto.Renderer may throw during parse time (before nextTick is called)
          // See https://github.com/mapbox/carto/pull/187
          try {
            var r = new carto.Renderer(carto_env, carto_options);
            r.render(mml, function(err, output){
                callback(err, output);
            });
          } catch (err) {
              callback(err, null);
          }
        });
    };

    // @param callback function(err, xml)
    me.toXML = function(callback) {
        var style = params.style;
        var style_version = params.style_version || default_style_version;

        me.render(style, style_version, callback);
    };

    // Behaves differently if style_in is an array or not
    //
    // When it is an array, a string replacement happens on
    // the layer name part of the cartocss
    //
    me.toMML = function(style_in){

        var base_mml = me.baseMML();
        base_mml.Stylesheet = [];

        var style = Array.isArray(style_in) ? style_in : [ style_in ];
        var t = new StyleTrans();

        for (var i=0; i<style.length; ++i) {
          var stylesheet  = {};
          if ( _.isArray(style_in) ) {
            stylesheet.id   = 'style' + i;
            stylesheet.data = t.setLayerName(style[i], 'layer' + i); 
          } else {
            stylesheet.id   = 'style.mss';
            stylesheet.data = style[i];
          }
          base_mml.Stylesheet.push(stylesheet);
        }

        return base_mml;
    };

    // Generate base MML for this object
    me.baseMML = function() {
        var tables = Array.isArray(params.sql) ? params.sql : [ params.sql ];

        var mml   = {};
        mml.srs   = '+init=epsg:' + grainstore_map.srid; 
        mml.format = grainstore_map.format || 'png';
        mml.Layer = [];

        for (var i=0; i<tables.length; ++i) {
          var table = tables[i];

          var datasource     = _.clone(grainstore_datasource);
          datasource.table   = table;
          datasource.dbname  = params.dbname;
          if (!!params.search_path) {
              datasource.search_path = params.search_path;
          }

          if ( params.gcols && params.gcols[i] ) {
            if (_.isString(params.gcols[i])) {
                datasource.geometry_field = params.gcols[i];
            } else {
                var gcol = params.gcols[i];
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

          if ( params.datasource_extend && params.datasource_extend[i] ) {
              datasource = _.extend(datasource, params.datasource_extend[i]);
          }

          if ( params.extra_ds_opts ) {
            datasource = _.defaults(datasource, params.extra_ds_opts[i]);
          }

          var layer        = {};
          if ( tables.length === 1 && params.table ) {
            layer.id = params.table;
          } else {
            layer.id = 'layer' + i; 
          }

          layer.name       = layer.id; 
          layer.srs        = '+init=epsg:' + grainstore_datasource.srid; 
          layer.Datasource = datasource;

          mml.Layer.push(layer);

        }

        if ( interactivity ) {
          if ( interactivity[interactivity_layer] ) {
            if ( _.isString(interactivity[interactivity_layer]) ) {
              mml.interactivity = {
                layer: mml.Layer[interactivity_layer].id,
                fields: interactivity[interactivity_layer].split(',')
              };
            } else {
              throw new Error("Unexpected interactivity format: " + interactivity[interactivity_layer]);
            }
          }
        }

        return mml;
    };

    var interactivity = params.interactivity;
    if ( _.isString(interactivity) ) {
      interactivity = [ interactivity ];
    } else if ( interactivity )  {
      for (var i=0; i<interactivity.length; ++i) {
        if ( interactivity[i] && ! _.isString(interactivity[i]) ) {
          throw new Error("Invalid interactivity value type for layer " + i + ": " + typeof(interactivity[i]));
        }
      }
    }
    var interactivity_layer = params.layer || 0;
    if (!Number.isFinite(interactivity_layer)) {
        throw new Error("Invalid (non-integer) layer value type: " + interactivity_layer);
    }

    return me;
}

module.exports = MMLBuilder;
