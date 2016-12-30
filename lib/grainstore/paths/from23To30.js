'use strict';

var debug = require('debug')('grainstore:transform');
var postcss = require('postcss');
var stripSingleLineComments = require('strip-css-singleline-comments/sync');

var propertyDefaultValues = [{
    symbolizer: /^polygon-(?!pattern-)/,
    defaults: [{
        property: 'polygon-clip',
        value: true
    }]
}, {
    symbolizer: /^polygon-pattern-/,
    defaults: [{
        property: 'polygon-pattern-clip',
        value: true
    }, {
        property: 'polygon-pattern-aligment',
        value: 'local'
    }]
}, {
    symbolizer: /^line-(?!pattern-)/,
    defaults: [{
        property: 'line-clip',
        value: true
    }]
}, {
    symbolizer: /^line-pattern-/,
    defaults: [{
        property: 'line-pattern-clip',
        value: true
    }]
}, {
    symbolizer: /^marker-/,
    defaults: [{
        property: 'marker-clip',
        value: true
    }, {
        property: 'marker-line-width',
        value: 1
    }]
}, {
    symbolizer: /^shield-/,
    defaults: [{
        property: 'shield-clip',
        value: true
    }]
}, {
    symbolizer: /^text-/,
    defaults: [{
        property: 'text-clip',
        value: true
    }, {
        property: 'text-label-position-tolerance',
        value: 0
    }]
}, {
    symbolizer: /^building-/,
    defaults: [{
        property: 'building-fill',
        value: 'white'
    }]
}];

module.exports = function (cartoCss) {
    return postcss()
        .use(postcssCartocssMigrator())
        .process(stripSingleLineComments(cartoCss))
        .css;
};

var postcssCartocssMigrator = postcss.plugin('postcss-cartocss-migrator', function (options) {
    options = options || {};
    return function (root) {
        root.walkRules(function (rule) {
            debug('Inspecting selector "%s"', rule.selector);
            propertyDefaultValues.forEach(function (property) {
                property.defaults.forEach(function (propertyDefault) {
                    setPropertyToDefault(rule, property.symbolizer, propertyDefault.property, propertyDefault.value);
                });
            });
        });
    };
});

function setPropertyToDefault(rule, symbolizer, property, defaultValue) {
    if (hasDeclWithSymbolyzer(rule, symbolizer) && !hasPropertyDefined(rule, property)) {
        var declaration = postcss.decl({ prop: property, value: defaultValue });
        rule.append(declaration);
        debug('Appending declaration "%s: %s" to selector "%s"', property, defaultValue, rule.selector);
    }
}

function hasPropertyDefined(rule, property) {
    var hasPropertyDefined = false;

    rule.walkDecls(function (decl) {
        if (decl.parent === rule) {
            debug('Inspecting declaration "%s" to check if "%s" is already defined', decl.toString(), property);
            if (decl.prop === property) {
                hasPropertyDefined = true;
            }
        }
    });

    return hasPropertyDefined;
}

function hasDeclWithSymbolyzer(rule, symbolyzer) {
    var hasPropertySymbolyzer = false;

    rule.walkDecls(function (decl) {
        if (decl.parent === rule) {
            debug('Inspecting declaration "%s" to check if it has any property that belongs to "%s" symbolizer', decl.toString(), symbolyzer.toString());
            if (decl.prop.match(symbolyzer)) {
                hasPropertySymbolyzer = true;
            }
        }
    });

    return hasPropertySymbolyzer;
}
