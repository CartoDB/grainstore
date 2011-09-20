var RedisPool  = require('./redis_pool')
  , MMLBuilder = require('./mml_builder');

var MMLStore = function(redis_opts){  

  var redis_pool = new RedisPool(redis_opts),
      optional_args = arguments[1] || {},
      me = {};

  me.mml_builder = function(opts){
    return new MMLBuilder(redis_pool, opts, optional_args);
  };

  return me;    
};

module.exports = MMLStore;