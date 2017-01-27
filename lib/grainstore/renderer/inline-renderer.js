var carto = require('carto');
var debug = require('debug')('grainstore:renderer');
var debugXml = require('debug')('grainstore:renderer:xml');

function InlineRenderer() {
}

module.exports = InlineRenderer;

InlineRenderer.prototype.getXML = function(mml, options, env, callback) {
    // carto.Renderer may throw during parse time (before nextTick is called)
    // See https://github.com/mapbox/carto/pull/187
    try {
        var r = new carto.Renderer(env, options);
        debug('Renderer.render start');

        var xml = r.render(mml);
        debugXml('output', xml);

        process.nextTick(function () {
            return callback(null, xml);
        });
    } catch (err) {
        return callback(err, null);
    }
};
