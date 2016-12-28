'use strict';

var postcss = require('postcss');
var symbolyzers = [
    'polygon',
    'line',
    'marker',
    'shield',
    'text'
];

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
            symbolyzers.forEach(function (symbolyzer) {
                setClipDefaultToTrue(rule, symbolyzer);
                setPatternAlignmentDefaultToLocal(rule, symbolyzer);
            });
        });
    };
});

function setClipDefaultToTrue(rule, symbolizer) {
    if (!hasPropertyAlreadyDefined(rule, symbolizer, 'clip') && hasPropertySymbolyzer(rule, symbolizer)) {
        var clipDecl = postcss.decl({ prop: symbolizer + '-clip', value: true });
        rule.append(clipDecl);
    }
}

function setPatternAlignmentDefaultToLocal(rule, symbolizer) {
    if (symbolizer !== 'polygon') {
        return;
    }

    if (!hasPropertyAlreadyDefined(rule, symbolizer, 'pattern-aligment') && hasPropertySymbolyzer(rule, symbolizer)) {
        var patternAlignmentDecl = postcss.decl({ prop: symbolizer + '-pattern-aligment', value: 'local' });
        rule.append(patternAlignmentDecl);
    }
}

function hasPropertyAlreadyDefined(rule, symbolyzer, property) {
    var propertyDecl = symbolyzer + '-' + property;
    var hasPropertyAlreadyDefined = false;

    rule.walkDecls(function (decl) {
        if (decl.prop === propertyDecl) {
            hasPropertyAlreadyDefined = true;
        }
    });

    return hasPropertyAlreadyDefined;
}


function hasPropertySymbolyzer(rule, symbolyzer) {
    var hasPropertySymbolyzer = false;

    rule.walkDecls(function (decl) {
        var property = decl.prop;

        if (property.indexOf(symbolyzer) === 0) {
            hasPropertySymbolyzer = true;
        }
    });

    return hasPropertySymbolyzer;
}
