var RedisPool  = require('redis-mpool')
  , MMLBuilder = require('./mml_builder')
  , Step = require('step')
  , fs     = require('fs')
  , _      = require('underscore')
;

// @param redis_opts
//    configuration object for the RedisPool,
//    see details in redis_pool.js
//
// @param optional_args
//    optional configurations. valid elements:
//    cachedir: is base directory to put localized external resources into
//              Defaults to '/tmp/millstone'
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
    return new MMLBuilder(redis_pool, opts, optional_args, callback);
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


  return me;    
};

module.exports = MMLStore;
