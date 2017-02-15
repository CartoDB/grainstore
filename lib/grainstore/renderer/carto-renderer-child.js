var _ = require('underscore');
var debug = require('debug')('grainstore:carto-renderer-child');
var InlineRenderer = require('./inline-renderer');

process.on('message', function(input) {
    debug('Child got Mapnik MML');

    try {
        var renderer = new InlineRenderer(input.ctx.params, input.ctx.options);

        _.extend(renderer, input.ctx);

        renderer.toXML(function (err, xml) {
            if (err) {
                return process.send({err: err.message});
            }
            process.send({xml: xml});
        });
    } catch (err) {
        return process.send({err: err.message});
    }
});
