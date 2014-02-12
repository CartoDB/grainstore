var RedisPool  = require('redis-mpool')
  , MMLBuilder = require('./mml_builder')
  , Step = require('step')
  , fs     = require('fs')
  , _      = require('underscore')
;

var gcruns = 0; 

// @param redis_opts
//    configuration object for the RedisPool,
//    see details in redis_pool.js
//
// @param optional_args
//    optional configurations. valid elements:
//    gc_prob: probability of GC running to cleanup expired layergroup configs.
//             Defaults to 0.01 (1%). Set to 0 to disable.
//    cachedir: is base directory to put localized external resources into
//              Defaults to '/tmp/millstone'
//    cachettl: time to live of unaccessed localized resources, in seconds.
//              Defaults to 1 day
//    *: anything else that is accepted by mml_builder "optional_args"
//       parameter, see mml_builder.js
//    
//
var MMLStore = function(redis_opts, optional_args) {  

  var redis_pool = ( redis_opts && redis_opts.pool ) ?
        redis_opts.pool : new RedisPool(redis_opts);
  var me = {};

  optional_args = optional_args || {};
  if ( ! optional_args.cachedir ) optional_args.cachedir = '/tmp/millstone';

  // @param callback(err, payload) called on initialization
  me.mml_builder = function(opts, callback){
    var gc_probability = optional_args.gc_prob;
    if ( _.isUndefined(gc_probability) ) gc_probability = 0.01;
    if ( gc_probability && Math.random() < gc_probability ) me.gc();
    return new MMLBuilder(redis_pool, opts, optional_args, callback);
  };

  /// Purge expired table-agnostic styles
  me.purgeExpiredTokens = function(callback) {
    var redis_db = 0;
    var now = Date.now();
    Step(
      function getRedisClient(){
        redis_pool.acquire(redis_db, this);
      },
      function getTokens(err, redis_client){
        if (err) throw err;
        redis_client.KEYS('map_style|*|~*', this);
        redis_pool.release(redis_db, redis_client);
      },
      function expireTokens(err, matches){
        if (err) throw err;
        console.log(me.gcrunning +": " + matches.length + ' key matches');
        var next = this;
        var processNext = function() {
          if ( ! matches.length ) {
            next(null);
            return;
          }
          var k = matches.shift();
          var params = RegExp(/map_style\|([^|]*)\|~([^|]*)/).exec(k);
          if ( ! params ) {
            console.log(me.gcrunning + " key " + k + " is INVALID, skipping");
            processNext();
            return;
          } 
          console.log(me.gcrunning +": match " + k + ' is valid');
          var db = params[1];
          var token = params[2];
          var mml_builder = new MMLBuilder(redis_pool, {dbname:db, token:token},
                                           optional_args, function(err, payload)
          {
              if ( err ) {
                console.log(me.gcrunning +": processing token " + token + ": " + err);
                // TODO: drop the unusable key ? May be dangerous !
                // See https://github.com/CartoDB/grainstore/issues/73
                processNext();
                return;
              }

              console.log(me.gcrunning +": mml_builder for match " + k + ' constructed');

              mml_builder.getStyle(function(err, data) {
                if ( err ) {
                  console.log(me.gcrunning + ": " + token + ' ' + err.message);
                  processNext();
                  return;
                }
                var expires = data.accessed_at + (data.ttl * 1000);
                var secsleft = Math.round((expires-now)/10)/100;
                if ( now < expires ) {
                  console.log(me.gcrunning + ": " + token + ' has '
                    + secsleft
                    + ' more seconds before expiration');
                  processNext();
                  return;
                }
                mml_builder.delStyle(function(err, data) {
                  if ( err ) {
                    console.log(me.gcrunning + ": " + token + ' expired '
                      + (-secsleft)
                      + ' seconds ago could not be deleted: '
                      + err.message );
                  }
                  else {
                    console.log(me.gcrunning + ": " + token + ' expired '
                      + (-secsleft) + ' seconds ago');
                  }
                  processNext();
                });
              });
          });

        };
        processNext();
      },
      function finish(err) {
        callback(err);
      }
    );
  };

  /// API: Purge cache of localized resources for this store
  //
  /// @param ttl time to leave for each file, in seconds
  ///            NOTE: you can use 0 to clean all resources
  ///
  /// @param lbl label prefix for logs
  ///
  me.purgeLocalizedResources = function(ttl, callback, lbl)
  {
    if ( lbl ) lbl += ': ';
    else lbl = '';
    var now = Date.now();
    // TODO: check if "base" should also be cleared
    var toclear = optional_args.cachedir + '/cache';
//console.log("Scanning cache dir " + toclear);
    fs.readdir(toclear, function(err, files) {
      if ( err ) {
        if ( err.code != 'ENOENT' ) callback(err)
        else callback(null); // nothing to clear
      }
      else {
        var purgeNext = function() {
          var name = files.shift();
          if ( ! name ) {
            callback(null); // end of files
            return;
          }
          var file = toclear + '/' + name;
          fs.stat(file, function(err, stats) {
            if ( err ) {
              console.log(lbl + "cannot stat file " + file + ': ' + err);
              purgeNext();
            }
            if ( ttl ) {
              var cage = ( now - stats.ctime.getTime() ) / 1000;
              var aage = ( now - stats.atime.getTime() ) / 1000;
              //console.log(lbl + "file " + file + " was created " + cage + " seconds ago and accessed " + aage + " seconds ago. Requested time to leave is " + ttl + " seconds");
              if ( cage < ttl || aage < ttl )
              {
                purgeNext();
                return;
              }
              console.log(lbl + "unlinking " + file + " created " + cage +
                          " seconds ago and accessed " + aage +
                          " seconds ago (ttl is " + ttl + ")");
            } else {
              console.log(lbl + "unlinking " + file +
                          " (ttl is " + ttl + ")");
            }
            fs.unlink(file, function(err) {
              if (err) {
                console.log(lbl + "error unlinking " + file +
                            ": " + err);
              }
              purgeNext();
            });
          });
        };
        purgeNext();
      }
    });
  };


  me.gcrunning = 0; // TODO: move in outer scope
  me.gc_last_purge;
  me.gc = function(callback){

    if ( me.gcrunning ) {
      console.log(me.gcrunning + " already running");
      if ( callback ) callback();
      return;
    }
    var id = "GC" + (++gcruns);
    me.gcrunning = id;

    console.log(id + ": cycle starts");

    Step(
      function expireTokens(){
        // TODO: skip if opts.ttl=0 ? See #74
        me.purgeExpiredTokens(this);
      },
      function purgeLocalizedCache(err) {
        if ( err ) console.log("Tokens expiration error: " + err);
        var ttl = optional_args.cachettl;
        if ( _.isUndefined(ttl) ) ttl = 60*60*24*1; // 1 day, in seconds
        var now = Date.now();
        if ( me.gc_last_purge ) {
          var age = now - me.gc_last_purge; // ms
          if ( age < ttl*1000 ) {
            // Do not run again before TTL seconds
            console.log(id + ": skip localized resource purge (run " + age/1000 + " secs ago, TTL is " + ttl + ")");
            return null;
          }
          console.log(id + ": running localized resource purge after " + age/1000 + " secs since last time, TTL is " + ttl);
        }
        me.gc_last_purge = now;
        me.purgeLocalizedResources(ttl, this, id);
      },
      function finish(err) {
        if (err) console.log(id + ": " + err.message);

        console.log(id + ": cycle ends");
        delete me.gcrunning;
        if ( callback ) callback(err);
      }
    );
  }

  return me;    
};

module.exports = MMLStore;
