var _ = require('underscore');
var debug = require('debug')('grainstore:carto-renderer-child');
var MMLBuilder = require('../mml_builder');

process.on('message', function(input) {
    debug('Child got Mapnik MML');

    try {
        var mmlBuilder = new MMLBuilder(input.ctx.params, input.ctx.options);

        _.extend(mmlBuilder, input.ctx);

        mmlBuilder.toXML(function (err, xml) {
            if (err) {
                return process.send({ err: err.message });
            }

            process.send({ xml: xml });
        });
    } catch (err) {
        return process.send({err: err.message});
    }
});
