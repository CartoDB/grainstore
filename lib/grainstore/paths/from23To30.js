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
            });
        });
    };
});

function setClipDefaultToTrue(rule, symbolizer) {
    if (!hasClipAlreadyDefined(rule, symbolizer) && hasPropertySymbolyzer(rule, symbolizer)) {
        var clipDecl = postcss.decl({ prop: symbolizer + '-clip', value: true });
        rule.append(clipDecl);
    }
}

function hasClipAlreadyDefined(rule, symbolyzer) {
    var clipProperty = symbolyzer + '-clip';
    var hasClipDefined = false;

    rule.walkDecls(function (decl) {
        var property = decl.prop;
        var value =  decl.value;

        if (property === clipProperty) {
            hasClipDefined = true;
        }
    });

    return hasClipDefined;
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
