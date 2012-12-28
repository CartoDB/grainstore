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
  me.gc = function(){

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
        var next = this;
        var processNext = function() {
          if ( ! matches.length ) { next(null); return; }
          var k = matches.shift();
          var params = RegExp(/map_style\|([^|]*)\|~([^|]*)/).exec(k);
          if ( ! params ) {
            console.log(id + " key " + k + " is INVALID, skipping");
            processNext();
            return;
          } 
          var db = params[1];
          var token = params[2];
          var mml_builder = mml_store.mml_builder({dbname:db, token:token},
                                                  function(err, payload) {
              if ( err ) {
                console.log(id +": " + out + err.message);
                processNext();
              }
              else {
                mml_builder.delStyle(function(err, data) {
                  if ( err ) {
                    console.log(id + ": " + token + ' ' + err.message);
                  }
                  else {
                    console.log(id + ": " + token + ' OK');
                  }
                  processNext();
                });
              }
          });

        };
      },
      function finish(err, data){
        if (!_.isUndefined(redis_client))
          redis_pool.release(redis_db, redis_client);
        if (err) console.log(id + ": " + err.message);
      }
    );

    console.log(id + " cycle ends");
  }

  return me;    
};

module.exports = MMLStore;
