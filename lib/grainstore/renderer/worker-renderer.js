var util = require('util');
var MMLBuilder = require('../mml_builder');

var pool = require('generic-pool');
var fork = require('child_process').fork;
var debug = require('debug')('grainstore:worker-renderer');

var childRendererPool = pool.Pool({
    name: 'cartocss-renderer',
    create: function(callback) {
        return callback(null, fork(__dirname + '/carto-renderer-child.js'));
    },
    destroy: function(child) {
        child.kill();
        child.disconnect();
    },
    validate: function(child) {
        return child && child.connected;
    },
    max: 8,
    min: 2,
    idleTimeoutMillis: 60000,
    reapIntervalMillis: 5000,
    log: false
});

function WorkerRenderer(params, options) {
    MMLBuilder.call(this, params, options);
}

util.inherits(WorkerRenderer, MMLBuilder);

module.exports = WorkerRenderer;

WorkerRenderer.prototype.toXML = function(callback) {
    var self = this;

    debug('Acquiring child process');
    childRendererPool.acquire(function(err, child) {
        if (err) {
            return callback(new Error('Unable to generate Mapnik XML'));
        } else {
            debug('Waiting for Mapnik XML');
            child.once('message', function(result) {
                childRendererPool.release(child);
                debug('Genterated Mapnik XML');
                if (result.err || !result.xml) {
                    return callback(new Error(result.err || 'Unable to generate Mapnik XML'));
                }
                return callback(null, result.xml);
            });
            debug('Sending Mapnik XML', self);

            return child.send({ ctx: self });
        }
    });
};
