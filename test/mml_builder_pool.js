'use strict';

const assert = require('assert');
const grainstore = require('../lib/grainstore');
const MMLBuilder = require('../lib/grainstore/mml-builder/mml-builder.js');
const DEFAULT_POINT_STYLE = `
  #layer {
    marker-fill: #FF6600;
    marker-opacity: 1;
    marker-width: 16;
    marker-line-color: white;
    marker-line-width: 3;
    marker-line-opacity: 0.9;
    marker-placement: point;
    marker-type: ellipse;
    marker-allow-overlap: true;
  }
`;
const SAMPLE_SQL = 'SELECT ST_MakePoint(0,0)';

suite('mml_builder pool', function () {
  test('should fire timeout when "worker_timeout: 1"', function (done) {
    const mmlStore = new grainstore.MMLStore({ use_workers: true, worker_timeout: 1 });
    mmlStore
      .mml_builder({ dbname: 'my_database', sql: SAMPLE_SQL, style: DEFAULT_POINT_STYLE })
      .toXML((err) => {
        assert.equal(err.message, 'Timeout fired while generating Mapnik XML');
        done();
      });
  });

  test('should disable timeout when "worker_timeout: 0"', function (done) {
    const mmlStore = new grainstore.MMLStore({ use_workers: true, worker_timeout: 0 });
    mmlStore
      .mml_builder({ dbname: 'my_database', sql: SAMPLE_SQL, style: DEFAULT_POINT_STYLE })
      .toXML((err, xml) => {
        if (err) {
          return done(err);
        }

        assert.ok(xml.length > 0);
        return done();
      });
  });

  test('should NOT fire timeout when "worker_timeout: 2000"', function (done) {
    const mmlStore = new grainstore.MMLStore({ use_workers: true, worker_timeout: 2000 });
    mmlStore
      .mml_builder({ dbname: 'my_database', sql: SAMPLE_SQL, style: DEFAULT_POINT_STYLE })
      .toXML((err, xml) => {
        if (err) {
          return done(err);
        }

        assert.ok(xml.length > 0);
        return done();
      });
  });

  test('should NOT fire timeout when "worker_timeout: undefined"', function (done) {
    const mmlStore = new grainstore.MMLStore({ use_workers: true, worker_timeout: undefined });
    mmlStore
      .mml_builder({ dbname: 'my_database', sql: SAMPLE_SQL, style: DEFAULT_POINT_STYLE })
      .toXML((err, xml) => {
        if (err) {
          return done(err);
        }

        assert.ok(xml.length > 0);
        return done();
      });
  });

  test('can deal with ENOMEM in child fork', function(done) {
    var myFork = function(whatever) {
      throw Error('ENOMEM: ' + whatever);
    }
    MMLBuilder.resetWorkersPool();
    const mml_store = new grainstore.MMLStore({ use_workers: true, worker_timeout: 1000 });
    mml_store.mml_builder({
        dbname: 'my_database',
        sql: SAMPLE_SQL,
        style: DEFAULT_POINT_STYLE,
        fork_function: myFork
    })
      .toXML((err, xml) => {
        MMLBuilder.resetWorkersPool();
        if (err) {
          assert.equal(err.message, 'Unable to generate Mapnik XML');
          return done();
        }
        return done('Expected an error');
      });
  });

});
