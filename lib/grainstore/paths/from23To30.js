'use strict';

var debug = require('debug')('grainstore:transform');
var postcss = require('postcss');
var propertyDefaultValues = [{
    symbolizer: 'polygon',
    matches: /^polygon-(?!pattern-)/,
    defaults: [{
        property: 'polygon-clip',
        value: true
    }]
}, {
    symbolizer: 'polygon-pattern',
    matches: /^polygon-pattern-/,
    defaults: [{
        property: 'polygon-pattern-clip',
        value: true
    }, {
        property: 'polygon-pattern-aligment',
        value: 'local'
    }]
}, {
    symbolizer: 'line',
    matches: /^line-(?!pattern-)/,
    defaults: [{
        property: 'line-clip',
        value: true
    }]
}, {
    symbolizer: 'line-pattern',
    matches: /^line-pattern-/,
    defaults: [{
        property: 'line-pattern-clip',
        value: true
    }]
}, {
    symbolizer: 'marker',
    matches: /^marker-/,
    defaults: [{
        property: 'marker-clip',
        value: true
    }]
}, {
    symbolizer: 'shield',
    matches: /^shield-/,
    defaults: [{
        property: 'shield-clip',
        value: true
    }]
}, {
    symbolizer: 'text',
    matches: /^text-/,
    defaults: [{
        property: 'text-clip',
        value: true
    }, {
        property: 'text-label-position-tolerance',
        value: 0
    }]
}, {
    symbolizer: 'building',
    matches: /^building-/,
    defaults: [{
        property: 'building-fill',
        value: 'white'
    }]
}];

var symbolizers = propertyDefaultValues.map(function (propertyDefaultValue) {
    return propertyDefaultValue.symbolizer;
})

module.exports = function (cartoCss) {
    return postcss()
        .use(postcssCartocssMigrator())
        .process(cartoCss)
        .css;
};

var postcssCartocssMigrator = postcss.plugin('postcss-cartocss-migrator', function (options) {
    options = options || {};
    return function (root) {
        root.walkRules(function (rule) {
            propertyDefaultValues.forEach(function (property) {
                property.defaults.forEach(function (propertyDefault) {
                    setPropertyToDefault(rule, property.symbolizer, property.matches, propertyDefault.property, propertyDefault.value);
                });
            });
        });
    };
});

function setPropertyToDefault(rule, symbolizer, matches, property, defaultValue) {
    if (hasDeclWithSymbolyzer(rule, symbolizer, matches) && !hasPropertyDefined(rule, property)) {
        var declaration = postcss.decl({ prop: property, value: defaultValue });
        rule.append(declaration);
        debug('Appending declaration "%s: %s" to selector "%s"', property, defaultValue, rule.selector);
    }
}

function hasPropertyDefined(rule, property) {
    var hasPropertyDefined = false;

    rule.walkDecls(function (decl) {
        if (decl.prop === property) {
            hasPropertyDefined = true;
        }
    });

    return hasPropertyDefined;
}

function hasDeclWithSymbolyzer(rule, symbolyzer, matches) {
    var hasPropertySymbolyzer = false;

    rule.walkDecls(function (decl) {
        var property = decl.prop;

        if (property.match(matches)) {
            hasPropertySymbolyzer = true;
        }
    });

    return hasPropertySymbolyzer;
}
