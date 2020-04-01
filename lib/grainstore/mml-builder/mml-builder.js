'use strict';

var util = require('util');
var MMLBuilderInline = require('./mml-builder-inline');

var pool = require('generic-pool');
var fork = require('child_process').fork;
var debug = require('debug')('grainstore:mml-builder');
var debugXml = require('debug')('grainstore:mml-builder:xml');
var childMMLBuilderPool = null;
var path = require('path');

function createWorkersPool () {
    if (!childMMLBuilderPool) {
        childMMLBuilderPool = pool.Pool({
            name: 'mml-builder',
            create: function (callback) {
                try {
                    const child = fork(path.join(__dirname, '/mml-builder-child.js'));
                    return callback(null, child);
                } catch (err) {
                    if (err instanceof Error && err.message.includes('ENOMEM')) {
                        process.emit('ENOMEM');
                    }

                    return callback(err);
                }
            },
            destroy: function (child) {
                child.kill();
            },
            validate: function (child) {
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

function MMLBuilder (params, options) {
    MMLBuilderInline.call(this, params, options);

    if (this.options.use_workers) {
        createWorkersPool();
    }

    this.options.worker_timeout = Number.isFinite(this.options.worker_timeout) ? this.options.worker_timeout : 5000;
}

util.inherits(MMLBuilder, MMLBuilderInline);

module.exports = MMLBuilder;

MMLBuilder.prototype.toXML = function (callback) {
    var self = this;

    if (!this.options.use_workers) {
        return MMLBuilderInline.prototype.toXML.call(this, callback);
    }

    debug('Acquiring child process');
    childMMLBuilderPool.acquire(function (err, child) {
        if (err) {
            return callback(new Error('Unable to generate Mapnik XML'));
        }

        debug('Waiting for Mapnik XML');

        function done (result) {
            debug('Child process sent a result back to the parent');
            if (timeout) {
                clearTimeout(timeout);
            }

            if (result.err && result.err.includes('ENOMEM')) {
                childMMLBuilderPool.destroy(child);
                process.emit('ENOMEM');

                return callback(new Error(result.err));
            }

            childMMLBuilderPool.release(child);

            if (result.err) {
                return callback(new Error(result.err));
            }

            if (!result.xml) {
                return callback(new Error('Unable to generate Mapnik XML'));
            }

            debug('Generated Mapnik XML');
            debugXml('output', result.xml);

            return callback(null, result.xml);
        }

        let timeout;

        if (self.options.worker_timeout > 0) {
            timeout = setTimeout(function () {
                child.removeListener('message', done);
                childMMLBuilderPool.destroy(child);

                debug('Timeout expired while generating Mapnik XML');

                return callback(new Error('Timeout fired while generating Mapnik XML'));
            }, self.options.worker_timeout);
        }

        child.once('message', done);

        debug('Sending Mapnik XML to child process');

        // Node converts a javascript object (w/ functions) to
        // a plain object (w/o functions) before sending it to child process,
        // thus we can use all bound context to MMLBuilder to clone it in child process
        return child.send({ context: self });
    });
};
