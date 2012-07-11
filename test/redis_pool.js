var assert = require('assert')
  , _ = require('underscore')
  , RedisPool = require('../lib/grainstore/redis_pool')
  , tests = module.exports = {};

var redis_opts = require('./support/redis_opts');

var redis_pool = new RedisPool(redis_opts);

suite('redis_pool', function() {

test('RedisPool object exists', function(){
  assert.ok(RedisPool);
});

test('RedisPool can create new redis_pool objects with default settings', function(){
  var redis_pool = new RedisPool();
});

test('RedisPool can create new redis_pool objects with specific settings', function(){
  var redis_pool = new RedisPool(_.extend({host:'127.0.0.1', port: '6379'}, redis_opts));
});

test('pool object has an aquire function', function(){
  assert.ok(_.functions(redis_pool).indexOf('acquire') >= 0, "redis_pool doesn't include 'acquire'");
});

test('calling aquire returns a redis client object that can get/set', function(){
  redis_pool.acquire(0, function(err, client){
    client.set("key","value");
    client.get("key", function(err,data){      
      assert.equal(data, "value");      
      redis_pool.release(0, client); // needed to exit tests
    })
  });    
});

test('calling aquire on another DB returns a redis client object that can get/set', function(){
  redis_pool.acquire(2, function(err, client){
    client.set("key","value");
    client.get("key", function(err,data){      
      assert.equal(data, "value");      
      redis_pool.release(2, client); // needed to exit tests
    })
  });      
});

});
