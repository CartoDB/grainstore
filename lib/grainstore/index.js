var version = require('../../package.json').version;

module.exports = {
    version: function() {
        return version;
    },
    MMLStore: require('./mml_store'),
    MMLBuilder: require('./mml_builder')
};
