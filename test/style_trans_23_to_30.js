'use strict';

var assert = require('assert');
var StyleTrans = require('../lib/grainstore/style_trans.js');

describe('cartocss transformation from 2.3.x to 3.0.x', function() {
    beforeEach(function() {
        this.styleTrans = new StyleTrans();
    });

    var polygonSuite = {
        symbolizer: 'polygon',
        testCases: [{
            property: 'polygon-fill',
            input: [
                '#layer {',
                '  polygon-fill: rgba(128,128,128,1);',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  polygon-fill: rgba(128,128,128,1);',
                '  polygon-clip: true;',
                '}'
            ].join('\n')
        }, {
            property: 'polygon-opacity',
            input: [
                '#layer {',
                '  polygon-opacity: 0.5;',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  polygon-opacity: 0.5;',
                '  polygon-clip: true;',
                '}'
            ].join('\n')
        }, {
            property: 'polygon-clip',
            not: true,
            input: [
                '#layer {',
                '  polygon-opacity: 0.5;',
                '  polygon-clip: true;',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  polygon-opacity: 0.5;',
                '  polygon-clip: true;',
                '}'
            ].join('\n')
        }, {
            property: 'polygon-clip already defined',
            not: true,
            input: [
                '#layer {',
                '  polygon-clip: false;',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  polygon-clip: false;',
                '}'
            ].join('\n')
        }, {
            property: ['polygon-fill', 'polygon-opacity']. join(', '),
            input: [
                '#layer {',
                '  polygon-fill: rgba(128,128,128,1);',
                '}',
                '#layer {',
                '  polygon-opacity: 0.5;',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  polygon-fill: rgba(128,128,128,1);',
                '  polygon-clip: true;',
                '}',
                '#layer {',
                '  polygon-opacity: 0.5;',
                '  polygon-clip: true;',
                '}'
            ].join('\n')
        }, {
            property: 'polygon-fill and polygon-opacity in the same rule',
            input: [
                '#layer {',
                '  polygon-fill: rgba(128,128,128,1);',
                '  polygon-opacity: 0.5;',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  polygon-fill: rgba(128,128,128,1);',
                '  polygon-opacity: 0.5;',
                '  polygon-clip: true;',
                '}'
            ].join('\n')
        }, {
            property: 'polygon-simplify in ::glow symbolizer',
            input: [
                '#layer::glow {',
                '  polygon-simplify: 0.1;',
                '}'
            ].join('\n'),
            expected: [
                '#layer::glow {',
                '  polygon-simplify: 0.1;',
                '  polygon-clip: true;',
                '}'
            ].join('\n')
        }]
    };

    var lineSuite = {
        symbolizer: 'line',
        testCases: [{
            property: 'line-width',
            input: [
                '#layer {',
                '  line-width: 0.5;',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  line-width: 0.5;',
                '  line-clip: true;',
                '}'
            ].join('\n')
        }, {
            property: 'line-cap',
            input: [
                '#layer {',
                '  line-cap: round;',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  line-cap: round;',
                '  line-clip: true;',
                '}'
            ].join('\n')
        }, {
            property: 'line-clip',
            not: true,
            input: [
                '#layer {',
                '  line-cap: round;',
                '  line-clip: true;',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  line-cap: round;',
                '  line-clip: true;',
                '}'
            ].join('\n')
        }, {
            property: 'line-clip already defined',
            not: true,
            input: [
                '#layer {',
                '  line-clip: false;',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  line-clip: false;',
                '}'
            ].join('\n')
        }, {
            property: ['line-width', 'line-cap']. join(', '),
            input: [
                '#layer {',
                '  line-width: 0.5;',
                '}',
                '#layer {',
                '  line-cap: round;',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  line-width: 0.5;',
                '  line-clip: true;',
                '}',
                '#layer {',
                '  line-cap: round;',
                '  line-clip: true;',
                '}'
            ].join('\n')
        }, {
            property: 'line-width and line-cap in the same rule',
            input: [
                '#layer {',
                '  line-width: 0.5;',
                '  line-cap: round;',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  line-width: 0.5;',
                '  line-cap: round;',
                '  line-clip: true;',
                '}'
            ].join('\n')
        }, {
            property: 'line-cap in ::glow symbolizer',
            input: [
                '#layer::glow {',
                '  line-cap: round;',
                '}'
            ].join('\n'),
            expected: [
                '#layer::glow {',
                '  line-cap: round;',
                '  line-clip: true;',
                '}'
            ].join('\n')
        }]
    };

    var markerSuite = {
        symbolizer: 'marker',
        testCases: [{
            property: 'marker-line-color',
            input: [
                '#layer {',
                '  marker-line-color: white;',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  marker-line-color: white;',
                '  marker-clip: true;',
                '}'
            ].join('\n')
        }, {
            property: 'marker-line-color',
            input: [
                '#layer {',
                '  marker-placement: interior;',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  marker-placement: interior;',
                '  marker-clip: true;',
                '}'
            ].join('\n')
        }, {
            property: 'marker-clip',
            not: true,
            input: [
                '#layer {',
                '  marker-placement: interior;',
                '  marker-clip: true;',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  marker-placement: interior;',
                '  marker-clip: true;',
                '}'
            ].join('\n')
        }, {
            property: 'marker-clip already defined',
            not: true,
            input: [
                '#layer {',
                '  marker-clip: false;',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  marker-clip: false;',
                '}'
            ].join('\n')
        }, {
            property: ['marker-line-color', 'marker-line-color']. join(', '),
            input: [
                '#layer {',
                '  marker-line-color: white;',
                '}',
                '#layer {',
                '  marker-placement: interior;',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  marker-line-color: white;',
                '  marker-clip: true;',
                '}',
                '#layer {',
                '  marker-placement: interior;',
                '  marker-clip: true;',
                '}'
            ].join('\n')
        }, {
            property: 'marker-line-color and marker-line-color in the same rule',
            input: [
                '#layer {',
                '  marker-line-color: white;',
                '  marker-placement: interior;',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  marker-line-color: white;',
                '  marker-placement: interior;',
                '  marker-clip: true;',
                '}'
            ].join('\n')
        }, {
            property: 'marker-line-color in ::glow symbolizer',
            input: [
                '#layer::glow {',
                '  marker-line-color: white;',
                '}'
            ].join('\n'),
            expected: [
                '#layer::glow {',
                '  marker-line-color: white;',
                '  marker-clip: true;',
                '}'
            ].join('\n')
        }]
    };

    var shieldSuite = {
        symbolizer: 'shield',
        testCases: [{
            property: 'shield-name',
            input: [
                '#layer {',
                '  shield-name: "wadus";',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  shield-name: "wadus";',
                '  shield-clip: true;',
                '}'
            ].join('\n')
        }, {
            property: 'shield-size',
            input: [
                '#layer {',
                '  shield-size: 20;',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  shield-size: 20;',
                '  shield-clip: true;',
                '}'
            ].join('\n')
        }, {
            property: 'shield-clip',
            not: true,
            input: [
                '#layer {',
                '  shield-size: 20;',
                '  shield-clip: true;',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  shield-size: 20;',
                '  shield-clip: true;',
                '}'
            ].join('\n')
        }, {
            property: 'shield-clip already defined',
            not: true,
            input: [
                '#layer {',
                '  shield-clip: false;',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  shield-clip: false;',
                '}'
            ].join('\n')
        }, {
            property: ['shield-name', 'shield-size']. join(', '),
            input: [
                '#layer {',
                '  shield-name: "wadus";',
                '}',
                '#layer {',
                '  shield-size: 20;',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  shield-name: "wadus";',
                '  shield-clip: true;',
                '}',
                '#layer {',
                '  shield-size: 20;',
                '  shield-clip: true;',
                '}'
            ].join('\n')
        }, {
            property: 'shield-name and shield-size in the same rule',
            input: [
                '#layer {',
                '  shield-name: "wadus";',
                '  shield-size: 20;',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  shield-name: "wadus";',
                '  shield-size: 20;',
                '  shield-clip: true;',
                '}'
            ].join('\n')
        }, {
            property: 'shield-name in ::glow symbolizer',
            input: [
                '#layer::glow {',
                '  shield-name: "wadus";',
                '}'
            ].join('\n'),
            expected: [
                '#layer::glow {',
                '  shield-name: "wadus";',
                '  shield-clip: true;',
                '}'
            ].join('\n')
        }]
    };

    var textSuite = {
        symbolizer: 'text',
        testCases: [{
            property: 'text-spacing',
            input: [
                '#layer {',
                '  text-spacing: 5;',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  text-spacing: 5;',
                '  text-clip: true;',
                '}'
            ].join('\n')
        }, {
            property: 'text-halo-fill',
            input: [
                '#layer {',
                '  text-halo-fill: #cf3;',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  text-halo-fill: #cf3;',
                '  text-clip: true;',
                '}'
            ].join('\n')
        }, {
            property: 'text-clip',
            not: true,
            input: [
                '#layer {',
                '  text-halo-fill: #cf3;',
                '  text-clip: true;',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  text-halo-fill: #cf3;',
                '  text-clip: true;',
                '}'
            ].join('\n')
        }, {
            property: 'text-clip already defined',
            not: true,
            input: [
                '#layer {',
                '  text-clip: false;',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  text-clip: false;',
                '}'
            ].join('\n')
        }, {
            property: ['text-spacing', 'text-halo-fill']. join(', '),
            input: [
                '#layer {',
                '  text-spacing: 5;',
                '}',
                '#layer {',
                '  text-halo-fill: #cf3;',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  text-spacing: 5;',
                '  text-clip: true;',
                '}',
                '#layer {',
                '  text-halo-fill: #cf3;',
                '  text-clip: true;',
                '}'
            ].join('\n')
        }, {
            property: 'text-spacing and text-halo-fill in the same rule',
            input: [
                '#layer {',
                '  text-spacing: 5;',
                '  text-halo-fill: #cf3;',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  text-spacing: 5;',
                '  text-halo-fill: #cf3;',
                '  text-clip: true;',
                '}'
            ].join('\n')
        }, {
            property: 'text-spacing in ::glow symbolizer',
            input: [
                '#layer::glow {',
                '  text-spacing: 5;',
                '}'
            ].join('\n'),
            expected: [
                '#layer::glow {',
                '  text-spacing: 5;',
                '  text-clip: true;',
                '}'
            ].join('\n')
        }]
    };

    var suites = []
        .concat(polygonSuite)
        .concat(lineSuite)
        .concat(markerSuite)
        .concat(shieldSuite)
        .concat(textSuite);

    suites.forEach(function (suite) {
        describe('for ' + suite.symbolizer + ' symbolizer', function () {
            suite.testCases.forEach(function (testCase) {
                var not = testCase.not ? 'not' : '';
                it('should ' + not + ' add `polygon-clip: true` if ' + testCase.property + ' is present', function () {
                    var outputStyle = this.styleTrans.transform(testCase.input, '2.3.0', '3.0.12');
                    assert.equal(outputStyle, testCase.expected);
                });
            }.bind(this));
        });
    }.bind(this));
});
