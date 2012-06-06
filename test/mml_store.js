var assert     = require('assert');
var _          = require('underscore');
var grainstore = require('../lib/grainstore');
var tests      = module.exports = {};

var redis_opts = {
  max: 10, 
  idleTimeoutMillis: 1, 
  reapIntervalMillis: 1
};

tests['true'] = function() {
  assert.ok(true);
};

tests['can create new instance of mml_store'] = function() {
  var mml_store = new grainstore.MMLStore(redis_opts);
  assert.includes(_.functions(mml_store), 'mml_builder');
};

tests['cannot create new mml_builders with blank opts'] = function() {
  var mml_store = new grainstore.MMLStore(redis_opts);
  assert.throws(function(){ 
    mml_store.mml_builder();
  }, Error, "Options must include dbname and table");
};

tests['can create new mml_builders with normal ops'] = function() {
  var mml_store = new grainstore.MMLStore(redis_opts);
  var mml_builder = mml_store.mml_builder({dbname: 'my_database', table:'my_table'});
};

tests['can create new mml_builders with normal ops and sql'] = function() {
  var mml_store = new grainstore.MMLStore(redis_opts);
  var mml_builder = mml_store.mml_builder({dbname: 'my_database', table:'my_table', sql: "select * from whatever"});
};

