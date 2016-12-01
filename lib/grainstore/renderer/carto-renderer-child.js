var carto  = require('carto');
var debug = require('debug')('grainstore:carto-renderer-child');

process.on('message', function(input) {
    debug('Child got Mapnik MML');
    // carto.Renderer may throw during parse time (before nextTick is called)
    // See https://github.com/mapbox/carto/pull/187
    try {
        var r = new carto.Renderer(input.env, input.options);
        debug('Renderer.render');
        r.render(input.mml, function(err, xml) {
            debug('Renderer.render got', err);
            if (err) {
                return process.send({err: err.message});
            }
            process.send({xml: xml});
        });
    } catch (err) {
        process.send({err: err.message});
    }
});
