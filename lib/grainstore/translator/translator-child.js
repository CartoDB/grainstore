var debug = require('debug')('grainstore:translator-child');
var InlineTranslator = require('./inline-translator');

var translator = new InlineTranslator();

process.on('message', function (input) {
    debug('Translator child got cartocss');
    translator.transform(input.style, input.from, input.to, function (err, style) {
        if (err) {
            return process.send({ err: err.message });
        }

        process.send({ style: style });
    });
});
