var fs = require('fs');
var path = require('path');
var assert = require('assert');
var grainstore = require('../lib/grainstore');
var tests = module.exports = {};


tests['true'] = function() {
  assert.ok(true);
}

