var pool = require('generic-pool');
var fork = require('child_process').fork;
var debug = require('debug')('grainstore:worker-pool');

function WorkerPool(type) {
    if (!type) {
        throw new Error('missing required param "type"');
    }

    var path;

    if (type === 'translator') {
        path = __dirname + '/translator/translator-child.js';
    } else if (type === 'renderer') {
        path = __dirname + '/renderer/carto-renderer-child.js';
    }

    if (!path) {
        throw new Error('Invalid vaule for "type" params');
    }

    this.childPool = pool.Pool({
        name: 'grainstore-worker',
        create: function (callback) {
            return callback(null, fork(path));
        },
        destroy: function (child) {
            child.kill();
            child.disconnect();
        },
        validate: function (child) {
            return child && child.connected;
        },
        max: process.env.NODE_ENV === 'test' ? 4 : 8,
        min: process.env.NODE_ENV === 'test' ? 1 : 2,
        idleTimeoutMillis: 60000,
        reapIntervalMillis: 5000,
        log: false
    });
}

module.exports = WorkerPool;

WorkerPool.prototype.acquire = function (callback) {
    this.childPool.acquire(callback);
};

WorkerPool.prototype.release = function (child) {
    this.childPool.release(child);
};
