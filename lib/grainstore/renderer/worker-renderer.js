var pool = require('generic-pool');
var fork = require('child_process').fork;
var debug = require('debug')('grainstore:worker-renderer');

function WorkerRenderer(workerPool) {
    this.workerPool = workerPool;
}

module.exports = WorkerRenderer;

WorkerRenderer.prototype.getXML = function(mml, options, env, callback) {
    var self = this;

    debug('Acquiring child process');
    this.workerPool.acquire(function(err, child) {
        if (err) {
            return callback(new Error('Unable to generate Mapnik XML'));
        } else {
            debug('Waiting for Mapnik XML');
            child.once('message', function(result) {
                self.workerPool.release(child);
                debug('Genterated Mapnik XML');
                if (result.err || !result.xml) {
                    return callback(new Error(result.err || 'Unable to generate Mapnik XML'));
                }
                return callback(null, result.xml);
            });
            debug('Sending Mapnik XML');
            return child.send({mml: mml, options: options, env: env});
        }
    });
};
