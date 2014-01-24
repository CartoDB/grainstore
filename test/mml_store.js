var assert     = require('assert');
var _          = require('underscore');
var grainstore = require('../lib/grainstore');
var RedisPool  = require('redis-mpool');

var redis_opts = require('./support/redis_opts');

suite('mml_store', function() {

test('can create new instance of mml_store', function() {
  var mml_store = new grainstore.MMLStore(redis_opts);
  assert.ok(_.functions(mml_store).indexOf('mml_builder') >= 0, "mml_store doesn't include 'mml_builder'");
});

test('cannot create new mml_builders with blank opts', function() {
  var mml_store = new grainstore.MMLStore(redis_opts);
  assert.throws(function(){ 
    mml_store.mml_builder();
  }, Error, "Options must include dbname and table");
});

test('can create new mml_builders with normal ops', function(done) {
  var mml_store = new grainstore.MMLStore(redis_opts);
  var mml_builder = mml_store.mml_builder({dbname: 'my_database', table:'my_table'}, function(err) {
    if ( err ) { done(err); return; }
    mml_builder.delStyle(done);
  });
});

test('can create new mml_builders with normal ops and sql', function(done) {
  var mml_store = new grainstore.MMLStore(redis_opts);
  var mml_builder = mml_store.mml_builder({dbname: 'my_database', table:'my_table', sql: "select * from whatever"}, function(err, payload) {
    if ( err ) { done(err); return; }
    mml_builder.delStyle(done);
  });
});

test('can use externally initialized RedisMultiPool', function(done) {
  var opts = { pool: new RedisPool(redis_opts) }
  var mml_store = new grainstore.MMLStore(opts);
  var mml_builder = mml_store.mml_builder({dbname: 'my_database', table:'my_table', sql: "select * from whatever"}, function(err, payload) {
    if ( err ) { done(err); return; }
    mml_builder.delStyle(done);
  });
});

});
