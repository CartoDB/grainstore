var util = require('util');
var MMLBuilder = require('../mml_builder');

var pool = require('generic-pool');
var fork = require('child_process').fork;
var debug = require('debug')('grainstore:worker-renderer');

var childMMLBuilderPool = pool.Pool({
    name: 'mml-builder',
    create: function(callback) {
        return callback(null, fork(__dirname + '/mml-builder-child.js'));
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

function MMLBuilderWorker(params, options) {
    MMLBuilder.call(this, params, options);
}

util.inherits(MMLBuilderWorker, MMLBuilder);

module.exports = MMLBuilderWorker;

MMLBuilderWorker.prototype.toXML = function(callback) {
    var self = this;

    debug('Acquiring child process');
    childMMLBuilderPool.acquire(function(err, child) {
        if (err) {
            return callback(new Error('Unable to generate Mapnik XML'));
        } else {
            debug('Waiting for Mapnik XML');
            child.once('message', function(result) {
                childMMLBuilderPool.release(child);
                debug('Genterated Mapnik XML');
                if (result.err || !result.xml) {
                    return callback(new Error(result.err || 'Unable to generate Mapnik XML'));
                }
                return callback(null, result.xml);
            });

            debug('Sending Mapnik XML');

            // Node atomagically converts a javascript object (w/ functions) to
            // a plain object (w/o functions) before sending it to child process
            return child.send({ context: self });
        }
    });
};
