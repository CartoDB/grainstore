var _ = require('underscore');
var debug = require('debug')('grainstore:mml-builder-child');
var MMLBuilder = require('./mml_builder');

process.on('message', function(input) {
    debug('Child got MML Builder Context');
    try {
        var mmlBuilder = new MMLBuilder(input.context.params, input.context.options);

        // setting mml_builder context from parent process to have updated params before building XML
        _.extend(mmlBuilder, input.context);

        mmlBuilder.toXML(function (err, xml) {
            if (err) {
                return process.send({ err: err.message });
            }

            process.send({ xml: xml });
        });
    } catch (err) {
        return process.send({ err: err.message });
    }
});
