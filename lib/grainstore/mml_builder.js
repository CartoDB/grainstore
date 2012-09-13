var _      = require('underscore'),
    base64 = require('./base64'),
    Step   = require('step'),
    carto  = require('carto'),
    millstone = require('millstone'),
    fs     = require('fs');

// MML builder interface
//
// `redis` should be an instance of RedisPool
//
// opts must have:
// `dbname`    - name of database
// `table` - name of table with geospatial data
// 
// opts may have:
// `sql`             - sql to constrain the map by
// `geom_type`       - [polygon|point] to specify which default style to use
// `style`           - Carto style to override the built in style store
// `mapnik_version`  - Target version of mapnik, defaults to ``latest``
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
//         extent: "-20005048.4188,-20005048.4188,20005048.4188,20005048.4188",
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

    // The init_callback parameter is optional
    init_callback = init_callback || function() {};

    // core variables
    var opts = opts || {};
    var opt_keys = _.keys(opts);
    if (!_.include(opt_keys,'dbname') || !_.include(opt_keys, 'table'))
        throw new Error("Options must include dbname and table");
    var geom_type      = opts.geom_type || 'point';   // geom type for default styling
    var style_override = opts.style || null;

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
            extent: "-20005048.4188,-20005048.4188,20005048.4188,20005048.4188",
            srid: 3857,
            max_size: 10
        },
        styles: {
            point: '#' + opts.table + " {marker-fill: #FF6600;marker-opacity: 1;marker-width: 8;marker-line-color: white;marker-line-width: 3;marker-line-opacity: 0.9;marker-placement: point;marker-type: ellipse;marker-allow-overlap: true;}",
            polygon: '#' + opts.table + " {polygon-fill:#FF6600; polygon-opacity: 0.7; line-opacity:1; line-color: #FFFFFF;}" ,
            multipolygon: '#' + opts.table + " {polygon-fill:#FF6600; polygon-opacity: 0.7; line-opacity:1; line-color: #FFFFFF;}" ,
            multilinestring: '#' + opts.table + " {line-color:#FF6600; line-width:1; line-opacity: 0.7;}" ,
            db: 0  // redis database to store styles
        }
    };

    var extra_config          = optional_args           || {};
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

    // Redis storage keys
    var base_store_key = 'map_style' + '|' + opts.dbname + '|' + opts.table;
    if (!_.isUndefined(opts.sql) || !_.isUndefined(opts.style)) {
        var extended_store_key = base_store_key
    }
    if (!_.isUndefined(opts.sql)) {
        extended_store_key = extended_store_key + '|' + base64.encode(opts.sql);
    }
    if (!_.isUndefined(opts.style)) {
        extended_store_key = extended_store_key + '|' + base64.encode(opts.style);
    }

    // Millstone configuration
    //
    // Localized resources are not shared between "layers",
    // so we can safely purge them whenever redis keys for the style
    // are purged (setStyle, delStyle)
    //
    var millstone_cachedir = extra_config.cachedir || '/tmp/millstone'; 
        millstone_cachedir += '/' + opts.dbname + '-' + opts.table;
    var millstone_base_options = {
        base:  millstone_cachedir +  '/base',
        cache: millstone_cachedir + '/cache'
    };

    // MML Builder definition
    var me = {};

    // setup XML for this object in Redis. Either from base, or from defaults.
    me.init = function(callback){
        var that = this;
        var store_key = extended_store_key || base_store_key;
        var redis_client;
        var style;
        var style_payload;

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
                if (_.isNull(data)){
                    redis_client.GET(base_store_key, this);
                } else {
                    if (!_.isUndefined(redis_client))
                        redis_pool.release(grainstore_styles.db, redis_client);
                    callback(err, data);
                }
            },
            function renderBaseStyleOrDefaultOrOverride(err, data){
                if (err) throw err;
                if (_.isNull(data)){
                    style = grainstore_styles[geom_type];
                } else {
                    style = JSON.parse(data).style;
                }
                if (!_.isNull(style_override)){
                    style = style_override;
                }
                that.render(style, this);
            },
            function setStore(err, compiled_XML){
                if (err) throw err;
                style_payload = JSON.stringify({style: style, xml: compiled_XML})
                redis_client.SET(store_key, style_payload, this);
            },
            function callbackExit(err, data){
                if (!_.isUndefined(redis_client))
                    redis_pool.release(grainstore_styles.db, redis_client);
                callback(err, style_payload);
            }
        );
    };


    // carto render MML to Mapnik XML
    me.render = function(style, callback){
        var mml = this.toMML(style);

        var millstone_options = _.extend({mml:mml}, millstone_base_options);
        millstone.resolve(millstone_options, function(err, mml) {

          if ( err ) {
            callback(err, null);
            return;
          }

          var carto_env = {};
          var carto_options = {
            mapnik_version: opts.mapnik_version || 'latest' 
          };
          // TODO: reuse the renderer rather than using a temporary object ?
          new carto.Renderer(carto_env, carto_options).render(mml, function(err, output){
              callback(err, output);
          });

        });


    };


    // Purge cache of localized resources for this store
    me.purgeLocalizedResourceCache = function(callback)
    {
      // TODO: check if "base" should also be cleared
      var toclear = millstone_cachedir + '/cache';
      fs.exists(toclear, function(exists) {
        if ( ! exists ) { callback(null); return; }
        fs.readdir(toclear, function(err, files) {
          if ( err ) callback(err)
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
      });
    }

    // Generate Mapnik XML from MML.
    // store passed style and generated XML
    // Pass back any cartocss compile errors
    //
    // generates XML and stores it on base key
    // deletes all associated extended_store_keys as they
    // need to be regenerated
    me.setStyle = function(style, callback){
        var that = this
            , redis_client
            , compiled_XML;

        Step(
            // Purge millstone cache before refilling it
            function purgeCache(){
                that.purgeLocalizedResourceCache(this);
            },
            function renderMapnikStylesheet(err){
                if (err) throw err;
                that.render(style, this);
            },
            function getRedisClient(err, data){
                if (err) throw err;
                compiled_XML = data;
                redis_pool.acquire(grainstore_styles.db, this);
            },
            function storeStyleAndXML(err, data){
                if (err) throw err;
                redis_client = data;
                redis_client.SET(base_store_key, JSON.stringify({style: style, xml: compiled_XML}), this);
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

    me.getStyle = function(callback){
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
                callback(err, JSON.parse(data));
            }
        );
    };


    me.toXML = function(callback){
        var that = this;
        var store_key = extended_store_key || base_store_key;
        var redis_client;

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
                if (_.isNull(data)){
                    that.init(this); // re-init if the style were deleted by setStyle
                } else {
                    return data;
                }
            },
            function callbackExit(err, data){
                if (!_.isUndefined(redis_client))
                    redis_pool.release(grainstore_styles.db, redis_client);
                if (err) {
                    callback(err, null);
                } else {
                    callback(err, JSON.parse(data).xml);
                }
            }
        );
    };


    me.toMML = function(style){
        var stylesheet  = {};
        stylesheet.id   = 'style.mss';
        stylesheet.data = style;

        var base_mml = this.baseMML();
        base_mml.Stylesheet = [stylesheet];

        return base_mml;
    };


    // Generate base MML for this object
    // opts:
    // `use_sql` - {Boolean} if true, use sql settings in MML, else use table
    me.baseMML = function(args){
        args = args || {};
        args = _.defaults(args, {use_sql: true});

        var datasource     = _.clone(grainstore_datasource);
        datasource.table   = (args.use_sql && !_.isUndefined(opts.sql)) ? opts.sql : opts.table;
        datasource.dbname  = opts.dbname;

        var layer        = {};
        layer.id         = opts.table;
        layer.name       = opts.table;
        layer.srs        = '+init=epsg:' + grainstore_datasource.srid; //layer.srs = srs.parse(layer.srs).proj4;
        layer.Datasource = datasource;

        var mml   = {};
        mml.srs   = '+init=epsg:' + grainstore_map.srid; // mml.srs = srs.parse(mml.srs).proj4;
        mml.Layer = [layer];

        return mml;
    };

    //trigger constructor
    me.init(init_callback);

    return me;
};

module.exports = MMLBuilder;
