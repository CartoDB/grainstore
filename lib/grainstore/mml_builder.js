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
// `dbname`    - name of database
// `table` - name of table with geospatial data
// 
// opts may have:
// `sql`             - sql to constrain the map by (can be an array)
// `geom_type`       - [polygon|point] to specify which default style to use
// `style`           - Carto style to override the built in style store (can be an array)
// `style_version`   - Version of the carto style override (can be an array)
// `mapnik_version`  - Target version of mapnik, defaults to ``latest``
// `token`           - Token of a pre-existing style
// `ttl`             - Time to live for the redis key, in seconds
//
// @param optional_args
//     You may pass in a third argument to override grainstore defaults. 
//     `map` specifies the output map projection.
//     `datasource` specifies postgis details from Mapnik postgis plugin:
//                  https://github.com/mapnik/mapnik/wiki 
//     `styles` specifies the default styles
//     `cachedir` is base directory to put localized external resources into
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
    if (!opts.hasOwnProperty('table') && !opts.hasOwnProperty('sql') && !opts.hasOwnProperty('token'))
        throw new Error("Options must either include 'table', 'sql' or 'token' parameters");
    var geom_type      = opts.geom_type || 'point';   // geom type for default styling

    var default_ttl = 300; // 5 minutes by default;
    var max_ttl = 7200; // 2 hours at most
    var now = Date.now();
    var ttl = opts.ttl;
    if ( ttl && ttl > max_ttl ) ttl = max_ttl;

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
            host: "localhost",
            user: "postgres",
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
        '#' + opts.table + '[mapnik-geometry-type=1]' + def_style_point +
        '#' + opts.table + '[mapnik-geometry-type=2]' + def_style_line +
        '#' + opts.table + '[mapnik-geometry-type=3]' + def_style_poly
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

    // MML Builder definition
    var me = {};

    // setup XML for this object in Redis. Either from base, or from defaults.
    //
    // @param callback(err, style_payload) gets called with the string version
    //        of the style payload, which can be parsed by JSON.parse
    //
    me.init = function(callback){
        var that = this;
        var store_key = extended_store_key || base_store_key;
        var redis_client;
        var style;
        var style_version;
        var xml;
        var xml_version;
        var style_only_in_base = ( store_key != base_store_key && _.isNull(style_override) );

        Step(
            function getRedisClient(){
                redis_pool.acquire(grainstore_styles.db, this);
            },
            function getStyleAndXML(err, data){
                if (err) throw err;
                redis_client = data;
                redis_client.GET(store_key, this);
            },
            function initCheck(err, data){
                if (err) throw err;

                do { 

                  if (_.isNull(data)) {
                    // no redis record
                    if ( opts.token ) {
                      // this is unexpected as a token was requested
                      throw new Error("Map style token '" + token + "' not found in redis");
                    }
                    break;
                  }

                  var record = JSON.parse(data);

                  // Set ttl to the max between old and new ttl
                  // this is to reduce accidental expirations
                  if ( record.ttl ) {
                    if ( ! ttl || record.ttl > ttl ) ttl = record.ttl;
                  }

                  if ( ! record.xml ) break; // no XML in record

                  if ( ! record.xml_version ) break; // no xml_version in record

                  // XML target mapnik version mismatch
                  if ( record.xml_version != target_mapnik_version ) break;

                  // Need to refresh expiration (but not on simple access)
                  if ( ! opts.table && ! opts.token ) break;

                  // All checks passed, nothing more to do here
                  if (!_.isUndefined(redis_client))
                      redis_pool.release(grainstore_styles.db, redis_client);
                  callback(err, data);
                  return;

                } while (0);

                // XML needs to be re-generated, go on
                if ( !_.isNull(style_override) ) return null;

                // Keep an eye on base_store_key so that if anyone
                // changes the base style we don't override the
                // rendered ones.
                // See https://github.com/Vizzuality/grainstore/issues/27
                redis_client.WATCH(base_store_key);
                redis_client.GET(base_store_key, this);
            },
            function renderBaseStyleOrDefaultOrOverride(err, data){
                if (err) throw err;
                if ( ! _.isNull(data)){
                    var parsed = JSON.parse(data);
                    style = parsed.style;
                    style_version = parsed.version || default_style_version;
                } else if ( ! _.isNull(style_override) ) {
                    style = style_override;
                    style_version = style_version_override;
                } else {
                    if ( ! grainstore_styles.hasOwnProperty(geom_type) ) {
                      throw new Error("No style available for geometry of type '" + geom_type + "'"); 
                    }
                    style = grainstore_styles[geom_type];
                    style_version = grainstore_styles['version'];
                }
                that.render(style, this, style_version);
            },
            function setStore(err, compiled_XML){
                if (err) throw err;
                xml = compiled_XML;
                var tostore = {xml: compiled_XML, xml_version: target_mapnik_version };
                if ( store_key == base_store_key ) {
                  tostore.style = style;
                  tostore.version = style_version;
                  if ( ! opts.table ) {
                    ttl = ttl || default_ttl;
                    tostore.ttl = ttl;
                    tostore.accessed_at = now;
                  }
                }
                var payload = JSON.stringify(tostore);

                var redis_transaction = redis_client.MULTI();

                redis_transaction.SET(store_key, payload);

                if ( style_only_in_base ) { 
                  var tostore = {style: style, version: style_version};
                  var payload = JSON.stringify(tostore);
                  redis_transaction.SET(base_store_key, payload);
                }

                // This transaction will have NO effect IFF
                // the value of base_store_key changed since we
                // looked at it. See WATCH above.
                redis_transaction.EXEC(this);
            },
            function callbackExit(err, data){
                // NOTE: data will be an array of responses
                //       from each of the commands sent in
                //       the transaction above.
                if (!_.isUndefined(redis_client))
                    redis_pool.release(grainstore_styles.db, redis_client);
                callback(err, JSON.stringify({style: style, xml: xml}));
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
              var v = _.isArray(version) ? version[i] : version;
              if ( ! v ) v = default_style_version;
              if ( v != target_mapnik_version ) {
                if ( ! t ) t = new StyleTrans();
                style[i] = t.transform(style_in[i], v, target_mapnik_version);
              } else {
                style[i] = style_in[i];
              }
            }
          } else {
            if ( ! version ) version = default_style_version;
            if ( version != target_mapnik_version ) {
              if ( ! t ) t = new StyleTrans();
              style = t.transform(style_in, version, target_mapnik_version);
            } else style = style_in;
          }
        } catch (err) {
          callback(err, null);
          return;
        }

        var mml = this.toMML(style);

        var millstone_options = _.extend({mml:mml}, millstone_base_options);
        millstone.resolve(millstone_options, function(err, mml) {

          if ( err ) {
            callback(err, null);
            return;
          }

          var carto_env = {};
          var carto_options = { mapnik_version: target_mapnik_version };

          // carto.Renderer may throw during parse time (before nextTick is called)
          // See https://github.com/mapbox/carto/pull/187
          try { 
          new carto.Renderer(carto_env, carto_options).render(mml, function(err, output){
              callback(err, output);
          });
          } catch (err) { callback(err, null); }

        });
    };


    // Purge cache of localized resources for this store
    me.purgeLocalizedResourceCache = function(callback)
    {
      // TODO: check if "base" should also be cleared
      var toclear = millstone_cachedir + '/cache';
      fs.readdir(toclear, function(err, files) {
        if ( err ) {
          if ( err.code != 'ENOENT' ) callback(err)
          else callback(null); // nothing to clear
        }
        else {
          var left = files.length;
          if ( ! left ) callback(null);
          _.each(files, function(name) {
            var file = toclear + '/' + name;
            //console.log("Unlinking " + file);
            fs.unlink(file, function(err) {
              if (err) console.log("Error unlinking " + file + ": " + err);
              if ( ! --left ) callback(null);
            });
          });
        }
      });
    };

    // Re-generate Mapnik XML from current MML.
    me.resetStyle = function(callback, convert){
      var that = this;
      that.getStyle(function(err, style) {
        return that.setStyle(style.style, callback, style.version, convert);
      });
    };

    // Update the "accessed_at" member of a multilayer map configuration
    me.touch = function(callback){
      if ( ! opts.token ) throw new Error("Only multilayer map configuration can be touched ");
      var store_key = base_store_key;
      var redis_client;
      Step(
        function getRedisClient() {
            redis_pool.acquire(grainstore_styles.db, this);
        },
        function getRecord(err, data){
            if (err) throw err;
            redis_client = data;
            redis_client.GET(store_key, this);
        },
        function updateAccessedAt(err, data){
            if (err) throw err;
            var record = JSON.parse(data);
            record.accessed_at = Date.now();
            var tostore = JSON.stringify(record);
            redis_client.SET(store_key, tostore, this);
        },
        function callbackExit(err){
            if (!_.isUndefined(redis_client))
                redis_pool.release(grainstore_styles.db, redis_client);
            callback(err);
        }
      );
    };

    // Generate Mapnik XML from MML.
    // store passed style and generated XML
    // Pass back any cartocss compile errors
    //
    // generates XML and stores it on base key
    // deletes all associated extended_store_keys as they
    // need to be regenerated
    me.setStyle = function(style, callback, version, convert){
        var that = this
            , redis_client
            , compiled_XML;

        if ( opts.token ) throw new Error("multilayer map configuration is immutable");

        if ( ! version ) version = default_style_version;

        if ( convert && version != target_mapnik_version ) {
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
            // Purge millstone cache before refilling it
            function purgeCache(){
                that.purgeLocalizedResourceCache(this);
            },
            function renderMapnikStylesheet(err){
                if (err) throw err;
                that.render(style, this, version);
            },
            function getRedisClient(err, data){
                if (err) throw err;
                compiled_XML = data;
                redis_pool.acquire(grainstore_styles.db, this);
            },
            function storeStyleAndXML(err, data){
                if (err) throw err;
                redis_client = data;
                if ( _.isNull(style_override) )  {
                  redis_client.SET(base_store_key, JSON.stringify({
                    style: style,
                    version: version,
                    xml: compiled_XML,
                    xml_version: target_mapnik_version}), this);
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
            function getRelatedKeys(err, data){
                if (err) throw err;
                redis_client.KEYS(base_store_key + '|*', this);
            },
            function deleteRelatedKeys(err, data){
                if (err) throw err;
                if (_.isEmpty(data)) {
                    return null;
                } else {
                    redis_client.DEL(data, this);
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
    // NOTE: deletes both _base_ and _related_ keys
    me.delStyle = function(callback){
        var that = this
            , redis_client;

        Step(
            // Purge millstone cache before refilling it
            function purgeCache(){
                that.purgeLocalizedResourceCache(this);
            },
            function getRedisClient(err){
                if (err) throw err;
                redis_pool.acquire(grainstore_styles.db, this);
            },
            function DelStyleAndXML(err, data){
                if (err) throw err;
                redis_client = data;
                redis_client.DEL(base_store_key, this);
            },
            function getRelatedKeys(err, data){
                if (err) throw err;
                redis_client.KEYS(base_store_key + '|*', this);
            },
            function deleteRelatedKeys(err, data){
                if (err) throw err;
                if (_.isEmpty(data)) {
                    return null;
                } else {
                    redis_client.DEL(data, this);
                }
            },
            function callbackExit(err, data){
                if (!_.isUndefined(redis_client))
                    redis_pool.release(grainstore_styles.db, redis_client);
                callback(err, data);
            }
        );
    };

    // @param callback function(err, payload)
    //                 The payload is an object containing
    //                 "style" (CartoCSS) and "version" members
    //
    // @param convert if true it will return the style in the configured
    //                target mapnik version
    me.getStyle = function(callback, convert){
        var that = this;
        var redis_client;

        Step(
            function initStyle(){
                that.init(this);
            },
            function getRedisClient(err, data){
                if (err) throw err;
                redis_pool.acquire(grainstore_styles.db, this);
            },
            function getStyleAndXML(err, data){
                if (err) throw err;
                redis_client = data;
                redis_client.GET(base_store_key, this);
            },
            function callbackExit(err, data){
                if (!_.isUndefined(redis_client))
                    redis_pool.release(grainstore_styles.db, redis_client);
                if ( err ) { callback(err, null); return; }
                var parsed = JSON.parse(data);
                if ( convert && parsed.version != target_mapnik_version ) {
                  var t = new StyleTrans();
                  parsed.style = t.transform(parsed.style, parsed.version, target_mapnik_version);
                  parsed.version = target_mapnik_version;
                }
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

    me.toXML = function(callback){
        this.init(function(err, data) {
            if (err) {
                callback(err, null);
            } else {
                callback(err, JSON.parse(data).xml);
            }
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

        for (var i=0; i<style.length; ++i) {
          var stylesheet  = {};
          if ( _.isArray(style_in) ) {
            stylesheet.id   = 'style' + i;
            stylesheet.data = style[i].replace(/#[^\s[{]+/, '#layer' + i);
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
        if ( args.use_sql && _.isArray(opts.sql) ) {
          tables = opts.sql;
        }
        else if ( args.use_sql && opts.sql ) {
          tables = [ opts.sql ];
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

        return mml;
    };

    // Bases token key on:
    //   opts.sql
    //   style_override
    //   style_version_override
    //  
    me.makeToken = function() {
      if ( ! opts.sql && ! style_override ) return; // no token
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

    // Redis storage keys
    var token, base_store_key, extended_store_key;
    me.makeRedisKeys();

    // Millstone configuration
    //
    // Localized resources are not shared between "layers",
    // so we can safely purge them whenever redis keys for the style
    // are purged (setStyle, delStyle)
    //
    var millstone_cachedir = extra_config.cachedir || '/tmp/millstone'; 
    millstone_cachedir += '/' + opts.dbname + '/';
    if ( opts.table ) millstone_cachedir += opts.table
    else millstone_cachedir += '~' + token;
    var millstone_base_options = {
        base:  millstone_cachedir +  '/base',
        cache: millstone_cachedir + '/cache'
    };


    //trigger constructor
    me.init(init_callback);

    return me;
};

module.exports = MMLBuilder;
