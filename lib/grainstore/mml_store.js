var RedisPool  = require('./redis_pool')
  , MMLBuilder = require('./mml_builder')
  , Step = require('step');

var MMLStore = function(redis_opts){  

  var redis_pool = new RedisPool(redis_opts),
      optional_args = arguments[1] || {},
      me = {};


  // @param callback(err, payload) called on initialization
  me.mml_builder = function(opts, callback){
    var gc_probability = optional_args.gc_prob || 0.01;
    if ( gc_probability && Math.random() < gc_probability ) me.gc();
    return new MMLBuilder(redis_pool, opts, optional_args, callback);
  };

  var gcruns = 0;
  me.gc = function(callback){

    var id = "GC" + (++gcruns);

    console.log(id + " cycle starts");

    var redis_client;
    var redis_db = 0;
    Step(
      function getRedisClient(){
        redis_pool.acquire(redis_db, this);
      },
      function getTokens(err, data){
        if (err) throw err;
        redis_client = data;
        redis_client.KEYS('map_style|*|~*', this);
      },
      function expireTokens(err, matches){
        if (err) throw err;
        console.log(id +": " + matches.length + ' key matches');
        var next = this;
        var processNext = function() {
          if ( ! matches.length ) {
            next(null);
            return;
          }
          var k = matches.shift();
          var params = RegExp(/map_style\|([^|]*)\|~([^|]*)/).exec(k);
          if ( ! params ) {
            console.log(id + " key " + k + " is INVALID, skipping");
            processNext();
            return;
          } 
          console.log(id +": match " + k + ' is valid');
          var db = params[1];
          var token = params[2];
          var mml_builder = me.mml_builder({dbname:db, token:token},
                                                  function(err, payload) {
              if ( err ) {
                console.log(id +": " + out + err.message);
                processNext();
                return;
              }

              console.log(id +": mml_builder for match " + k + ' constructed');

              mml_builder.getStyle(function(err, data) {
                if ( err ) {
                  console.log(id + ": " + token + ' ' + err.message);
                  processNext();
                  return;
                }
                var expires = data.updated_at + (data.ttl * 1000);
                var now = Date.now();
                if ( now < expires ) {
                  console.log(id + ": " + token + ' has '
                    + Math.round(expires-now)
                    + ' more seconds before expiration');
                  processNext();
                  return;
                }
                mml_builder.delStyle(function(err, data) {
                  if ( err ) {
                    console.log(id + ": " + token + ' expired '
                      + Math.round(now-expires)
                      + ' seconds ago could not be deleted: '
                      + err.message );
                  }
                  else {
                    console.log(id + ": " + token + ' expired '
                      + Math.round(now-expires) + ' seconds ago');
                  }
                  processNext();
                });
              });
          });

        };
        processNext();
      },
      function finish(err, data){
        if (redis_client)
          redis_pool.release(redis_db, redis_client);
        if (err) console.log(id + ": " + err.message);

        console.log(id + " cycle ends");
        if ( callback ) callback(err);
      }
    );
  }

  return me;    
};

module.exports = MMLStore;
