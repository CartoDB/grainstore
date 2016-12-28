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
            description: 'should add defaults if polygon symbolizer is present with `polygon-fill` property',
            input: [
                '#layer {',
                '  polygon-fill: rgba(128,128,128,1);',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  polygon-fill: rgba(128,128,128,1);',
                '  polygon-clip: true;',
                '  polygon-pattern-aligment: local;',
                '}'
            ].join('\n')
        }, {
            description: 'should add defaults if polygon symbolizer is present with `polygon-opacity` property',
            input: [
                '#layer {',
                '  polygon-opacity: 0.5;',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  polygon-opacity: 0.5;',
                '  polygon-clip: true;',
                '  polygon-pattern-aligment: local;',
                '}'
            ].join('\n')
        }, {
            description: 'should not add `polygon-clip` default if polygon symbolizer is present and `polygon-clip` is already set to true',
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
                '  polygon-pattern-aligment: local;',
                '}'
            ].join('\n')
        }, {
            description: 'should not add `polygon-clip` default if polygon symbolizer is present and `polygon-clip` is already set to false',
            input: [
                '#layer {',
                '  polygon-clip: false;',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  polygon-clip: false;',
                '  polygon-pattern-aligment: local;',
                '}'
            ].join('\n')
        }, {
            description: 'should not add `polygon-pattern-aligment` default if polygon symbolizer is present and `polygon-pattern-aligment` is already set to global',
            input: [
                '#layer {',
                '  polygon-opacity: 0.5;',
                '  polygon-pattern-aligment: global;',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  polygon-opacity: 0.5;',
                '  polygon-pattern-aligment: global;',
                '  polygon-clip: true;',
                '}'
            ].join('\n')
        }, {
            description: 'should not add `polygon-pattern-aligment` default if polygon symbolizer is present and `polygon-pattern-aligment` is already set to local',
            input: [
                '#layer {',
                '  polygon-clip: false;',
                '  polygon-pattern-aligment: local;',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  polygon-clip: false;',
                '  polygon-pattern-aligment: local;',
                '}'
            ].join('\n')
        }, {
            description: 'should add defaults if polygon symbolizer is present in two different rules',
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
                '  polygon-pattern-aligment: local;',
                '}',
                '#layer {',
                '  polygon-opacity: 0.5;',
                '  polygon-clip: true;',
                '  polygon-pattern-aligment: local;',
                '}'
            ].join('\n')
        }, {
            description: 'should add defaults if polygon symbolizer is present with two different properties',
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
                '  polygon-pattern-aligment: local;',
                '}'
            ].join('\n')
        }, {
            description: 'should add defaults if polygon symbolizer is present for layer with `::glow` modifier',
            input: [
                '#layer::glow {',
                '  polygon-simplify: 0.1;',
                '}'
            ].join('\n'),
            expected: [
                '#layer::glow {',
                '  polygon-simplify: 0.1;',
                '  polygon-clip: true;',
                '  polygon-pattern-aligment: local;',
                '}'
            ].join('\n')
        }]
    };

    var lineSuite = {
        symbolizer: 'line',
        testCases: [{
            description: 'should add defaults if line symbolizer is present with `line-width` property',
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
            description: 'should add defaults if line symbolizer is present with `line-cap` property',
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
            description: 'should not add `line-clip` default if line symbolizer is present and `line-clip` is already set to true',
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
            description: 'should not add `line-clip` default if line symbolizer is present and `line-clip` is already set to false',
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
            description: 'should add defaults if line symbolizer is present in two different rules',
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
            description: 'should add defaults if line symbolizer is present with two different properties',
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
            description: 'should add defaults if line symbolizer is present for layer with `::glow` modifier',
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
            description: 'should add defaults if marker symbolizer is present with `marker-line-color` property',
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
            description: 'should add defaults if marker symbolizer is present with `marker-line-color` property',
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
            description: 'should not add `marker-clip` default if marker symbolizer is present and `marker-clip` is already set to true',
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
            description: 'should not add `marker-clip` default if marker symbolizer is present and `marker-clip` is already set to false',
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
            description: 'should add defaults if marker symbolizer is present in two different rules',
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
            description: 'should add defaults if marker symbolizer is present with two different properties',
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
            description: 'should add defaults if marker symbolizer is present for layer with `::glow` modifier',
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
            description: 'should add defaults if shield symbolizer is present with `shield-name` property',
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
            description: 'should add defaults if shield symbolizer is present with `shield-size` property',
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
            description: 'should not add `shield-clip` default if shield symbolizer is present and `shield-clip` is already set to true',
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
            description: 'should not add `shield-clip` default if shield symbolizer is present and `shield-clip` is already set to false',
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
            description: 'should add defaults if shield symbolizer is present in two different rules',
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
            description: 'should add defaults if shield symbolizer is present with two different properties',
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
            description: 'should add defaults if shield symbolizer is present for layer with `::glow` modifier',
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
            description: 'should add defaults if text symbolizer is present with `text-spacing` property',
            input: [
                '#layer {',
                '  text-spacing: 5;',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  text-spacing: 5;',
                '  text-clip: true;',
                '  text-label-position-tolerance: 0;',
                '}'
            ].join('\n')
        }, {
            description: 'should add defaults if text symbolizer is present with `text-halo-fill` property',
            input: [
                '#layer {',
                '  text-halo-fill: #cf3;',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  text-halo-fill: #cf3;',
                '  text-clip: true;',
                '  text-label-position-tolerance: 0;',
                '}'
            ].join('\n')
        }, {
            description: 'should not add `text-clip` default if text symbolizer is present and `text-clip` is already set to true',
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
                '  text-label-position-tolerance: 0;',
                '}'
            ].join('\n')
        }, {
            description: 'should not add `text-clip` default if text symbolizer is present and `text-clip` is already set to false',
            input: [
                '#layer {',
                '  text-clip: false;',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  text-clip: false;',
                '  text-label-position-tolerance: 0;',
                '}'
            ].join('\n')
        }, {
            description: 'should not add `text-label-position-tolerance` default if text symbolizer is present and `text-label-position-tolerance` is already set to any value',
            input: [
                '#layer {',
                '  text-halo-fill: #cf3;',
                '  text-label-position-tolerance: 12.0;',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  text-halo-fill: #cf3;',
                '  text-label-position-tolerance: 12.0;',
                '  text-clip: true;',
                '}'
            ].join('\n')
        }, {
            description: 'should add defaults if text symbolizer is present in two different rules',
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
                '  text-label-position-tolerance: 0;',
                '}',
                '#layer {',
                '  text-halo-fill: #cf3;',
                '  text-clip: true;',
                '  text-label-position-tolerance: 0;',
                '}'
            ].join('\n')
        }, {
            description: 'should add defaults if text symbolizer is present with two different properties',
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
                '  text-label-position-tolerance: 0;',
                '}'
            ].join('\n')
        }, {
            description: 'should add defaults if text symbolizer is present for layer with `::glow` modifier',
            input: [
                '#layer::glow {',
                '  text-spacing: 5;',
                '}'
            ].join('\n'),
            expected: [
                '#layer::glow {',
                '  text-spacing: 5;',
                '  text-clip: true;',
                '  text-label-position-tolerance: 0;',
                '}'
            ].join('\n')
        }]
    };

    var buildingSuite = {
        symbolizer: 'building',
        testCases: [{
            description: 'should add defaults if building symbolizer is present with `building-height` property',
            input: [
                '#layer {',
                '  building-height: 17.2;',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  building-height: 17.2;',
                '  building-fill: white;',
                '}'
            ].join('\n')
        }, {
            description: 'should not add `building-fill` default if building symbolizer is present and `building-fill` is already set to white',
            input: [
                '#layer {',
                '  building-height: 0.2;',
                '  building-fill: white;',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  building-height: 0.2;',
                '  building-fill: white;',
                '}'
            ].join('\n')
        },{
            description: 'should not add `building-fill` default if building symbolizer is present and `building-fill` is already set to #cf3',
            input: [
                '#layer {',
                '  building-height: 9;',
                '  building-fill: #cf3;',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  building-height: 9;',
                '  building-fill: #cf3;',
                '}'
            ].join('\n')
        }]
    };

    var suites = []
        .concat(polygonSuite)
        .concat(lineSuite)
        .concat(markerSuite)
        .concat(shieldSuite)
        .concat(textSuite)
        .concat(buildingSuite);

    suites.forEach(function (suite) {
        describe('for ' + suite.symbolizer + ' symbolizer', function () {
            suite.testCases.forEach(function (testCase) {
                it(testCase.description, function () {
                    var outputStyle = this.styleTrans.transform(testCase.input, '2.3.0', '3.0.12');
                    assert.equal(outputStyle, testCase.expected);
                });
            }.bind(this));
        });
    }.bind(this));
});
