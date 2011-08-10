var assert     = require('assert');
var _          = require('underscore');
var grainstore = require('../lib/grainstore');
var tests      = module.exports = {};


tests['true'] = function() {
  assert.ok(true);
}

tests['can create new instance of mml_store'] = function() {
  var mml_store = new grainstore.MMLStore();
  assert.includes(_.functions(mml_store), 'mml_builder');
}

tests['cannot create new mml_builders with blank opts'] = function() {
  var mml_store = new grainstore.MMLStore();
  assert.throws(function(){ 
    mml_store.mml_builder();
  }, Error, "Options must include db_name and table_name");
}


