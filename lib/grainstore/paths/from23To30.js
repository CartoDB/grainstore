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
                
                if (symbolizer === 'polygon') {
                    setPatternAlignmentDefaultToLocal(rule, symbolyzer);
                }
            });
        });
    };
});

function setClipDefaultToTrue(rule, symbolizer) {
    var property = [symbolizer, 'clip'].join('-');

    if (hasPropertySymbolyzer(rule, symbolizer) && !hasPropertyAlreadyDefined(rule, property)) {
        var clipDecl = postcss.decl({ prop: property, value: true });
        rule.append(clipDecl);
    }
}

function setPatternAlignmentDefaultToLocal(rule, symbolizer) {
    var property = [symbolizer, 'pattern-aligment'].join('-');

    if (hasPropertySymbolyzer(rule, symbolizer) && !hasPropertyAlreadyDefined(rule, property)) {
        var patternAlignmentDecl = postcss.decl({ prop: property, value: 'local' });
        rule.append(patternAlignmentDecl);
    }
}

function hasPropertyAlreadyDefined(rule, property) {
    var hasPropertyAlreadyDefined = false;

    rule.walkDecls(function (decl) {
        if (decl.prop === property) {
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
