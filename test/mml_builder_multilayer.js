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
    var style_version0 = "2.0.2";
    var style_version1 = "2.1.0";
    var mml_store = new grainstore.MMLStore(redis_opts, {mapnik_version: '2.1.0'});
    var mml_builder;

    Step(
      function initBuilder() {
        mml_builder = mml_store.mml_builder({
              dbname: 'my_database',
              sql:['SELECT ST_MakePoint(0,0)','SELECT ST_MakeLine(ST_MakePoint(-10,-5),ST_MakePoint(10,-5))'],
              style: [style0, style1],
              style_version: [style_version0, style_version1]
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
          var style0txt = style0.toString();
          var re = RegExp(/MarkersSymbolizer width="6"/);
          assert.ok(re.test(style0txt), 'Expected ' + re + ' -- got ' + style0txt);

          var style1 = xmlDoc.get("Style[@name='layer1']");
          assert.ok(style1, "Style for layer1 not found in XML");
          var style1txt = style1.toString();
          var re = RegExp(/MarkersSymbolizer width="4"/);
          assert.ok(re.test(style1txt), 'Expected ' + re + ' -- got ' + style1txt);

          mml_builder.delStyle(done);
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
