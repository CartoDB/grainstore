'use strict';

var postcss = require('postcss');
var propertyDefaultValues = [{
    symbolizer: 'polygon',
    defaults: [{
        property: 'polygon-clip',
        value: true
    }, {
        property: 'polygon-pattern-aligment',
        value: 'local'
    }]
}, {
    symbolizer: 'line',
    defaults: [{
        property: 'line-clip',
        value: true
    }]
}, {
    symbolizer: 'marker',
    defaults: [{
        property: 'marker-clip',
        value: true
    }]
}, {
    symbolizer: 'shield',
    defaults: [{
        property: 'shield-clip',
        value: true
    }]
}, {
    symbolizer: 'text',
    defaults: [{
        property: 'text-clip',
        value: true
    }, {
        property: 'text-label-position-tolerance',
        value: 0
    }]
}, {
    symbolizer: 'building',
    defaults: [{
        property: 'building-fill',
        value: 'white'
    }]
}];

module.exports = function (cartoCss) {
    return postcss()
        .use(postcssCartocssMigrator())
        .process(cartoCss)
        .css;
};

var postcssCartocssMigrator = postcss.plugin('postcss-cartocss-migrator', function (options) {
    options = options || {};
    return function (css) {
        css.walkRules(function (rule) {
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
        var patternAlignmentDecl = postcss.decl({ prop: property, value: defaultValue });
        rule.append(patternAlignmentDecl);
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

function hasDeclWithSymbolyzer(rule, symbolyzer) {
    var hasPropertySymbolyzer = false;

    rule.walkDecls(function (decl) {
        var property = decl.prop;

        if (property.indexOf(symbolyzer) === 0) {
            hasPropertySymbolyzer = true;
        }
    });

    return hasPropertySymbolyzer;
}
