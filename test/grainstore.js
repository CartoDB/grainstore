'use strict';

var assert = require('assert');
var grainstore = require('../lib/grainstore');

describe('grainstore', function () {
    it('version', function () {
        var version = grainstore.version();
        assert.equal(typeof (version), 'string');
        assert.equal(version, require('../package.json').version);
    });
});
