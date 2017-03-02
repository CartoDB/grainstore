'use strict';

var StyleTrans = require('../style_trans');
var debug = require('debug')('grainstore:translator');
var debugStyle = require('debug')('grainstore:translator:cartocss');

function InlineTranslator() {
    this._translator = new StyleTrans();
}

module.exports = InlineTranslator;

InlineTranslator.prototype.transform = function (style, from, to, callback) {
    try {
        debug('Translator.transform start');
        var style = this._translator.transform(style, from, to);
        finish(null, style, callback);
    } catch (err) {
        finish(err, null, callback);
    }
};

function finish(err, style, callback) {
    process.nextTick(function () {
        debug('Translator.transform finish');
        if (err) {
            debugStyle('Error', err);
        } else {
            debugStyle('Style:', style);
        }

        callback(err, style);
    });
}
