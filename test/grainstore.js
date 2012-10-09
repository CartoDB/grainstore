var assert     = require('assert');
var grainstore = require('../lib/grainstore');

suite('grainstore', function() {

  test('version', function() {
    var version = grainstore.version();
    assert.equal(typeof(version), 'string');
    assert.equal(version, require('../package.json').version);
  });

});
