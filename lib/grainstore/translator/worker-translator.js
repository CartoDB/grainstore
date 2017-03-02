var pool = require('generic-pool');
var fork = require('child_process').fork;
var debug = require('debug')('grainstore:worker-translator');

function WorkerTranslator(workerPool) {
    this.workerPool = workerPool;
}

module.exports = WorkerTranslator;

WorkerTranslator.prototype.transform = function (style, from, to, callback) {
    var self = this;

    debug('Acquiring child process');
    this.workerPool.acquire(function (err, child) {
        if (err) {
            return callback(new Error('Unable to translate CartoCSS form ' + from + ' to ' + to));
        }

        debug('Waiting for Translated CartoCSS');
        child.once('message', function (result) {
            self.workerPool.release(child);

            debug('Translated CartoCSS');
            if (result.err || !result.style) {
                return callback(new Error(result.err || 'Unable to translate CartoCSS'));
            }

            return callback(null, result.style);
        });

        debug('Sending CartoCSS');
        return child.send({ style: style, from: from, to: to });
    });
};
