var MMLBuilder = require('./mml_builder');
var fs = require('fs');
var _ = require('underscore');
var debug = require('debug')('grainstore:mmlstore');

var WorkerPool = require('./worker-pool');

var InlineRenderer = require('./renderer/inline-renderer');
var WorkerRenderer = require('./renderer/worker-renderer');

var InlineTranslator = require('./translator/inline-translator');
var WorkerTranslator = require('./translator/worker-translator');

// @param optional_args
//    optional configurations. valid elements:
//    cachedir: is base directory to put localized external resources into
//              Defaults to '/tmp/millstone'
//    *: anything else that is accepted by mml_builder "optional_args"
//       parameter, see mml_builder.js
//
//
function MMLStore(options) {
  var me = {};

  options = options || {};
  options.cachedir = options.cachedir || '/tmp/millstone';
  options.renderer = options.use_workers ? new WorkerRenderer(new WorkerPool('renderer')) : new InlineRenderer();
  options.translator = options.use_workers ? new WorkerTranslator(new WorkerPool('translator')) : new InlineTranslator();

  // @param callback(err, payload) called on initialization
  me.mml_builder = function(params, overrideOptions) {
    return new MMLBuilder(params, _.extend({}, options, overrideOptions));
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
    if ( lbl ) {
        lbl += ': ';
    } else {
        lbl = '';
    }
    var now = Date.now();
    // TODO: check if "base" should also be cleared
    var toclear = options.cachedir + '/cache';
    debug("Scanning cache dir %s", toclear);
    fs.readdir(toclear, function(err, files) {
      if ( err ) {
        if ( err.code !== 'ENOENT' ) {
            callback(err);
        } else {
            callback(null);
        } // nothing to clear
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
              debug("%scannot stat file %s: %s", lbl, file, err);
              purgeNext();
            }
            if ( ttl ) {
              var cage = ( now - stats.ctime.getTime() ) / 1000;
              var aage = ( now - stats.atime.getTime() ) / 1000;
              if ( cage < ttl || aage < ttl )
              {
                purgeNext();
                return;
              }
              debug(
                  "%sunlinking %s created %d seconds ago and accessed %d seconds ago (ttl is %d)",
                  lbl, file, cage, aage, ttl
              );
            } else {
              debug("%sunlinking %s (ttl is %d)", lbl, file, ttl);
            }
            fs.unlink(file, function(err) {
              if (err) {
                debug("%serror unlinking %s: %s", lbl, file, err);
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
}

module.exports = MMLStore;
