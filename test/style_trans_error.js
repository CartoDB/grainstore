'use strict';

var assert = require('assert');
var StyleTrans = require('../lib/grainstore/style_trans.js');

describe('Style Transformer fails', function () {
    beforeEach(function () {
        this.styleTrans = new StyleTrans();
    });

    var polygonSuite = [{
        description: 'should return the same style from 2.0.0 to 2.0.2',
        from: '2.0.0',
        to: '2.0.2',
        input: [
            'this',
            '  is not a valid',
            'carto-css'
        ].join('\n'),
        expected: [
            'this',
            '  is not a valid',
            'carto-css'
        ].join('\n')
    }, {
        description: 'should return the same style from 2.3.0 to 3.0.12',
        from: '2.3.0',
        to: '3.0.12',
        input: [
            'this',
            '  is not a valid',
            'carto-css'
        ].join('\n'),
        expected: [
            'this',
            '  is not a valid',
            'carto-css'
        ].join('\n')
    }];

    var scenarios = [].concat(polygonSuite);

    scenarios.forEach(function (scenario) {
        it(scenario.description, function () {
            var outputStyle = this.styleTrans.transform(scenario.input, scenario.from, scenario.to);
            assert.equal(outputStyle, scenario.expected);
        });
    });
});
