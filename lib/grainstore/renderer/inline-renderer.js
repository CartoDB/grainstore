var carto = require('carto');

function InlineRenderer() {
}

module.exports = InlineRenderer;

InlineRenderer.prototype.getXML = function(mml, options, env, callback) {
    // carto.Renderer may throw during parse time (before nextTick is called)
    // See https://github.com/mapbox/carto/pull/187
    try {
        var r = new carto.Renderer(env, options);
        r.render(mml, function(err, output){
            return callback(err, output);
        });
    } catch (err) {
        return callback(err, null);
    }
};
