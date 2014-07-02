var _      = require('underscore'),
    crypto = require('crypto'),
    Step   = require('step'),
    carto  = require('carto'),
    millstone = require('millstone'),
    fs     = require('fs'),
    StyleTrans = require('./style_trans'),
    semver = require('semver')
;

// MML builder interface
//
// `redis` should be an instance of RedisPool
//
// opts must have:
// `dbname`   - name of database
// 
// opts may have:
// `table`           - name of table with geospatial data
// `sql`             - sql to constrain the map by (can be an array)
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
var MMLBuilder = function(redis_pool, opts, optional_args, init_callback){

    // core variables
    if (!opts || !opts.hasOwnProperty('dbname'))
        throw new Error("Options must include dbname");
    if (!opts.hasOwnProperty('table') && !opts.hasOwnProperty('sql'))
        throw new Error("Options must either include 'table' or 'sql'");
    var geom_type      = opts.geom_type || 'point';   // geom type for default styling

    var extra_config          = optional_args           || {};

    var target_mapnik_version = extra_config.mapnik_version || '2.0.2';
    var default_style_version = extra_config.default_style_version || '2.0.0';

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
        },
        styles: {
            db: 0  // redis database to store styles
        }
    };

    if ( semver.satisfies(target_mapnik_version, '< 2.1.0') )
    {
      var def_style_point = " {marker-fill: #FF6600;marker-opacity: 1;marker-width: 8;marker-line-color: white;marker-line-width: 3;marker-line-opacity: 0.9;marker-placement: point;marker-type: ellipse;marker-allow-overlap: true;}";
      var def_style_line = " {line-color:#FF6600; line-width:1; line-opacity: 0.7;}";
      var def_style_poly = " {polygon-fill:#FF6600; polygon-opacity: 0.7; line-opacity:1; line-color: #FFFFFF;}";
      grainstore_defaults.styles.point = '#' + opts.table + def_style_point;
      grainstore_defaults.styles.polygon = '#' + opts.table + def_style_poly;
      grainstore_defaults.styles.multipolygon = grainstore_defaults.styles.polygon;
      grainstore_defaults.styles.multilinestring = '#' + opts.table + def_style_line;
      grainstore_defaults.styles.version = '2.0.0';
    }
    else if ( semver.satisfies(target_mapnik_version, '< 2.2.0') )
    {
      var def_style_point = " {marker-fill: #FF6600;marker-opacity: 1;marker-width: 16;marker-line-color: white;marker-line-width: 3;marker-line-opacity: 0.9;marker-placement: point;marker-type: ellipse;marker-allow-overlap: true;}";
      var def_style_line = " {line-color:#FF6600; line-width:1; line-opacity: 0.7;}";
      var def_style_poly = " {polygon-fill:#FF6600; polygon-opacity: 0.7; line-opacity:1; line-color: #FFFFFF;}";

      grainstore_defaults.styles.point = 
        grainstore_defaults.styles.polygon = 
        grainstore_defaults.styles.multipolygon = 
        grainstore_defaults.styles.multilinestring = 
        grainstore_defaults.styles.geometry = 
        '#' + opts.table + '[mapnik-geometry-type=1]' + def_style_point +
        '#' + opts.table + '[mapnik-geometry-type=2]' + def_style_line +
        '#' + opts.table + '[mapnik-geometry-type=3]' + def_style_poly
      ;
      grainstore_defaults.styles.version = '2.1.0';
    }
    else
    {
      var def_style_point = " {marker-fill: #FF6600;marker-opacity: 1;marker-width: 16;marker-line-color: white;marker-line-width: 3;marker-line-opacity: 0.9;marker-placement: point;marker-type: ellipse;marker-allow-overlap: true;}";
      var def_style_line = " {line-color:#FF6600; line-width:1; line-opacity: 0.7;}";
      var def_style_poly = " {polygon-fill:#FF6600; polygon-opacity: 0.7; line-opacity:1; line-color: #FFFFFF;}";

      grainstore_defaults.styles.point = 
        grainstore_defaults.styles.polygon = 
        grainstore_defaults.styles.multipolygon = 
        grainstore_defaults.styles.multilinestring = 
        grainstore_defaults.styles.geometry = 
        '#' + opts.table + '["mapnik::geometry_type"=1]' + def_style_point +
        '#' + opts.table + '["mapnik::geometry_type"=2]' + def_style_line +
        '#' + opts.table + '["mapnik::geometry_type"=3]' + def_style_poly
      ;
      grainstore_defaults.styles.version = target_mapnik_version;
    }

    var grainstore_map        = extra_config.map        || {};
    // NOTE: we clone this to avoid changing default settings with an override
    var grainstore_datasource = extra_config.datasource ? _.clone(extra_config.datasource) : {};
    var grainstore_styles     = extra_config.styles     || {};

    grainstore_map        = _.defaults(grainstore_map, grainstore_defaults.map);
    grainstore_datasource = _.defaults(grainstore_datasource, grainstore_defaults.datasource);
    grainstore_styles     = _.defaults(grainstore_styles, grainstore_defaults.styles);

    // Allow overriding db authentication with options
    if ( opts.dbuser ) grainstore_datasource.user = opts.dbuser;
    if ( opts.dbpassword ) grainstore_datasource.password = opts.dbpassword;
    if ( opts.dbhost ) grainstore_datasource.host = opts.dbhost;
    if ( opts.dbport ) grainstore_datasource.port = opts.dbport;

    // MML Builder definition
    var me = {
      knownByRedis: false
    };

    // Initialize the MMLBuilder 
    //
    // @param callback(err, style_payload) gets called with the string version
    //        of the style payload, which can be parsed by JSON.parse
    //
    // @param allow_broken_css if set to true prevents callback from being
    //        called with an Error when css cannot be rendered to XML.
    //        An error is still logged in that case
    //
    me.init = function(callback, allow_broken_css){
        var that = this;
        var store_key = extended_store_key || base_store_key;
        var redis_client;
        var style;
        var style_version;

        Step(
            function getRedisClient(){
                redis_pool.acquire(grainstore_styles.db, this);
            },
            function getStyle(err, data){
                if (err) throw err;
                redis_client = data;
                redis_client.GET(store_key, this);
            },
            function initCheck(err, data){
                if (err) throw err;

                do { 

                  if (_.isNull(data)) {
                    // no redis record
                    break;
                  }

                  var record = JSON.parse(data);

                  // save pre-recorded interactivity and sql
                  if ( record.interactivity ) interactivity = record.interactivity;
                  if ( record.sql ) opts.sql = record.sql;

                  // All checks passed, nothing more to do here
                  if (!_.isUndefined(redis_client))
                      redis_pool.release(grainstore_styles.db, redis_client);
                  me.knownByRedis = true;
                  callback(null, data);
                  return;

                } while (0);

                // XML needs to be re-generated, go on
                if ( !_.isNull(style_override) ) return null;

                redis_client.GET(base_store_key, this);
            },
            function renderBaseStyleOrDefaultOrOverride(err, data){
                if (err) throw err;
                if ( ! _.isNull(data)){
                    var parsed = JSON.parse(data);
                    style = parsed.style;
                    style_version = parsed.version || default_style_version;
                    //interactivity = parsed.interactivity;
                } else if ( ! _.isNull(style_override) ) {
                    style = style_override;
                    style_version = style_version_override || default_style_version;
                } else {
                    if ( ! grainstore_styles.hasOwnProperty(geom_type) ) {
                      throw new Error("No style available for geometry of type '" + geom_type + "'"); 
                    }
                    style = grainstore_styles[geom_type];
                    style_version = grainstore_styles['version'];
                }
                var next = this;

                // We only render in order to check the XML
                if ( allow_broken_css ) return null;

                that.render(style, function(err, compiled_XML) {
                  if ( err ) {
                    if ( allow_broken_css ) {
                      console.log("Invalid style: " + style + " -- " + err);
                      err = compiled_XML = null;
                    }
                  } 
                  next(err);
                }, style_version);
            },
            function setStore(err){
                if (err) throw err;

                if ( store_key == base_store_key ) {
                  if ( ! opts.table ) return null;
                  var tostore = {};
                  tostore.sql = opts.sql;
                  tostore.style = style;
                  tostore.version = style_version;
                  tostore.interactivity = interactivity;
                  redis_client.SET(store_key, JSON.stringify(tostore), this);
                }
                else if ( _.isNull(style_override) ) { 
                  var tostore = {style: style, version: style_version};
                  var payload = JSON.stringify(tostore);
                  redis_client.SET(base_store_key, payload, this);
                }
                else return null;
            },
            function callbackExit(err){
                if (!_.isUndefined(redis_client))
                    redis_pool.release(grainstore_styles.db, redis_client);
                callback(err, JSON.stringify({style: style, version: style_version}));
            }
        );
    };


    // render CartoCSS to Mapnik XML
    //
    // @param style the CartoCSS
    // @param version the version of the given CartoCSS
    // @param callback function(err, compiled_XML) 
    // 
    me.render = function(style_in, callback, version){

        var style;

        // TODO: rewrite this horrible function

        try {
          var t;
          if ( _.isArray(style_in) ) {
            style = [];
            for ( var i=0; i<style_in.length; ++i ) {
              if ( style_in[i].replace(/^\s+|\s+$/g, '').length === 0 ) {
                callback(new Error("style"+i+": CartoCSS is empty"));
                return;
              }
              var v = _.isArray(version) ? version[i] : version;
              if ( ! v ) v = default_style_version;
              if ( ! t ) t = new StyleTrans();
              style[i] = t.transform(style_in[i], v, target_mapnik_version);
            }
          } else {
            if ( style_in.replace(/^\s+|\s+$/g, '').length === 0 ) {
              callback(new Error("CartoCSS is empty"));
              return;
            }
            if ( ! version ) version = default_style_version;
            if ( ! t ) t = new StyleTrans();
            style = t.transform(style_in, version, target_mapnik_version);
          }
        } catch (err) {
          callback(err, null);
          return;
        }

        var mml;
        try { 
          mml = this.toMML(style);
        }
        catch (err) {
          callback(err, null);
          return;
        }

        var millstone_options = _.extend({mml:mml}, millstone_base_options);
        millstone.resolve(millstone_options, function(err, mml) {

          if ( err ) {
            callback(err, null);
            return;
          }

          // NOTE: we _need_ a new object here because carto writes into it
          var carto_env = {};
          if ( extra_config.carto_env ) _.defaults(carto_env, extra_config.carto_env);
          var carto_options = { mapnik_version: target_mapnik_version };

          // carto.Renderer may throw during parse time (before nextTick is called)
          // See https://github.com/mapbox/carto/pull/187
          try { 
            var r = new carto.Renderer(carto_env, carto_options);
            r.render(mml, function(err, output){
                callback(err, output);
            });
          } catch (err) { callback(err, null); }

        });
    };

    // Re-generate Mapnik XML from current MML.
    me.resetStyle = function(callback, convert){
      var that = this;
      that.getStyle(function(err, style) {
        return that.setStyle(style.style, callback, style.version, convert);
      });
    };

    // Change style associated with table
    //
    // Store passed style in redis.
    // Pass back any cartocss compile errors (compiles for testing)
    //
    // deletes all associated extended_store_keys as they
    //
    me.setStyle = function(style, callback, version, convert){
        var that = this
            , redis_client
            , compiled_XML;

        if ( opts.token ) throw new Error("multilayer map configuration is immutable");

        if ( ! version ) version = default_style_version;

        if ( convert ) {
          try {
            var t = new StyleTrans();
            style = t.transform(style, version, target_mapnik_version);
            version = target_mapnik_version;
          }
          catch (err) {
            callback(err, null);
            return;
          }
        }

        Step(
            function renderMapnikStylesheet(){
                that.render(style, this, version);
            },
            function getRedisClient(err, data){
                if (err) throw err;
                compiled_XML = data;
                redis_pool.acquire(grainstore_styles.db, this);
            },
            function storeStyle(err, data){
                if (err) throw err;
                redis_client = data;
                if ( _.isNull(style_override) )  {
                  redis_client.SET(base_store_key, JSON.stringify({
                    style: style,
                    version: version
                  }), this);
                } else {
                  // Don't bother setting anything in redis as redis keys
                  // are going to be killed anyway, but tweak the
                  // extended_store_key anyway so next call to toXML
                  // won't recreate the old key
                  style_override = style;
                  style_version_override = version;
                  that.makeRedisKeys();
                  return null;
                }
            },
            function callbackExit(err, data){
                if (!_.isUndefined(redis_client))
                    redis_pool.release(grainstore_styles.db, redis_client);
                callback(err, data);
            }
        );
    };

    // Delete style caches from redis
    me.delStyle = function(callback){
        var that = this
            , redis_client;

        Step(
            function getRedisClient(){
                redis_pool.acquire(grainstore_styles.db, this);
            },
            function DelStyleAndXML(err, data){
                if (err) throw err;
                redis_client = data;
                redis_client.DEL(base_store_key, this);
            },
            function callbackExit(err, data){
                if (!_.isUndefined(redis_client))
                    redis_pool.release(grainstore_styles.db, redis_client);
                callback(err, data);
            }
        );
    };

    // Read json from given redis key
    //
    /// @param key redis key
    ///
    /// @param callback function(err, {style:xx, version:yy})
    ///
    me.readRedis = function(key, callback) {
      var redis_client;
      Step(
        function getRedisClient(){
          redis_pool.acquire(grainstore_styles.db, this);
        },
        function getData(err, data){
          if (err) throw err;
          redis_client = data;
          redis_client.GET(key, this);
        },
        function parseData(err, data){
          if (err) throw err;
          return JSON.parse(data);
        },
        function finish(err, data) {
          if (!_.isUndefined(redis_client))
            redis_pool.release(grainstore_styles.db, redis_client);
          callback(err, data);
        }
      );
    }

    // @param callback function(err, payload)
    //                 The payload is an object containing
    //                 "style" (CartoCSS) and "version" members
    //
    // @param convert if true it will return the style in the configured
    //                target mapnik version
    me.getStyle = function(callback, convert){
        var that = this;
        var redis_client;

        var store_key = base_store_key;

        Step(
            function readStyleIfNeeded(){
                if ( style_override ) {
                  return {
                    style: style_override,
                    version: style_version_override || default_style_version
                  }
                }
                that.readRedis(store_key, this); 
            },
            function convertIfNeeded(err, parsed){
                if ( err ) throw err;
                if ( _.isNull(parsed) ) {
                  // If key is not found we assign a default style
                  // TODO: should this be done elsewhere ?
                  //       it is duplicated in init()
                  parsed = {
                    style: grainstore_styles[geom_type],
                    style_version: grainstore_styles['version']
                  }
                }
                if ( convert ) {
                  var t = new StyleTrans();
                  parsed.style = t.transform(parsed.style, parsed.version, target_mapnik_version);
                  parsed.version = target_mapnik_version;
                }
                return parsed;
            },
            function callbackExit(err, parsed){
                callback(err, parsed);
            }
        );
    };

    // API: string getToken()
    //
    // Returns a token that can be used to reference this style until
    // it expires. Only available in MMLBuilder objects constructed
    // with a token or without table (but with 'style' and 'sql' arrays).
    //
    me.getToken = function() {
      return token;
    };

    // @param callback function(err, xml)
    me.toXML = function(callback){
      var that = this;
      this.getStyle(function(err, payload) {
        if ( err ) {
          callback(err);
          return;
        }
        that.render(payload.style, callback, payload.version);
      });
    };

    // Behaves differently if style_in is an array or not
    //
    // When it is an array, a string replacement happens on
    // the layer name part of the cartocss
    //
    me.toMML = function(style_in){

        var base_mml = this.baseMML();
        base_mml.Stylesheet = [];

        var style = _.isArray(style_in) ? style_in : [ style_in ];
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
    // opts:
    // `use_sql` - {Boolean} if true, use sql settings in MML, else use table
    me.baseMML = function(args){
        args = args || {};
        args = _.defaults(args, {use_sql: true});

        var tables;
        if ( args.use_sql && opts.sql ) {
          tables = _.isArray(opts.sql) ? opts.sql : [ opts.sql ];
        }
        else if ( opts.table ) {
          tables = [ opts.table ];
        }
        else {
          throw new Error("No table given and sql disabled");
        }

        var mml   = {};
        mml.srs   = '+init=epsg:' + grainstore_map.srid; 
        mml.Layer = [];

        for (var i=0; i<tables.length; ++i) {
          var table = tables[i];

          var datasource     = _.clone(grainstore_datasource);
          datasource.table   = table;
          datasource.dbname  = opts.dbname;
          if (!!opts.search_path) {
              datasource.search_path = opts.search_path;
          }


          var layer        = {};
          if ( tables.length == 1 && opts.table ) {
            layer.id = opts.table;
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
        };

        return mml;
    };

    // Bases token key on:
    //   opts.sql
    //   style_override
    //   style_version_override
    //  
    me.makeToken = function() {
      if ( ! opts.sql && ! style_override && ! interactivity ) return; // no token
      var md5 = crypto.createHash('md5');
      var i;
      if ( opts.sql ) {
        var layers = _.isArray(opts.sql) ? opts.sql : [ opts.sql ];
        for (i=0; i<layers.length; ++i) md5.update(layers[i]);
      }
      if ( style_override ) {
        var styles = _.isArray(style_override) ? style_override : [ style_override ];
        for (i=0; i<styles.length; ++i) {
          md5.update(styles[i]);
        }
        var style_versions = _.isArray(style_version_override) ? style_version_override : [ style_version_override ];
        for (i=0; i<style_versions.length; ++i) {
          md5.update(style_versions[i]);
        }
      }
      if ( interactivity ) {
        md5.update(interactivity.join(':'));
      }
      return md5.digest('hex');
    }

    me.makeRedisKeys = function() {
      token = opts.token ? opts.token : me.makeToken();
      extended_store_key = undefined;
      if ( ! opts.table ) { 
        // This is a fully indipendent layer group,
        // there's no concept of "extended"
        base_store_key = 'map_style|' + opts.dbname + '|~' + token;
      } else {
        // This is a style bound to a table 
        base_store_key = 'map_style|' + opts.dbname + '|' + opts.table;
        if ( token ) extended_store_key = base_store_key + '|' + token;
      }
    }

    var style_override = opts.style ? opts.style : null;
    var style_version_override = opts.style_version ? opts.style_version : default_style_version;
    var interactivity = opts.interactivity;
    if ( _.isString(interactivity) ) {
      interactivity = [ interactivity ];
    } else if ( interactivity )  {
      for (var i=0; i<interactivity.length; ++i) {
        if ( interactivity[i] && ! _.isString(interactivity[i]) ) {
          init_callback(new Error("Invalid interactivity value type for layer " + i + ": " + typeof(interactivity[i])));
          return;
        }
      }
    }
    var interactivity_layer = opts.layer || 0;
    if ( parseInt(interactivity_layer) != interactivity_layer ) {
      init_callback(new Error("Invalid (non-integer) layer value type: " + interactivity_layer));
      return;
    }

    // Redis storage keys
    var token, base_store_key, extended_store_key;
    me.makeRedisKeys();

    // Millstone configuration
    //
    // Resources are shared between all maps, and ensured
    // to be localized on every call to the "toXML" method.
    //
    // Caller should take care of purging unused resources based
    // on its usage of the "toXML" method.
    //
    var millstone_cachedir = extra_config.cachedir;
    var millstone_base_options = {
        base:  millstone_cachedir +  '/base',
        cache: millstone_cachedir + '/cache'
    };

    // only allow broken css when no overridden style
    // was passed
    var allow_broken_css = style_override ? false : true;

    //trigger constructor
    me.init(init_callback, allow_broken_css);

    return me;
};

module.exports = MMLBuilder;
