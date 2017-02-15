var util = require('util');
var MMLBuilder = require('../mml_builder');

function InlineRenderer(params, options) {
    MMLBuilder.call(this, params, options);
}

util.inherits(InlineRenderer, MMLBuilder);

module.exports = InlineRenderer;
