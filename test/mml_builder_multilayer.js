var assert     = require('assert');
var _          = require('underscore');
var grainstore = require('../lib/grainstore');
var libxmljs   = require('libxmljs');
var redis      = require('redis');
var Step       = require('step');
var http       = require('http');
var fs         = require('fs');

var redis_opts = require('./support/redis_opts');
var redis_client = redis.createClient(redis_opts.port);
var server;

var server_port = 8033;

function dropXMLFromStore(key, callback) {
    redis_client.get(key, function(err, val) {
      val = JSON.parse(val);
      delete val.xml;
      val = JSON.stringify(val);
      redis_client.set(key, val, callback);
    });
}

suite('mml_builder multilayer', function() {

  suiteSetup(function(done) {
    // Check that we start with an empty redis db 
    redis_client.keys("*", function(err, matches) {
        assert.ok(!err);
        assert.equal(matches.length, 0);
    });
    // Start a server to test external resources
    server = http.createServer( function(request, response) {
        var filename = 'test/support/resources' + request.url; 
        fs.readFile(filename, "binary", function(err, file) {
          if ( err ) {
            response.writeHead(404, {'Content-Type': 'text/plain'});
            console.log("File '" + filename + "' not found");
            response.write("404 Not Found\n");
          } else {
            response.writeHead(200);
            response.write(file, "binary");
          }
          response.end();
        });
    });
    server.listen(server_port, done);

  });

  test('error out when trying to get a map by unexistent token', function(done) {
    var mml_store = new grainstore.MMLStore(redis_opts, {mapnik_version: '2.1.0'});
    var mml_builder = mml_store.mml_builder({dbname: 'my_database', token:'unexistent'}, function(err) {
      assert.ok(err);
      assert.equal(err.message, ["Map style token 'unexistent' not found in redis"]);
      done();
    });
  });


  test('accept sql array with style array', function(done) {
    var style0 = "#layer0 { marker-width:3; }";
    var style1 = "#layer1 { line-color:red; }";
    var mml_store = new grainstore.MMLStore(redis_opts, {mapnik_version: '2.1.0'});
    var mml_builder;

    Step(
      function initBuilder() {
        mml_builder = mml_store.mml_builder({
              dbname: 'my_database',
              sql:['SELECT ST_MakePoint(0,0)','SELECT ST_MakeLine(ST_MakePoint(-10,-5),ST_MakePoint(10,-5))'],
              style: [style0, style1],
              style_version:'2.1.0',
            }, this);
      },
      function getXML0(err) {
          if ( err ) { done(err); return; }
          mml_builder.toXML(this);
      },
      function checkXML0(err, xml) {
          if ( err ) { done(err); return; }
          var xmlDoc = libxmljs.parseXmlString(xml);

          var layer0 = xmlDoc.get("Layer[@name='layer0']");
          assert.ok(layer0, "Layer0 not found in XML");

          var layer1 = xmlDoc.get("Layer[@name='layer1']");
          assert.ok(layer1, "Layer1 not found in XML");

          var style0 = xmlDoc.get("Style[@name='layer0']");
          assert.ok(style0, "Style for layer0 not found in XML");

          var style1 = xmlDoc.get("Style[@name='layer1']");
          assert.ok(style1, "Style for layer1 not found in XML");

          mml_builder.delStyle(done);
      }
    );
  });

  test('accept sql with style and style_version array', function(done) {
    var style0 = "#layer0 { marker-width:3; }";
    var style1 = "#layer1 { marker-width:4; }";
    var sql0 = 'SELECT ST_MakePoint(0,0)';
    var sql1 = 'SELECT ST_MakeLine(ST_MakePoint(-10,-5),ST_MakePoint(10,-5))';
    var style_version0 = "2.0.2";
    var style_version1 = "2.1.0";
    var mml_store = new grainstore.MMLStore(redis_opts, {mapnik_version: '2.1.0'});
    var mml_builder;

    Step(
      function initBuilder() {
        mml_builder = mml_store.mml_builder({
              dbname: 'my_database',
              sql:[sql0, sql1],
              style: [style0, style1],
              style_version: [style_version0, style_version1]
            }, this);
      },
      function getXML0(err) {
          if ( err ) { done(err); return; }
          mml_builder.toXML(this);
      },
      function checkXML0(err, xml) {
          if ( err ) throw err;
          var xmlDoc = libxmljs.parseXmlString(xml);

          var layer0 = xmlDoc.get("Layer[@name='layer0']");
          assert.ok(layer0, "Layer0 not found in XML");
          var table0 = layer0.get("Datasource/Parameter[@name='table']");
          assert.ok(table0, "Layer0.table not found in XML");
          var table0txt = table0.toString();
          assert.ok(table0txt.indexOf(sql0) != -1, 'Cannot find sql [' + sql0
                     + '] in table datasource, got ' + table0txt);

          var layer1 = xmlDoc.get("Layer[@name='layer1']");
          assert.ok(layer1, "Layer1 not found in XML");
          var table1 = layer1.get("Datasource/Parameter[@name='table']");
          assert.ok(table1, "Layer1.table not found in XML");
          var table1txt = table1.toString();
          assert.ok(table1txt.indexOf(sql1) != -1, 'Cannot find sql [' + sql1
                     + '] in table datasource, got ' + table1txt);

          var style0 = xmlDoc.get("Style[@name='layer0']");
          assert.ok(style0, "Style for layer0 not found in XML");
          var style0txt = style0.toString();
          var re = RegExp(/MarkersSymbolizer width="6"/);
          assert.ok(re.test(style0txt), 'Expected ' + re + ' -- got ' + style0txt);

          var style1 = xmlDoc.get("Style[@name='layer1']");
          assert.ok(style1, "Style for layer1 not found in XML");
          var style1txt = style1.toString();
          var re = RegExp(/MarkersSymbolizer width="4"/);
          assert.ok(re.test(style1txt), 'Expected ' + re + ' -- got ' + style1txt);

          return true
      },
      function finish(err) {
        mml_builder.delStyle(function(err2) {
          if ( err2 ) console.log("delStyle error: " + err2);
          done(err)
        });
      }
    );
  });

  test('layer name in style array is only a placeholder', function(done) {
    var style0 = "#layer { marker-width:3; }";
    var style1 = "#style { line-color:red; }";
    var mml_store = new grainstore.MMLStore(redis_opts, {mapnik_version: '2.1.0'});
    var mml_builder;

    Step(
      function initBuilder() {
        mml_builder = mml_store.mml_builder({
              dbname: 'my_database',
              sql:['SELECT ST_MakePoint(0,0)','SELECT ST_MakeLine(ST_MakePoint(-10,-5),ST_MakePoint(10,-5))'],
              style: [style0, style1],
              style_version:'2.1.0',
            }, this);
      },
      function getXML0(err) {
          if ( err ) { done(err); return; }
          mml_builder.toXML(this);
      },
      function checkXML0(err, xml) {
          if ( err ) { done(err); return; }
          var xmlDoc = libxmljs.parseXmlString(xml);

          var layer0 = xmlDoc.get("Layer[@name='layer0']");
          assert.ok(layer0, "Layer0 not found in XML");

          var layer1 = xmlDoc.get("Layer[@name='layer1']");
          assert.ok(layer1, "Layer1 not found in XML");

          var style0 = xmlDoc.get("Style[@name='layer0']");
          assert.ok(style0, "Style for layer0 not found in XML");

          var style1 = xmlDoc.get("Style[@name='layer1']");
          assert.ok(style1, "Style for layer1 not found in XML");

          mml_builder.delStyle(done);
      }
    );
  });

  test('accept sql array with single style string', function(done) {
    var style0 = "#layer0 { marker-width:3; }";
    var style1 = "#layer1 { line-color:red; }";
    var fullstyle = style0 + style1;
    var mml_store = new grainstore.MMLStore(redis_opts, {mapnik_version: '2.1.0'});
    var mml_builder;

    Step(
      function initBuilder() {
        mml_builder = mml_store.mml_builder({
              dbname: 'my_database',
              sql:['SELECT ST_MakePoint(0,0)','SELECT ST_MakeLine(ST_MakePoint(-10,-5),ST_MakePoint(10,-5))'],
              style: fullstyle, 
              style_version:'2.1.0',
            }, this);
      },
      function getXML0(err) {
          if ( err ) { done(err); return; }
          mml_builder.toXML(this);
      },
      function checkXML0(err, xml) {
          if ( err ) { done(err); return; }
          var xmlDoc = libxmljs.parseXmlString(xml);

          var layer0 = xmlDoc.get("Layer[@name='layer0']");
          assert.ok(layer0, "Layer0 not found in XML");

          var layer1 = xmlDoc.get("Layer[@name='layer1']");
          assert.ok(layer1, "Layer1 not found in XML");

          var style0 = xmlDoc.get("Style[@name='layer0']");
          assert.ok(style0, "Style for layer0 not found in XML");

          var style1 = xmlDoc.get("Style[@name='layer1']");
          assert.ok(style1, "Style for layer1 not found in XML");

          mml_builder.delStyle(done);
      }
    );
  });

  // Can initialize mml_builder by token, and the token expires when requested
  test('multilayer style expires when asked to', function(done) {
    var style0 = "#layer0 { marker-width:3; }";
    var style1 = "#layer1 { line-color:red; }";
    var fullstyle = style0 + style1;
    var mml_store = new grainstore.MMLStore(redis_opts, {mapnik_version: '2.1.0'});
    var mml_builder, mml_builder0;
    var token;

    Step(
      function initBuilder() {
        mml_builder0 = mml_builder = mml_store.mml_builder({
              dbname: 'my_database',
              sql:['SELECT ST_MakePoint(0,0)','SELECT ST_MakeLine(ST_MakePoint(-10,-5),ST_MakePoint(10,-5))'],
              style: fullstyle, 
              style_version:'2.1.0',
              ttl:1, // expiration time, in seconds
            }, this);
      },
      function getByToken0(err) {
          if ( err ) throw err;
          token = mml_builder.getToken();
          mml_builder = mml_store.mml_builder({
              dbname: 'my_database',
              token: token
          }, this);
      },
      function getXML0(err) {
          if ( err ) throw err;
          mml_builder.toXML(this);
      },
      function checkXML0(err, xml) {
          if ( err ) throw err;
          var xmlDoc = libxmljs.parseXmlString(xml);

          var layer0 = xmlDoc.get("Layer[@name='layer0']");
          assert.ok(layer0, "Layer0 not found in XML");

          var layer1 = xmlDoc.get("Layer[@name='layer1']");
          assert.ok(layer1, "Layer1 not found in XML");

          var style0 = xmlDoc.get("Style[@name='layer0']");
          assert.ok(style0, "Style for layer0 not found in XML");

          var style1 = xmlDoc.get("Style[@name='layer1']");
          assert.ok(style1, "Style for layer1 not found in XML");

          // the token should expire within a second
          var next = this;
          setTimeout(function() {
            // force GC run
            mml_store.gc(next);
          }, 1000);
      },
      function getByToken1(err) {
          if ( err ) throw err;
          mml_builder = mml_store.mml_builder({
              dbname: 'my_database',
              token: token
          }, this);
      },
      function verifyExpired(err) {
          assert.ok(err, "Success getting token, expected failure");
          assert.equal(err.message, "Map style token '" + token + "' not found in redis");
          done();
      }
    );
  });

  // Can keep an mml_builder alive by calling .ping() on it
  test('multilayer style is kept alive by ping', function(done) {
    var style0 = "#layer0 { marker-width:3; }";
    var style1 = "#layer1 { line-color:red; }";
    var fullstyle = style0 + style1;
    var mml_store = new grainstore.MMLStore(redis_opts, {mapnik_version: '2.1.0'});
    var mml_builder, mml_builder0;
    var token;

    Step(
      function initBuilder() {
        mml_builder0 = mml_builder = mml_store.mml_builder({
              dbname: 'my_database',
              sql:['SELECT ST_MakePoint(0,0)','SELECT ST_MakeLine(ST_MakePoint(-10,-5),ST_MakePoint(10,-5))'],
              style: fullstyle, 
              style_version:'2.1.0',
              ttl:1, // expiration time, in seconds
            }, this);
      },
      function getByToken0(err) {
          if ( err ) throw err;
          token = mml_builder.getToken();
          mml_builder = mml_store.mml_builder({
              dbname: 'my_database',
              token: token
          }, this);
      },
      function getXML0(err) {
          if ( err ) throw err;
          mml_builder.toXML(this);
      },
      function checkXML0(err, xml) {
          if ( err ) throw err;
          var xmlDoc = libxmljs.parseXmlString(xml);

          var layer0 = xmlDoc.get("Layer[@name='layer0']");
          assert.ok(layer0, "Layer0 not found in XML");

          var layer1 = xmlDoc.get("Layer[@name='layer1']");
          assert.ok(layer1, "Layer1 not found in XML");

          var style0 = xmlDoc.get("Style[@name='layer0']");
          assert.ok(style0, "Style for layer0 not found in XML");

          var style1 = xmlDoc.get("Style[@name='layer1']");
          assert.ok(style1, "Style for layer1 not found in XML");

          // the token would normally expire within a second ...
          var next = this;
          setTimeout(function() {
            // .. but we keep it alive by "touching" in
            mml_builder.touch(function(err) {
              if ( err ) next(err);
              else mml_store.gc(next);
            });
          }, 1000);

      },
      function getByToken1(err) {
          if ( err ) throw err;
          mml_builder = mml_store.mml_builder({
              dbname: 'my_database',
              token: token
          }, this);
      },
      function verifyNotExpiredAndGiveMoreTime(err) {
          assert.ok(!err);
          // it'll be expired on next second
          var next = this;
          setTimeout(function() { mml_store.gc(next); }, 1000);

      },
      function getByToken2(err) {
          if ( err ) throw err;
          mml_builder = mml_store.mml_builder({
              dbname: 'my_database',
              token: token
          }, this);
      },
      function verifyExpired(err) {
          assert.ok(err, "Success getting token, expected failure");
          assert.equal(err.message, "Map style token '" + token + "' not found in redis");
          done();
      }
    );
  });

  test('accept per-layer interactivity', function(done) {
    var sql0 = 'SELECT 1 as a, 2 as b, ST_MakePoint(0,0)';
    var sql1 = 'SELECT 3 as id, ST_MakeLine(ST_MakePoint(-10,-5),ST_MakePoint(10,-5))';
    var iact0 = 'a,b';
    var iact1 = 'id';
    var style0 = "#layer0 { marker-width:3; }";
    var style1 = "#layer1 { line-color:red; }";
    var fullstyle = style0 + style1;
    var mml_store = new grainstore.MMLStore(redis_opts, {mapnik_version: '2.1.0'});
    var mml_builder;
    var token;

    Step(
      function initBuilder() {
        mml_builder = mml_store.mml_builder({
              dbname: 'my_database',
              sql:[sql0, sql1],
              interactivity: [iact0, iact1],
              style: fullstyle, 
              style_version:'2.1.0',
            }, this);
      },
      function getToken(err) {
          if ( err ) throw err;
          token = mml_builder.getToken();
          return true;
      },
      function getBuilder0(err) {
        if ( err ) throw err;
        mml_builder = mml_store.mml_builder({
              dbname: 'my_database',
              token: token
            }, this);
      },
      function getXML0(err) {
          if ( err ) throw err;
          mml_builder.toXML(this);
      },
      function checkXML0(err, xml) {
          if ( err ) throw err;
          var xmlDoc = libxmljs.parseXmlString(xml);

          var layer0 = xmlDoc.get("Layer[@name='layer0']");
          assert.ok(layer0, "Layer0 not found in XML");

          var layer1 = xmlDoc.get("Layer[@name='layer1']");
          assert.ok(layer1, "Layer1 not found in XML");

          var style0 = xmlDoc.get("Style[@name='layer0']");
          assert.ok(style0, "Style for layer0 not found in XML");

          var style1 = xmlDoc.get("Style[@name='layer1']");
          assert.ok(style1, "Style for layer1 not found in XML");

          var x = xmlDoc.get("//Parameter[@name='interactivity_layer']");
          assert.equal(x.text(), "layer0");

          var x = xmlDoc.get("//Parameter[@name='interactivity_fields']");
          assert.equal(x.text(), "a,b");

          return true;
      },
      function getBuilder1(err) {
        if ( err ) throw err;
        mml_builder = mml_store.mml_builder({
              dbname: 'my_database',
              token: token,
              layer: 1
            }, this);
      },
      function getXML(err) {
          if ( err ) { done(err); return; }
          mml_builder.toXML(this);
      },
      function checkXML1(err, xml) {
          if ( err ) throw err;
          var xmlDoc = libxmljs.parseXmlString(xml);

          var layer0 = xmlDoc.get("Layer[@name='layer0']");
          assert.ok(layer0, "Layer0 not found in XML");

          var layer1 = xmlDoc.get("Layer[@name='layer1']");
          assert.ok(layer1, "Layer1 not found in XML");

          var style0 = xmlDoc.get("Style[@name='layer0']");
          assert.ok(style0, "Style for layer0 not found in XML");

          var style1 = xmlDoc.get("Style[@name='layer1']");
          assert.ok(style1, "Style for layer1 not found in XML");

          var x = xmlDoc.get("//Parameter[@name='interactivity_fields']");
          assert.equal(x.text(), "id");

          var x = xmlDoc.get("//Parameter[@name='interactivity_layer']");
          assert.equal(x.text(), "layer1");

          return true;
      },
      function finish(err) {
          mml_builder.delStyle(function(e2) {
            done(err);
          });
      }
    );
  });

  test('Do not error out on missing interactivity', function(done) {
    var sql0 = 'SELECT 1 as a, 2 as b, ST_MakePoint(0,0)';
    var sql1 = 'SELECT 3 as id, ST_MakeLine(ST_MakePoint(-10,-5),ST_MakePoint(10,-5))';
    var style0 = "#layer0 { marker-width:3; }";
    var style1 = "#layer1 { line-color:red; }";
    var fullstyle = style0 + style1;
    var mml_store = new grainstore.MMLStore(redis_opts, {mapnik_version: '2.1.0'});
    var mml_builder;
    var token;
    var iact0;
    var iact1 = 'id';

    Step(
      function initBuilder() {
        mml_builder = mml_store.mml_builder({
              dbname: 'my_database',
              sql:[sql0, sql1],
              interactivity: [iact0, iact1],
              style: fullstyle, 
              style_version:'2.1.0',
            }, this);
      },
      function getToken(err) {
          if ( err ) throw err;
          token = mml_builder.getToken();
          return true;
      },
      function getBuilder0(err) {
        if ( err ) throw err;
        mml_builder = mml_store.mml_builder({
              dbname: 'my_database',
              token: token
            }, this);
      },
      function getXML0(err) {
          if ( err ) throw err;
          mml_builder.toXML(this);
      },
      function checkXML0(err, xml) {
          if ( err ) throw err;
          var xmlDoc = libxmljs.parseXmlString(xml);

          var layer0 = xmlDoc.get("Layer[@name='layer0']");
          assert.ok(layer0, "Layer0 not found in XML");

          var layer1 = xmlDoc.get("Layer[@name='layer1']");
          assert.ok(layer1, "Layer1 not found in XML");

          var style0 = xmlDoc.get("Style[@name='layer0']");
          assert.ok(style0, "Style for layer0 not found in XML");

          var style1 = xmlDoc.get("Style[@name='layer1']");
          assert.ok(style1, "Style for layer1 not found in XML");

          var x = xmlDoc.get("//Parameter[@name='interactivity_layer']");
          assert.ok(!x);

          var x = xmlDoc.get("//Parameter[@name='interactivity_fields']");
          assert.ok(!x);

          return true;
      },
      function getBuilder1(err) {
        if ( err ) throw err;
        mml_builder = mml_store.mml_builder({
              dbname: 'my_database',
              token: token,
              layer: 1
            }, this);
      },
      function getXML(err) {
          if ( err ) { done(err); return; }
          mml_builder.toXML(this);
      },
      function checkXML1(err, xml) {
          if ( err ) throw err;
          var xmlDoc = libxmljs.parseXmlString(xml);

          var layer0 = xmlDoc.get("Layer[@name='layer0']");
          assert.ok(layer0, "Layer0 not found in XML");

          var layer1 = xmlDoc.get("Layer[@name='layer1']");
          assert.ok(layer1, "Layer1 not found in XML");

          var style0 = xmlDoc.get("Style[@name='layer0']");
          assert.ok(style0, "Style for layer0 not found in XML");

          var style1 = xmlDoc.get("Style[@name='layer1']");
          assert.ok(style1, "Style for layer1 not found in XML");

          var x = xmlDoc.get("//Parameter[@name='interactivity_fields']");
          assert.equal(x.text(), 'id');

          var x = xmlDoc.get("//Parameter[@name='interactivity_layer']");
          assert.equal(x.text(), 'layer1');

          return true;
      },
      function finish(err) {
          mml_builder.delStyle(function(e2) {
            done(err);
          });
      }
    );
  });

  test('Error out on malformed interactivity', function(done) {
    var sql0 = 'SELECT 1 as a, 2 as b, ST_MakePoint(0,0)';
    var sql1 = 'SELECT 3 as a, 4 as b, ST_MakeLine(ST_MakePoint(-10,-5),ST_MakePoint(10,-5))';
    var style0 = "#layer0 { marker-width:3; }";
    var style1 = "#layer1 { line-color:red; }";
    var fullstyle = style0 + style1;
    var mml_store = new grainstore.MMLStore(redis_opts, {mapnik_version: '2.1.0'});
    var mml_builder;
    var token;
    var iact0;
    var iact1 = ['a','b'];

    Step(
      function initBuilder() {
        mml_builder = mml_store.mml_builder({
              dbname: 'my_database',
              sql:[sql0, sql1],
              interactivity: [iact0, iact1],
              style: fullstyle, 
              style_version:'2.1.0',
            }, this);
      },
      function checkError(err) {
          assert.ok(err);
          assert.equal(err.message, 'Invalid interactivity value type for layer 1: object');
          done();
      }
    );
  });

  test('Error out on malformed layer', function(done) {
    var mml_store = new grainstore.MMLStore(redis_opts, {mapnik_version: '2.1.0'});
    var mml_builder;

    Step(
      function initBuilder() {
        mml_builder = mml_store.mml_builder({
              dbname: 'my_database',
              token: 'abc',
              layer: 'cipz'
            }, this);
      },
      function checkError(err) {
          assert.ok(err);
          assert.equal(err.message, 'Invalid (non-integer) layer value type: cipz');
          done();
      }
    );
  });

  // TODO: test resetStyle ? does it make sense to allow its use ?

  suiteTeardown(function() {
    // Close the server
    server.close();
    // Check that we left the redis db empty
    redis_client.keys("*", function(err, matches) {
        assert.equal(matches.length, 0);
    });
    redis_client.flushall();
  });

});
