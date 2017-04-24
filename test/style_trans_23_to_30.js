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
                '}',
                '#layer {',
                '  polygon-opacity: 0.5;',
                '  polygon-clip: true;',
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
                '}'
            ].join('\n')
        }, {
            description: 'should not add polygon defaults if just polygon-pattern symbolizer is present',
            input: [
                '#layer::glow {',
                '  polygon-pattern-simplify: 0.1;',
                '}'
            ].join('\n'),
            expected: [
                '#layer::glow {',
                '  polygon-pattern-simplify: 0.1;',
                '  polygon-pattern-clip: true;',
                '  polygon-pattern-alignment: local;',
                '}'
            ].join('\n')
        }, {
            description: 'should add polygon and polygon-pattern defaults if both symbolizers are present for layer with `::glow` modifier',
            input: [
                '#layer::glow {',
                '  polygon-simplify: 0.1;',
                '  polygon-pattern-simplify: 0.1;',
                '}'
            ].join('\n'),
            expected: [
                '#layer::glow {',
                '  polygon-simplify: 0.1;',
                '  polygon-pattern-simplify: 0.1;',
                '  polygon-clip: true;',
                '  polygon-pattern-clip: true;',
                '  polygon-pattern-alignment: local;',
                '}'
            ].join('\n')
        }]
    };

    var polygonPatternSuite = {
        symbolizer: 'polygon-pattern',
        testCases: [{
            description: 'should add defaults if polygon-pattern symbolizer is present with `polygon-pattern-simplify-algorithm` property',
            input: [
                '#layer {',
                '  polygon-pattern-simplify-algorithm: zhao-saalfeld;',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  polygon-pattern-simplify-algorithm: zhao-saalfeld;',
                '  polygon-pattern-clip: true;',
                '  polygon-pattern-alignment: local;',
                '}'
            ].join('\n')
        }, {
            description: 'should not add `polygon-pattern-clip` default if polygon-pattern symbolizer is present and `polygon-clip` is already set to true',
            input: [
                '#layer {',
                '  polygon-pattern-clip: true;',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  polygon-pattern-clip: true;',
                '  polygon-pattern-alignment: local;',
                '}'
            ].join('\n')
        }, {
            description: 'should not add `polygon-pattern-clip` default if polygon symbolizer is present and `polygon-clip` is already set to false',
            input: [
                '#layer {',
                '  polygon-pattern-clip: false;',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  polygon-pattern-clip: false;',
                '  polygon-pattern-alignment: local;',
                '}'
            ].join('\n')
        }, {
            description: 'should not add `polygon-pattern-alignment` default if polygon-pattern symbolizer is present and `polygon-pattern-alignment` is already set to global',
            input: [
                '#layer {',
                '  polygon-pattern-opacity: 0.5;',
                '  polygon-pattern-alignment: global;',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  polygon-pattern-opacity: 0.5;',
                '  polygon-pattern-alignment: global;',
                '  polygon-pattern-clip: true;',
                '}'
            ].join('\n')
        }, {
            description: 'should not add `polygon-pattern-alignment` default if polygon-pattern symbolizer is present and `polygon-pattern-alignment` is already set to local',
            input: [
                '#layer {',
                '  polygon-pattern-clip: false;',
                '  polygon-pattern-alignment: local;',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  polygon-pattern-clip: false;',
                '  polygon-pattern-alignment: local;',
                '}'
            ].join('\n')
        }, {
            description: 'should add defaults if polygon-pattern symbolizer is present in two different rules',
            input: [
                '#layer {',
                '  polygon-pattern-simplify: 0.1;',
                '}',
                '#layer {',
                '  polygon-pattern-opacity: 0.5;',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  polygon-pattern-simplify: 0.1;',
                '  polygon-pattern-clip: true;',
                '  polygon-pattern-alignment: local;',
                '}',
                '#layer {',
                '  polygon-pattern-opacity: 0.5;',
                '  polygon-pattern-clip: true;',
                '  polygon-pattern-alignment: local;',
                '}'
            ].join('\n')
        }, {
            description: 'should add defaults if polygon-pattern symbolizer is present with two different properties',
            input: [
                '#layer {',
                '  polygon-pattern-simplify: 0.1;',
                '  polygon-pattern-opacity: 0.5;',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  polygon-pattern-simplify: 0.1;',
                '  polygon-pattern-opacity: 0.5;',
                '  polygon-pattern-clip: true;',
                '  polygon-pattern-alignment: local;',
                '}'
            ].join('\n')
        }, {
            description: 'should add defaults if polygon-pattern symbolizer is present for layer with `::glow` modifier',
            input: [
                '#layer::glow {',
                '  polygon-pattern-simplify: 0.1;',
                '}'
            ].join('\n'),
            expected: [
                '#layer::glow {',
                '  polygon-pattern-simplify: 0.1;',
                '  polygon-pattern-clip: true;',
                '  polygon-pattern-alignment: local;',
                '}'
            ].join('\n')
        }, {
            description: 'should not add defaults if just polygon symbolizer is present',
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
        }, {
            description: 'should add polygon and polygon-pattern defaults if both symbolizers are present',
            input: [
                '#layer {',
                '  polygon-simplify: 0.1;',
                '  polygon-pattern-simplify: 0.1;',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  polygon-simplify: 0.1;',
                '  polygon-pattern-simplify: 0.1;',
                '  polygon-clip: true;',
                '  polygon-pattern-clip: true;',
                '  polygon-pattern-alignment: local;',
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

    var linePatternSuite = {
        symbolizer: 'line-pattern',
        testCases: [{
            description: 'should add defaults if line-pattern symbolizer is present with `line-pattern-simplify-algorithm` property',
            input: [
                '#layer {',
                '  line-pattern-simplify-algorithm: visvalingam-whyatt;',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  line-pattern-simplify-algorithm: visvalingam-whyatt;',
                '  line-pattern-clip: true;',
                '}'
            ].join('\n')
        }, {
            description: 'should not add `line-pattern-clip` default if line-pattern symbolizer is present and `line-pattern-clip` is already set to true',
            input: [
                '#layer {',
                '  line-pattern-clip: true;',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  line-pattern-clip: true;',
                '}'
            ].join('\n')
        }, {
            description: 'should not add `line-pattern-clip` default if line-pattern symbolizer is present and `line-pattern-clip` is already set to false',
            input: [
                '#layer {',
                '  line-pattern-clip: false;',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  line-pattern-clip: false;',
                '}'
            ].join('\n')
        }, {
            description: 'should add defaults if line-pattern symbolizer is present in two different rules',
            input: [
                '#layer {',
                '  line-pattern-simplify: 0.1;',
                '}',
                '#layer {',
                '  line-pattern-opacity: 0.5;',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  line-pattern-simplify: 0.1;',
                '  line-pattern-clip: true;',
                '}',
                '#layer {',
                '  line-pattern-opacity: 0.5;',
                '  line-pattern-clip: true;',
                '}'
            ].join('\n')
        }, {
            description: 'should add defaults if line-pattern symbolizer is present with two different properties',
            input: [
                '#layer {',
                '  line-pattern-simplify: 0.1;',
                '  line-pattern-opacity: 0.5;',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  line-pattern-simplify: 0.1;',
                '  line-pattern-opacity: 0.5;',
                '  line-pattern-clip: true;',
                '}'
            ].join('\n')
        }, {
            description: 'should add defaults if line-pattern symbolizer is present for layer with `::glow` modifier',
            input: [
                '#layer::glow {',
                '  line-pattern-simplify: 0.1;',
                '}'
            ].join('\n'),
            expected: [
                '#layer::glow {',
                '  line-pattern-simplify: 0.1;',
                '  line-pattern-clip: true;',
                '}'
            ].join('\n')
        }, {
            description: 'should not add defaults if just line symbolizer is present',
            input: [
                '#layer::glow {',
                '  line-simplify: 0.1;',
                '}'
            ].join('\n'),
            expected: [
                '#layer::glow {',
                '  line-simplify: 0.1;',
                '  line-clip: true;',
                '}'
            ].join('\n')
        }, {
            description: 'should add line and line-pattern defaults if both symbolizers are present',
            input: [
                '#layer {',
                '  line-simplify: 0.1;',
                '  line-pattern-simplify: 0.1;',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  line-simplify: 0.1;',
                '  line-pattern-simplify: 0.1;',
                '  line-clip: true;',
                '  line-pattern-clip: true;',
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
                '  marker-line-width: 1;',
                '}'
            ].join('\n')
        }, {
            description: 'should add defaults if marker symbolizer is present with `marker-placement` property',
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
                '  marker-line-width: 1;',
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
                '  marker-line-width: 1;',
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
                '  marker-line-width: 1;',
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

    var urlSuite = {
        symbolizer: 'line-pattern',
        testCases: [{
            description: 'should handle url enclosed by simple quotes',
            input: [
                '#layer {',
                '  line-width: 5;',
                "  line-pattern-file: url('https://s3.amazonaws.com/com.cartodb.users-assets.production/production/stephaniemongon/assets/20150923010945images-1.jpg');",
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  line-width: 5;',
                "  line-pattern-file: url('https://s3.amazonaws.com/com.cartodb.users-assets.production/production/stephaniemongon/assets/20150923010945images-1.jpg');",
                '  line-clip: true;',
                '  line-pattern-clip: true;',
                '}'
            ].join('\n')
        }, {
            description: 'should handle url enclosed by double quotes',
            input: [
                '#layer {',
                '  line-width: 5;',
                '  line-pattern-file: url("https://s3.amazonaws.com/com.cartodb.users-assets.production/production/stephaniemongon/assets/20150923010945images-1.jpg");',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  line-width: 5;',
                '  line-pattern-file: url("https://s3.amazonaws.com/com.cartodb.users-assets.production/production/stephaniemongon/assets/20150923010945images-1.jpg");',
                '  line-clip: true;',
                '  line-pattern-clip: true;',
                '}'
            ].join('\n')
        }, {
            description: 'should handle url w/o quotes',
            input: [
                '#layer {',
                '  line-width: 5;',
                "  line-pattern-file: url(https://s3.amazonaws.com/com.cartodb.users-assets.production/production/stephaniemongon/assets/20150923010945images-1.jpg);",
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  line-width: 5;',
                "  line-pattern-file: url(https://s3.amazonaws.com/com.cartodb.users-assets.production/production/stephaniemongon/assets/20150923010945images-1.jpg);",
                '  line-clip: true;',
                '  line-pattern-clip: true;',
                '}'
            ].join('\n')
        }, {
            description: 'should handle url w/o quotes and comments',
            input: [
                '#layer {',
                '  line-width: 5;',
                "  line-pattern-file: url(https://s3.amazonaws.com/com.cartodb.users-assets.production/production/stephaniemongon/assets/20150923010945images-1.jpg);//https://s3.amazonaws.com",
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  line-width: 5;',
                "  line-pattern-file: url(https://s3.amazonaws.com/com.cartodb.users-assets.production/production/stephaniemongon/assets/20150923010945images-1.jpg);",
                '  line-clip: true;',
                '  line-pattern-clip: true;',
                '}'
            ].join('\n')
        }]
    }

    var suites = []
        .concat(polygonSuite)
        .concat(polygonPatternSuite)
        .concat(lineSuite)
        .concat(linePatternSuite)
        .concat(markerSuite)
        .concat(shieldSuite)
        .concat(textSuite)
        .concat(urlSuite)

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

    describe('real scenarios', function () {
        var realScenarios = [{
            description: 'should set defaults for rules that contains symbolyzers',
            input: [
                '#countries {',
                '   ::outline {',
                '       line-color: #85c5d3;',
                '       line-width: 2;',
                '       line-join: round;',
                '   }',
                '   [GEOUNIT != "United States of America"]{',
                '       polygon-fill: #fff;',
                '   }',
                '}'
            ].join('\n'),
            expected: [
                '#countries {',
                '   ::outline {',
                '       line-color: #85c5d3;',
                '       line-width: 2;',
                '       line-join: round;',
                '       line-clip: true;',
                '   }',
                '   [GEOUNIT != "United States of America"]{',
                '       polygon-fill: #fff;',
                '       polygon-clip: true;',
                '   }',
                '}'
            ].join('\n')
        }, {
            description: 'should set defaults to road example',
            input: [
                '#road {',
                '  [class="motorway"] {',
                '    ::case {',
                '      line-width: 5;',
                '      line-color: #d83;',
                '    }',
                '    ::fill {',
                '      line-width: 2.5;',
                '      line-color: #fe3;',
                '    }',
                '  }',
                '  [class="main"] {',
                '    ::case {',
                '      line-width: 4.5;',
                '      line-color: #ca8;',
                '    }',
                '    ::fill {',
                '      line-width: 2;',
                '      line-color: #ffa;',
                '    }',
                '  }',
                '}'
            ].join('\n'),
            expected: [
                '#road {',
                '  [class="motorway"] {',
                '    ::case {',
                '      line-width: 5;',
                '      line-color: #d83;',
                '      line-clip: true;',
                '    }',
                '    ::fill {',
                '      line-width: 2.5;',
                '      line-color: #fe3;',
                '      line-clip: true;',
                '    }',
                '  }',
                '  [class="main"] {',
                '    ::case {',
                '      line-width: 4.5;',
                '      line-color: #ca8;',
                '      line-clip: true;',
                '    }',
                '    ::fill {',
                '      line-width: 2;',
                '      line-color: #ffa;',
                '      line-clip: true;',
                '    }',
                '  }',
                '}'
            ].join('\n')
        }, {
            description: 'should accept multiline comments: "/* ... */"',
            input: [
                '#road {',
                '  /* [class="railway"] {',
                '       ::glow { */',
                '  [class="motorway"] {',
                '    ::case {',
                '      line-width: 5; /* line-width: 10; */',
                '      line-color: #d83;',
                '    }',
                '  }',
                '}'
            ].join('\n'),
            expected: [
                '#road {',
                '  /* [class="railway"] {',
                '       ::glow { */',
                '  [class="motorway"] {',
                '    ::case {',
                '      line-width: 5; /* line-width: 10; */',
                '      line-color: #d83;',
                '      line-clip: true;',
                '    }',
                '  }',
                '}'
            ].join('\n')
        }, {
            description: 'should accept one line comments: "// ..."',
            input: [
                '#road {',
                '  // [class="railway"] {',
                '  [class="motorway"] {',
                '    ::case {',
                '      line-width: 5;',
                '      line-color: #d83;// line-color: #cf3;',
                '    }',
                '  }',
                '}'
            ].join('\n'),
            expected: [
                '#road {',
                '  [class="motorway"] {',
                '    ::case {',
                '      line-width: 5;',
                '      line-color: #d83;',
                '      line-clip: true;',
                '    }',
                '  }',
                '}'
            ].join('\n')
        }, {
            description: 'should accept column atributtes',
            input: [
                'Map {',
                '  buffer-size: 256;',
                '}',
                '#county_points_with_population {',
                '  marker-fill-opacity: 0.1;',
                '  marker-line-color:#FFFFFF;//#CF1C90;',
                '  marker-line-width: 0;',
                '  marker-line-opacity: 0.3;',
                '  marker-placement: point;',
                '  marker-type: ellipse;',
                '  marker-width: [cartodb_id];',
                '  [zoom=5]{marker-width: [cartodb_id]*2;}',
                '  [zoom=6]{marker-width: [cartodb_id]*4;}',
                '  marker-fill: #000000;',
                '  marker-allow-overlap: true;',
                '}'
            ].join('\n'),
            expected: [
                'Map {',
                '  buffer-size: 256;',
                '}',
                '#county_points_with_population {',
                '  marker-fill-opacity: 0.1;',
                '  marker-line-color:#FFFFFF;',
                '  marker-line-width: 0;',
                '  marker-line-opacity: 0.3;',
                '  marker-placement: point;',
                '  marker-type: ellipse;',
                '  marker-width: [cartodb_id];',
                '  [zoom=5]{marker-width: [cartodb_id]*2;}',
                '  [zoom=6]{marker-width: [cartodb_id]*4;}',
                '  marker-fill: #000000;',
                '  marker-allow-overlap: true;',
                '  marker-clip: true;',
                '}'
            ].join('\n')
        }, {
            description: 'should add defaults for turbo-cartocss outputs',
            input: [
                '#points {',
                '  marker-fill: #fee5d9;',
                '  [ scalerank = 6 ] {',
                '    marker-fill: #fcae91',
                '  }',
                '  [ scalerank = 8 ] {',
                '    marker-fill: #fb6a4a',
                '  }',
                '  [ scalerank = 4 ] {',
                '    marker-fill: #de2d26',
                '  }',
                '  [ scalerank = 10 ] {',
                '    marker-fill: #a50f15',
                '  }',
                '}',
            ].join('\n'),
            expected: [
                '#points {',
                '  marker-fill: #fee5d9;',
                '  [ scalerank = 6 ] {',
                '    marker-fill: #fcae91',
                '  }',
                '  [ scalerank = 8 ] {',
                '    marker-fill: #fb6a4a',
                '  }',
                '  [ scalerank = 4 ] {',
                '    marker-fill: #de2d26',
                '  }',
                '  [ scalerank = 10 ] {',
                '    marker-fill: #a50f15',
                '  }',
                '  marker-clip: true',
                '}',
            ].join('\n')
        }, { // see: https://github.com/CartoDB/grainstore/issues/136
            description: 'should not add defaults when parent has symbolizer already defined',
            input: [
                '#layer {',
                '  marker-width: 4;',
                '  [ pop_max > 10000 ] {',
                '    marker-width: 8;',
                '  }',
                '  [ pop_max > 100000 ] {',
                '    marker-width: 16;',
                '  }',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  marker-width: 4;',
                '  [ pop_max > 10000 ] {',
                '    marker-width: 8;',
                '  }',
                '  [ pop_max > 100000 ] {',
                '    marker-width: 16;',
                '  }',
                '  marker-clip: true',
                '}'
            ].join('\n')
        }, {
            description: 'should not add defaults when all parents have the symbolizer already defined',
            input: [
                '#layer {',
                '  marker-width: 4;',
                '  marker-clip: false;',
                '  [pop_max > 0] {',
                '    marker-clip: true;',
                '    marker-width: 8;',
                '    [pop_max > 100] {',
                '      marker-width: 16;',
                '    }',
                '  }',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  marker-width: 4;',
                '  marker-clip: false;',
                '  [pop_max > 0] {',
                '    marker-clip: true;',
                '    marker-width: 8;',
                '    [pop_max > 100] {',
                '      marker-width: 16;',
                '    }',
                '  }',
                '}'
            ].join('\n')
        }, {
            description: 'should just add defaults to the root rule',
            input: [
                '#layer {',
                '  marker-width: 4;',
                '  [pop_max > 0] {',
                '    marker-width: 8;',
                '    [pop_max > 100] {',
                '      marker-width: 16;',
                '    }',
                '  }',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  marker-width: 4;',
                '  [pop_max > 0] {',
                '    marker-width: 8;',
                '    [pop_max > 100] {',
                '      marker-width: 16;',
                '    }',
                '  }',
                '  marker-clip: true',
                '}'
            ].join('\n')
        }, {
            description: 'should just add defaults to the parent rule but to the children rule',
            input: [
                '#layer {',
                '  marker-width: 4;',
                '  [pop_max > 0] {',
                '    marker-width: 8;',
                '    marker-clip: true;',
                '    [pop_max > 100] {',
                '      marker-width: 16;',
                '    }',
                '  }',
                '}'
            ].join('\n'),
            expected: [
                '#layer {',
                '  marker-width: 4;',
                '  [pop_max > 0] {',
                '    marker-width: 8;',
                '    marker-clip: true;',
                '    [pop_max > 100] {',
                '      marker-width: 16;',
                '    }',
                '  }',
                '  marker-clip: true',
                '}'
            ].join('\n')
        }];

        realScenarios.forEach(function (scenario) {
            it(scenario.description, function () {
                var output = this.styleTrans.transform(scenario.input, '2.3.0', '3.0.12');
                assert.equal(output, scenario.expected);
            });
        });
    });
});
