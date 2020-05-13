'use strict';

var assert = require('assert');
var _ = require('underscore');
var grainstore = require('../lib/grainstore');

var DEFAULT_POINT_STYLE = [
    '#layer {',
    '  marker-fill: #FF6600;',
    '  marker-opacity: 1;',
    '  marker-width: 16;',
    '  marker-line-color: white;',
    '  marker-line-width: 3;',
    '  marker-line-opacity: 0.9;',
    '  marker-placement: point;',
    '  marker-type: ellipse;',
    '  marker-allow-overlap: true;',
    '}'
].join('');

describe('mml_store', function () {
    it('can create new instance of mml_store', function () {
        var mmlStore = new grainstore.MMLStore();
        assert.ok(_.functions(mmlStore).indexOf('mml_builder') >= 0, "mml_store doesn't include 'mml_builder'");
    });

    it('cannot create new mml_builders with blank opts', function () {
        var mmlStore = new grainstore.MMLStore();
        assert.throws(function () {
            mmlStore.mml_builder();
        }, Error, 'Options must include dbname and table');
    });

    it('can create new mml_builders with normal ops', function (done) {
        var mmlStore = new grainstore.MMLStore();
        mmlStore.mml_builder({ dbname: 'my_database', sql: 'select * from whatever', style: DEFAULT_POINT_STYLE }).toXML(done);
    });

    it('can create new mml_builders with normal ops and sql', function (done) {
        var mmlStore = new grainstore.MMLStore();
        mmlStore.mml_builder({ dbname: 'my_database', sql: 'select * from whatever', style: DEFAULT_POINT_STYLE }).toXML(done);
    });
});
