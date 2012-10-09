module.exports = {
  version: function() {
    return require('../../package.json').version;
  },
  MMLStore:  require('./mml_store')
};
