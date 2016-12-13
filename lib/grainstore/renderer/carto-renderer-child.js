var carto  = require('carto');
var debug = require('debug')('grainstore:carto-renderer-child');

var InlineRenderer = require('./inline-renderer');
var renderer = new InlineRenderer();

process.on('message', function(input) {
    debug('Child got Mapnik MML');
    renderer.getXML(input.mml, input.options, input.env, function(err, xml) {
        if (err) {
            return process.send({err: err.message});
        }
        process.send({xml: xml});
    });
});
