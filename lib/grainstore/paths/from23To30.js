'use strict';

var postcss = require('postcss');
var symbolizers = {
    POLYGON: 'polygon',
    LINE: 'line',
    MARKER: 'marker',
    SHIELD: 'shield',
    TEXT: 'text'
};

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
            Object.keys(symbolizers).forEach(function (key) {
                setPropertyToDefault(rule, symbolizers[key], 'clip', true);
            });

            setPropertyToDefault(rule, symbolizers.POLYGON, 'pattern-aligment', 'local');
            setPropertyToDefault(rule, symbolizers.TEXT, 'label-position-tolerance', 0);
        });
    };
});

function setPropertyToDefault(rule, symbolizer, propSuffix, defaultValue) {
    var property = [symbolizer, propSuffix].join('-');

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
