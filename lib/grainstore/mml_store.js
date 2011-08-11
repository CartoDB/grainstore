var RedisPool  = require('./redis_pool')
  , MMLBuilder = require('./mml_builder');

var MMLStore = function(redis_opts){  

  var redis_pool = new RedisPool(redis_opts),  
      me = {};
 
  me.mml_builder = function(opts){
    return new MMLBuilder(redis_pool, opts, arguments[1]);    
  }
  
  return me;  
};

module.exports = MMLStore;