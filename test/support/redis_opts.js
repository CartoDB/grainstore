// configure redis pool instance to use in tests
module.exports = {
  max: 10, 
  idleTimeoutMillis: 1, 
  reapIntervalMillis: 1,
  port: 6333
};

