var assert     = require('assert');
var _          = require('underscore');
var grainstore = require('../lib/grainstore');
var tests      = module.exports = {};

var redis_opts = {
  max: 10, 
  idleTimeoutMillis: 1, 
  reapIntervalMillis: 1
};

suite('mml_store', function() {

test('true', function() {
  assert.ok(true);
});

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

test('can create new mml_builders with normal ops', function() {
  var mml_store = new grainstore.MMLStore(redis_opts);
  var mml_builder = mml_store.mml_builder({dbname: 'my_database', table:'my_table'});
});

test('can create new mml_builders with normal ops and sql', function() {
  var mml_store = new grainstore.MMLStore(redis_opts);
  var mml_builder = mml_store.mml_builder({dbname: 'my_database', table:'my_table', sql: "select * from whatever"});
});

});
