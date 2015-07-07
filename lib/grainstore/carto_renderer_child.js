var carto  = require('carto');

process.on('message', function(input) {
    // carto.Renderer may throw during parse time (before nextTick is called)
    // See https://github.com/mapbox/carto/pull/187
    try {
        var r = new carto.Renderer(input.carto_env, input.carto_options);
        r.render(input.mml, function(err, xml) {
            if (err) {
                return process.send({err: err.message});
            }
            process.send({xml: xml});
        });
    } catch (err) {
        process.send({err: err.message});
    }
});