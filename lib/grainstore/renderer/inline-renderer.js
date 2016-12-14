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
        // r.render(mml, function(err, xml){
        //     debug('Renderer.render end err=%s', err);
        //     debugXml('output', xml);
        //     return callback(err, xml);
        // });

        var xml = r.render(mml);
        debugXml('output', xml);

        return callback(null, xml);

    } catch (err) {
        return callback(err, null);
    }
};
