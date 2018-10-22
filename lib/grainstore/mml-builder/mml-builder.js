var util = require('util');
var MMLBuilderInline = require('./mml-builder-inline');

var pool = require('generic-pool');
var fork = require('child_process').fork;
var debug = require('debug')('grainstore:mml-builder');
var debugXml = require('debug')('grainstore:mml-builder:xml');
var childMMLBuilderPool = null;

function createWorkersPool() {
    if (!childMMLBuilderPool) {
        childMMLBuilderPool = pool.Pool({
            name: 'mml-builder',
            create: function(callback) {
                return callback(null, fork(__dirname + '/mml-builder-child.js'));
            },
            destroy: function (child) {
                child.kill();
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

        process.on('exit', function (code) {
            childMMLBuilderPool.destroyAllNow();
        });
    }
}

function MMLBuilder(params, options) {
    MMLBuilderInline.call(this, params, options);

    if (this.options.use_workers) {
        createWorkersPool();
    }
}

util.inherits(MMLBuilder, MMLBuilderInline);

module.exports = MMLBuilder;

MMLBuilder.prototype.toXML = function(callback) {
    var self = this;

    if (!this.options.use_workers) {
        return MMLBuilderInline.prototype.toXML.call(this, callback);
    }

    debug('Acquiring child process');
    childMMLBuilderPool.acquire(function(err, child) {
        if (err) {
            return callback(new Error('Unable to generate Mapnik XML'));
        } else {
            debug('Waiting for Mapnik XML');
            child.once('message', function (result) {
                childMMLBuilderPool.release(child);
                debug('Genterated Mapnik XML');
                if (result.err || !result.xml) {
                    return callback(new Error(result.err || 'Unable to generate Mapnik XML'));
                }

                debugXml('output', result.xml);
                return callback(null, result.xml);
            });

            debug('Sending Mapnik XML');

            // Node converts a javascript object (w/ functions) to
            // a plain object (w/o functions) before sending it to child process,
            // thus we can use all bound context to MMLBuilder to clone it in child process
            return child.send({ context: self });
        }
    });
};
