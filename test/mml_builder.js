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

suite('mml_builder', function() {

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

  test('can generate base mml with normal ops', function(done) {
    var mml_store = new grainstore.MMLStore(redis_opts);
    var mml_builder = mml_store.mml_builder(
      {dbname: 'my_database', table:'my_table'},
      function(err, payload) {
        if ( err ) { done(err); return; }
        //console.dir(payload);
        var baseMML = mml_builder.baseMML();
    
        assert.ok(_.isArray(baseMML.Layer));
        assert.equal(baseMML.Layer[0].id, 'my_table');
        assert.equal(baseMML.Layer[0].Datasource.dbname, 'my_database');

        redis_client.keys("*", function(err, matches) {
            if ( err ) { done(err); return; }
            assert.equal(matches.length, 1);
            assert.equal(matches[0], 'map_style|my_database|my_table');
            mml_builder.delStyle(done);
        });
      }
    );
  });

  test('can be initialized with custom style', function(done) {
    var mml_store = new grainstore.MMLStore(redis_opts, {mapnik_version: '2.1.0'});
    var mml_builder = mml_store.mml_builder(
      {dbname: 'd', table:'t',
       style: '#t{}' },
      function(err, payload) {
        if ( err ) { done(err); return; }
        redis_client.keys("map_style|d|t|*", function(err, matches) {
            if ( err ) { done(err); return; }
            assert.equal(matches.length, 0);
            mml_builder.delStyle(done);
        });
      }
    );
  });

  test('can be initialized with custom style and version', function(done) {
    var mml_store = new grainstore.MMLStore(redis_opts, {mapnik_version: '2.1.0'});
    var mml_builder = mml_store.mml_builder(
      {dbname: 'd', table:'t',
       style: '#t{}', style_version: '2.0.2' },
      function(err, payload) {
        if ( err ) { done(err); return; }
        redis_client.keys("map_style|d|t|*", function(err, matches) {
            if ( err ) { done(err); return; }
            assert.equal(matches.length, 0);
            mml_builder.delStyle(done);
        });
      }
    );
  });

  test('can be initialized with custom interactivity', function(done) {
    var mml_store = new grainstore.MMLStore(redis_opts, {mapnik_version: '2.1.0'});
    var mml_builder = mml_store.mml_builder(
      {dbname: 'd', table:'t',
       interactivity: 'cartodb_id' },
      function(err, payload) {
        if ( err ) { done(err); return; }
        redis_client.keys("map_style|d|t|*", function(err, matches) {
            if ( err ) { done(err); return; }
            assert.equal(matches.length, 0);
            mml_builder.delStyle(done);
        });
      }
    );
  });

  test('can generate base mml with overridden authentication', function(done) {
    var mml_store = new grainstore.MMLStore(redis_opts, {
        datasource: {
            user:'overridden_user',
            password:'overridden_password'
        }});
    var mml_builder = mml_store.mml_builder({
            dbname: 'my_database',
            table:'my_table',
            // NOTE: authentication tokens here are silently discarded
            user:'shadow_user', password:'shadow_password'
    }, function() {

      var baseMML = mml_builder.baseMML();

      assert.ok(_.isArray(baseMML.Layer));
      assert.equal(baseMML.Layer[0].id, 'my_table');
      assert.equal(baseMML.Layer[0].Datasource.dbname, 'my_database');
      assert.equal(baseMML.Layer[0].Datasource.user, 'overridden_user');
      assert.equal(baseMML.Layer[0].Datasource.password, 'overridden_password');

      redis_client.keys("*", function(err, matches) {
          if ( err ) { done(err); return; }
          assert.equal(matches.length, 1);
          assert.equal(matches[0], 'map_style|my_database|my_table');
          mml_builder.delStyle(done);
      });

    });
  });

  test('can override authentication with mml_builder constructor', function(done) {
    var mml_store = new grainstore.MMLStore(redis_opts, {
        datasource: { user:'shadow_user', password:'shadow_password' }});
    var mml_builder = mml_store.mml_builder({
            dbname: 'my_database',
            table:'my_table',
            dbuser:'overridden_user', dbpassword:'overridden_password' }, function() {

      var baseMML = mml_builder.baseMML();

      assert.ok(_.isArray(baseMML.Layer));
      assert.equal(baseMML.Layer[0].id, 'my_table');
      assert.equal(baseMML.Layer[0].Datasource.dbname, 'my_database');
      assert.equal(baseMML.Layer[0].Datasource.user, 'overridden_user');
      assert.equal(baseMML.Layer[0].Datasource.password, 'overridden_password');

      redis_client.keys("*", function(err, matches) {
          if ( err ) { done(err); return; }
          assert.equal(matches.length, 1);
          assert.equal(matches[0], 'map_style|my_database|my_table');

          // Test that new mml_builder, with no overridden user/password, uses the default ones
          var mml_builder2 = mml_store.mml_builder({dbname:'my_database', table:'my_table'}, function() {
              var baseMML = mml_builder2.baseMML();
              assert.equal(baseMML.Layer[0].id, 'my_table');
              assert.equal(baseMML.Layer[0].Datasource.dbname, 'my_database');
              assert.equal(baseMML.Layer[0].Datasource.user, 'shadow_user');
              assert.equal(baseMML.Layer[0].Datasource.password, 'shadow_password');

              mml_builder.delStyle(function() {
                 mml_builder2.delStyle(done);
              });
          });
      });

    });
  });

  // See https://github.com/CartoDB/grainstore/issues/70
  test('can override db host and port with mml_builder constructor', function(done) {
    var mml_store = new grainstore.MMLStore(redis_opts, {
        datasource: { host:'shadow_host', port:'shadow_port' }});
    var mml_builder = mml_store.mml_builder({
            dbname: 'my_database',
            table:'my_table',
            dbhost:'overridden_host', dbport:'overridden_port' }, function() {

      var baseMML = mml_builder.baseMML();

      assert.ok(_.isArray(baseMML.Layer));
      assert.equal(baseMML.Layer[0].id, 'my_table');
      assert.equal(baseMML.Layer[0].Datasource.dbname, 'my_database');
      assert.equal(baseMML.Layer[0].Datasource.host, 'overridden_host');
      assert.equal(baseMML.Layer[0].Datasource.port, 'overridden_port');

      redis_client.keys("*", function(err, matches) {
          if ( err ) { done(err); return; }
          assert.equal(matches.length, 1);
          assert.equal(matches[0], 'map_style|my_database|my_table');

          // Test that new mml_builder, with no overridden user/password, uses the default ones
          var mml_builder2 = mml_store.mml_builder({dbname:'my_database', table:'my_table'}, function() {
              var baseMML = mml_builder2.baseMML();
              assert.equal(baseMML.Layer[0].id, 'my_table');
              assert.equal(baseMML.Layer[0].Datasource.dbname, 'my_database');
              assert.equal(baseMML.Layer[0].Datasource.host, 'shadow_host');
              assert.equal(baseMML.Layer[0].Datasource.port, 'shadow_port');

              mml_builder.delStyle(function() {
                 mml_builder2.delStyle(done);
              });
          });
      });

    });
  });

  test('can generate base mml with sql ops, maintain id', function(done) {
    var mml_store = new grainstore.MMLStore(redis_opts);
    var mml_builder = mml_store.mml_builder({dbname: 'my_database', table:'my_table', sql: 'SELECT * from my_table'},
    function() {
      var baseMML = mml_builder.baseMML();
      assert.equal(baseMML.Layer[0].id, 'my_table');
      assert.equal(baseMML.Layer[0].Datasource.table, 'SELECT * from my_table');
      // Check redis status
      redis_client.keys("map_style|my_database|my_table|*", function(err, matches) {
          if ( err ) { mml_builder.delStyle(done); return; }
          assert.equal(matches.length, 0);
          redis_client.get("map_style|my_database|my_table", function(err, val) {
            if ( err ) { mml_builder.delStyle(done); return; }
            assert.ok(val, "Base key not stored when initializing with sql");
            var js = JSON.parse(val);
            assert.ok(js.hasOwnProperty('style'), 'base key has no style property');
            assert.ok(js.hasOwnProperty('version'), 'base key has no version property');
            assert.ok(!js.hasOwnProperty('xml'), 'base key has an XML property');
            assert.ok(!js.hasOwnProperty('xml_version'), 'base key has an xml_version property');
            mml_builder.delStyle(done);
          });
      });
    });
  });

  test('can force plain base mml with sql ops', function(done) {
    var mml_store = new grainstore.MMLStore(redis_opts);
    var mml_builder = mml_store.mml_builder({dbname: 'my_database', table:'my_table', sql: 'SELECT * from my_table'}, function(){
      var baseMML = mml_builder.baseMML({use_sql: false});
      assert.equal(baseMML.Layer[0].id, 'my_table');
      assert.equal(baseMML.Layer[0].Datasource.table, 'my_table');
      mml_builder.delStyle(done);
    });
  });

  test('can generate full mml with style', function(done) {
    var mml_store = new grainstore.MMLStore(redis_opts);
    var mml_builder = mml_store.mml_builder({dbname: 'my_database', table:'my_table'}, function(){
      var mml = mml_builder.toMML("my carto style");
      assert.equal(mml.Stylesheet[0].data, 'my carto style');
      mml_builder.delStyle(done);
    });
  });

  test('can render XML from full mml with style', function(done) {
    var mml_store = new grainstore.MMLStore(redis_opts);
    var mml_builder = mml_store.mml_builder({dbname: 'my_database', table:'my_table'}, function() {
      mml_builder.render("#my_table {\n  polygon-fill: #fff;\n}", function(err, output){
        assert.ok(_.isNull(err), _.isNull(err) ? '' : err.message);
        assert.ok(output);
        mml_builder.delStyle(done);
      });
    });
  });

  test('Render a 2.2.0 style', function(done) {
    var style = "#t { polygon-fill: #fff; }";
    var mml_store = new grainstore.MMLStore(redis_opts, {mapnik_version: '2.2.0'});
    var mml_builder = mml_store.mml_builder({dbname: 'd', table:'t'}, function() {
      mml_builder.render(style, function(err, output){
        try {
          assert.ok(_.isNull(err), _.isNull(err) ? '' : err.message);
          assert.ok(output);
          var xmlDoc = libxmljs.parseXmlString(output);
          //assert.equal(output, '');
          var srs = xmlDoc.get("//PolygonSymbolizer/@fill");
          assert.equal(srs.value(), '#ffffff');
          mml_builder.delStyle(done);
        } catch (err) { done(err); }
      });
    });
  });

  test('can render errors from full mml with bad style', function(done) {
    var mml_store = new grainstore.MMLStore(redis_opts);
    var mml_builder = mml_store.mml_builder({dbname: 'my_database', table:'my_table'}, function() {
      mml_builder.render("#my_table {\n  backgrxxxxxound-color: #fff;\n}", function(err, output){
        assert.ok(err.message.match(/Unrecognized rule/), err.message);
        mml_builder.delStyle(done);
      });
    });
  });

  test('can render multiple errors from full mml with bad style', function(done) {
    var mml_store = new grainstore.MMLStore(redis_opts);
    var mml_builder = mml_store.mml_builder({dbname: 'my_database', table:'my_table'}, function() {
      mml_builder.render("#my_table {\n  backgrxxound-color: #fff;bad-tag: #fff;\n}", function(err, output){
       assert.ok(err.message.match(/Unrecognized rule[\s\S]*Unrecognized rule/), err.message);
       mml_builder.delStyle(done);
      });
    });
  });

  test('storing a bad style throws errors', function(done) {
    var mml_store = new grainstore.MMLStore(redis_opts);
    var mml_builder = mml_store.mml_builder({dbname: 'my_database', table:'my_table'}, function() {
      mml_builder.setStyle("#my_table {\n  backgrxxound-color: #fff;bad-tag: #fff;\n}", function(err, output){
       assert.ok(err.message.match(/Unrecognized rule[\s\S]*Unrecognized rule/), err.message);
       mml_builder.delStyle(done);
      });
    });
  });

  test('storing an unparseable style throws errors', function(done) {
    var mml_store = new grainstore.MMLStore(redis_opts);
    var mml_builder = mml_store.mml_builder({dbname: 'my_database', table:'my_table'}, function() {
      mml_builder.setStyle("{", function(err, output){
       assert.ok(err.message.match(/missing closing .}./i), err.message);
       mml_builder.delStyle(done);
      });
    });
  });

  test('store a good style', function(done) {
    var mml_store = new grainstore.MMLStore(redis_opts);
    var mml_builder = mml_store.mml_builder({dbname: 'my_database', table:'my_table'}, function() {
      mml_builder.setStyle("#my_table {\n  polygon-fill: #fff;\n}", function(err, output) {
       if ( err ) { done(err); return; }
        mml_builder.delStyle(done);
      });
    });
  });

  test('store a good style and retrieve it', function(done) {
    var style = "#my_table {\n  polygon-fill: #fff;\n}";
    var mml_store = new grainstore.MMLStore(redis_opts);
    var mml_builder = mml_store.mml_builder({dbname: 'my_database', table:'my_table'}, function() {
      mml_builder.setStyle(style, function(err, output){
        if ( err ) { done(err); return; }
        mml_builder.getStyle(function(err, data){
          if ( err ) { done(err); return; }
          assert.equal(data.style, style);
          assert.equal(data.version, '2.0.0');
          mml_builder.delStyle(done);
        });
      });
    });
  });

  test('store a good style with version 2.0.2 and retrieve it', function(done) {
    var style = "#my_table {\n  polygon-fill: #fff;\n}";
    var mml_store = new grainstore.MMLStore(redis_opts);
    var mml_builder = mml_store.mml_builder({dbname: 'my_database', table:'my_table'}, function() {
      mml_builder.setStyle(style, function(err, output){
        if ( err ) { done(err); return; }
        mml_builder.getStyle(function(err, data){
          if ( err ) { done(err); return; }
          assert.equal(data.style, style);
          assert.equal(data.version, '2.0.2');
          mml_builder.delStyle(done);
        });
      }, '2.0.2');
    });
  });

  test('store a good style with version 2.0.2 and target_version 2.1.0 and retrieve it', function(done) {
    var style = "#my_table {\n  polygon-fill: #fff;\n}";
    var mml_store = new grainstore.MMLStore(redis_opts, {mapnik_version: '2.1.0'});
    var mml_builder = mml_store.mml_builder({dbname: 'my_database', table:'my_table'}, function() {
      mml_builder.setStyle(style, function(err, output){
        if ( err ) { done(err); return; }
        mml_builder.getStyle(function(err, data){
          if ( err ) { done(err); return; }
          assert.equal(data.style, style);
          assert.equal(data.version, '2.0.2');
          /*assert.ok(data.hasOwnProperty('xml'));
          assert.equal(data.xml_version, '2.1.0');*/
          mml_builder.delStyle(done);
        });
      }, '2.0.2');
    });
  });

  test('store a good style with version 2.0.2 converting and retrieve it', function(done) {
    var style = "#t { marker-width: 3; }";
    var style_converted = '#t { marker-width:6; ["mapnik::geometry_type"=1] { marker-placement:point; marker-type:ellipse; } ["mapnik::geometry_type">1] { marker-placement:line; marker-type:arrow; marker-transform:scale(.5, .5); marker-clip:false; } }';
    var mml_store = new grainstore.MMLStore(redis_opts, {mapnik_version: '2.1.0'});
    var mml_builder = mml_store.mml_builder({dbname: 'my_database', table:'t'}, function() {
      mml_builder.setStyle(style, function(err, output){
        if ( err ) { done(err); return; }
        mml_builder.getStyle(function(err, data){
          if ( err ) { done(err); return; }
          assert.equal(data.style, style_converted);
          assert.equal(data.version, '2.1.0');
          mml_builder.delStyle(done);
        });
      }, '2.0.2', true);
    });
  });

  test('store a good style and delete it, resetting to default', function(done) {
    var style = "#my_table {\n  polygon-fill: #fff;\n}";
    var mml_store = new grainstore.MMLStore(redis_opts);
    var mml_builder = mml_store.mml_builder({dbname: 'my_database', table:'my_tableismo'}, function() {
      mml_builder.setStyle(style, function(err, output){
        if ( err ) { done(err); return; }
        mml_builder.delStyle(function(err, data){
          if ( err ) { done(err); return; }
          mml_builder.getStyle(function(err, data){
            if ( err ) { done(err); return; }
            assert(data);
            assert.equal(data.style, "#my_tableismo {marker-fill: #FF6600;marker-opacity: 1;marker-width: 8;marker-line-color: white;marker-line-width: 3;marker-line-opacity: 0.9;marker-placement: point;marker-type: ellipse;marker-allow-overlap: true;}");
            mml_builder.delStyle(done);
          });
        });
      });
    });
  });

  test('retrieves a non-existant style should return default style', function(done) {
    var mml_store = new grainstore.MMLStore(redis_opts);
    var mml_builder = mml_store.mml_builder({dbname: 'my_databaasez', table:'my_tablez'}, function() {
      mml_builder.getStyle(function(err, data){
        if ( err ) { done(err); return; }
        assert.equal(data.style, "#my_tablez {marker-fill: #FF6600;marker-opacity: 1;marker-width: 8;marker-line-color: white;marker-line-width: 3;marker-line-opacity: 0.9;marker-placement: point;marker-type: ellipse;marker-allow-overlap: true;}");
        mml_builder.delStyle(done);
      });
    });
  });

  test('default style in 2.1.0 target mapnik version', function(done) {
    var mml_store = new grainstore.MMLStore(redis_opts, {mapnik_version: '2.1.0'});
    var mml_builder = mml_store.mml_builder({dbname: 'd', table:'t'}, function() {
    var default_style_210 = '#t[mapnik-geometry-type=1] {marker-fill: #FF6600;marker-opacity: 1;marker-width: 16;marker-line-color: white;marker-line-width: 3;marker-line-opacity: 0.9;marker-placement: point;marker-type: ellipse;marker-allow-overlap: true;}#t[mapnik-geometry-type=2] {line-color:#FF6600; line-width:1; line-opacity: 0.7;}#t[mapnik-geometry-type=3] {polygon-fill:#FF6600; polygon-opacity: 0.7; line-opacity:1; line-color: #FFFFFF;}';
      mml_builder.getStyle(function(err, data){
        if ( err ) { done(err); return; }
        assert.equal(data.style, default_style_210);
        mml_builder.delStyle(done);
      });
    });
  });

  test('default style in 2.2.0 target mapnik version', function(done) {
    var mml_store = new grainstore.MMLStore(redis_opts, {mapnik_version: '2.2.0'});
    var mml_builder = mml_store.mml_builder({dbname: 'd', table:'t'}, function() {
    var default_style_220 = '#t["mapnik::geometry_type"=1] {marker-fill: #FF6600;marker-opacity: 1;marker-width: 16;marker-line-color: white;marker-line-width: 3;marker-line-opacity: 0.9;marker-placement: point;marker-type: ellipse;marker-allow-overlap: true;}#t["mapnik::geometry_type"=2] {line-color:#FF6600; line-width:1; line-opacity: 0.7;}#t["mapnik::geometry_type"=3] {polygon-fill:#FF6600; polygon-opacity: 0.7; line-opacity:1; line-color: #FFFFFF;}';
      mml_builder.getStyle(function(err, data){
        if ( err ) { done(err); return; }
        assert.equal(data.style, default_style_220);
        mml_builder.delStyle(done);
      });
    });
  });

  test('retrieves a dynamic style should return XML with dynamic style', function(done) {
    var mml_store = new grainstore.MMLStore(redis_opts);
    var mml_builder = mml_store.mml_builder(
      {dbname: 'my_databaasez', table:'my_tablez', style: '#my_tablez {marker-fill: #000000;}'},
      function() {
        mml_builder.toXML(function(err, data){
          if ( err ) { mml_builder.delStyle(function() { done(err); }); return; }
          var xmlDoc = libxmljs.parseXmlString(data);
          var color = xmlDoc.get("//@fill");
          assert.equal(color.value(), "#000000");
          mml_builder.delStyle(done);
        });
      });
  });

  test('includes interactivity in XML', function(done) {
    var mml_store = new grainstore.MMLStore(redis_opts);
    var mml_builder = mml_store.mml_builder(
      { dbname: 'd2', table:'t',
        interactivity: 'a,b'
      },
      function() {
        mml_builder.toXML(function(err, data){
          if ( err ) { mml_builder.delStyle(function() { done(err); }); return; }
          var xmlDoc = libxmljs.parseXmlString(data);
          var x = xmlDoc.get("//Parameter[@name='interactivity_layer']");
          assert.ok(x);
          assert.equal(x.text(), "t");
          x = xmlDoc.get("//Parameter[@name='interactivity_fields']");
          assert.ok(x);
          assert.equal(x.text(), "a,b");
          mml_builder.delStyle(done);
        });
      });
  });

  // See https://github.com/Vizzuality/grainstore/issues/61
  test('zoom variable is special', function(done) {
    var mml_store = new grainstore.MMLStore(redis_opts);
    var mml_builder = mml_store.mml_builder(
      { dbname: 'd', table:'t',
        style: '#t [ zoom  >=  4 ] {marker-fill:red;}'
      },
      function() {
        mml_builder.toXML(function(err, data){
          if ( err ) { mml_builder.delStyle(function() { done(err); }); return; }
          var xmlDoc = libxmljs.parseXmlString(data);
          var xpath = "//MaxScaleDenominator";
          var x = xmlDoc.get(xpath);
          assert.ok(x, "Xpath '" + xpath + "' does not match " + xmlDoc);
          assert.equal(x.text(), "50000000");
          mml_builder.delStyle(done);
        });
      });
  });

  test('quotes in CartoCSS are accepted', function(done) {
    var mml_store = new grainstore.MMLStore(redis_opts);
    var mml_builder = mml_store.mml_builder(
      { dbname: 'd', table:'t',
        sql: [ "select 'x' as n, 'SRID=3857;POINT(0 0)'::geometry as the_geom_webmercator",
               "select 'x' as n, 'SRID=3857;POINT(2 0)'::geometry as the_geom_webmercator" ],
        style: [ '#t [n="t\'q"] {marker-fill:red;}', '#t[n=\'t"q\'] {marker-fill:green;}' ]
      },
      function() {
        mml_builder.toXML(function(err, data){
          if ( err ) { mml_builder.delStyle(function() { done(err); }); return; }
          var xmlDoc = libxmljs.parseXmlString(data);
          var xpath = "//Filter";
          var x = xmlDoc.find(xpath);
          assert.equal(x.length, 2);
          var found = { '"': 0, "'": 0 };
          for (var i=0; i<2; ++i) {
            var f = x[i];
            var m = f.toString().match(/(['"])t(\\?)(["'])q(['"])/);
            assert.ok(m, "Unexpected filter: " + f.toString());
            assert.equal(m[1],m[4]); // opening an closing quotes are the same
            // internal quote must be different or escaped
            assert.ok(m[3] != m[1] || m[2] == '\\', 'Unescaped quote ' + m[3] + ' found: ' + f.toString());
          }
          mml_builder.delStyle(done);
        });
      });
  });

  test('base style and custom style keys do not affect each other', function(done) {
    var mml_store = new grainstore.MMLStore(redis_opts);
    var base_builder;
    var cust_builder;
    var style1 = "#tab { marker-fill: #111111; }";
    var style2 = "#tab { marker-fill: #222222; }";
    var style3 = "#tab { marker-fill: #333333; }";
    Step(
      function createBase() {
        base_builder = mml_store.mml_builder({dbname:'db', table:'tab'},
          this);
      },
      function setBaseStyle(err, data) {
        if ( err ) throw err;
        base_builder.setStyle(style1, this);
      },
      function createCustom(err, data) {
        if ( err ) throw err;
        cust_builder = mml_store.mml_builder({dbname:'db', table:'tab',
            style: style2}, this);
      },
      function checkRedis1(err, data) {
        if ( err ) throw err;
        var cb = this;
        redis_client.keys("map_style|db|tab*", function(err, matches) {
          if ( err ) { cb(err); return; }
          assert.equal(matches.length, 1, 'Expected 1 keys, found ' + matches.join(', '));
          redis_client.get(matches[0], function(err, val) {
            if ( err ) { cb(err); return; }
            // base key has only style 
            var js = JSON.parse(val);
            assert.ok(js.hasOwnProperty('style'), 'base key has no style property');
            assert.ok(js.hasOwnProperty('version'), 'base key has no version property');
            cb(null);
          });
        });
      },
      function checkBase1(err, data) {
        if ( err ) throw err;
        var cb = this;
        base_builder.toXML(function(err, xml) {
          if ( err ) { cb(err); return; }
          var xmlDoc = libxmljs.parseXmlString(xml);
          var color = xmlDoc.get("//@fill");
          assert.equal(color.value(), '#111111');
          cb(null);
        });
      },
      function checkCustom1(err, data) {
        if ( err ) throw err;
        var cb = this;
        cust_builder.toXML(function(err, xml) {
          if ( err ) { cb(err); return; }
          var xmlDoc = libxmljs.parseXmlString(xml);
          var color = xmlDoc.get("//@fill");
          assert.equal(color.value(), '#222222');
          cb(null);
        });
      },
      function setCustStyle(err, data) {
        if ( err ) throw err;
        cust_builder.setStyle(style3, this);
      },
      function checkBase2(err, data) {
        if ( err ) throw err;
        var cb = this;
        base_builder.toXML(function(err, xml) {
          if ( err ) { cb(err); return; }
          var xmlDoc = libxmljs.parseXmlString(xml);
          var color = xmlDoc.get("//@fill");
          assert.equal(color.value(), '#111111');
          cb(null);
        });
      },
      function checkCustom2(err, data) {
        if ( err ) throw err;
        var cb = this;
        cust_builder.toXML(function(err, xml) {
          if ( err ) { cb(err); return; }
          var xmlDoc = libxmljs.parseXmlString(xml);
          var color = xmlDoc.get("//@fill");
          assert.equal(color.value(), '#333333');
          cb(null);
        });
      },
      function checkRedis2(err, data) {
        if ( err ) throw err;
        var cb = this;
        redis_client.keys("map_style|db|tab*", function(err, matches) {
          if ( err ) { cb(err); return; }
          //assert.equal(matches.length, 2, 'Expected 2 keys, found ' + matches.join(', '));
          matches = matches.sort(); // base first
          redis_client.get(matches[0], function(err, val) {
            if ( err ) { cb(err); return; }
            // base key has both style and XML 
            var js = JSON.parse(val);
            assert.ok(js.hasOwnProperty('style'), 'base key has no style property');
            assert.ok(js.hasOwnProperty('version'), 'base key has no version property');
            cb(null);
          });
        });
      },
      // Now set base style again...
      function setBaseStyle(err, data) {
        if ( err ) throw err;
        base_builder.setStyle(style3, this);
      },
      // ... and check that the custom style key was removed
      //     from redis (to ensure rebuilding the XML)
      function checkRedis3(err, data) {
        if ( err ) throw err;
        var cb = this;
        redis_client.keys("map_style|db|tab*", function(err, matches) {
          if ( err ) { cb(err); return; }
          // We expect ONLY the "base" key to exist now
          assert.equal(matches.length, 1);
          redis_client.get(matches[0], function(err, val) {
            if ( err ) { cb(err); return; }
            // base key has only style 
            var js = JSON.parse(val);
            assert.ok(js.hasOwnProperty('style'), 'base key has no style property');
            assert.ok(js.hasOwnProperty('version'), 'base key has no version property');
            cb(null);
          });
        });
      },
      function theEnd(err, data) {
        base_builder.delStyle(function() {
          done(err);
        });
      }
    );
  });

  test('can retrieve basic XML', function(done) {
    var mml_store = new grainstore.MMLStore(redis_opts);
    var mml_builder = mml_store.mml_builder({dbname: 'my_databaasez', table:'my_tablez'}, function() {
      mml_builder.toXML(function(err, data){
        var xmlDoc = libxmljs.parseXmlString(data);
        var sql = xmlDoc.get("//Parameter[@name='table']");
        assert.equal(sql.text(), "my_tablez");
        mml_builder.delStyle(done);
      });
    });
  });

  test('XML contains connection parameters', function(done) {
    var mml_store = new grainstore.MMLStore(redis_opts, {
        datasource: {
          user:'u', host:'h', port:'12', password:'p'
        }
    });
    var mml_builder = mml_store.mml_builder({dbname: 'd', table:'t'}, function() {
      mml_builder.toXML(function(err, data){
        assert.ok(data, err);
        var xmlDoc = libxmljs.parseXmlString(data);
        var node = xmlDoc.get("//Parameter[@name='user']");
        assert.equal(node.text(), "u");
        node = xmlDoc.get("//Parameter[@name='host']");
        assert.equal(node.text(), "h");
        node = xmlDoc.get("//Parameter[@name='port']");
        assert.equal(node.text(), "12");
        node = xmlDoc.get("//Parameter[@name='password']");
        assert.equal(node.text(), "p");
        mml_builder.delStyle(done);
      });
    });
  });

  test("can retrieve basic XML specifying sql", function(done){
    // TODO: use Step !
    var mml_store = new grainstore.MMLStore(redis_opts);
    var mml_builder = mml_store.mml_builder(
      {dbname: 'db', table:'tab', sql: "SELECT * FROM my_face"},
      function(err, data) {
        if ( err ) { done(err); return; }
        mml_builder.toXML(function(err, data){
          if ( err ) { done(err); return; }
          var xmlDoc = libxmljs.parseXmlString(data);
          var sql = xmlDoc.get("//Parameter[@name='table']");
          assert.equal(sql.text(), "SELECT * FROM my_face");
          // TODO: check redis status now
          var mml_builder2 = mml_store.mml_builder(
            {dbname: 'db', table:'tab'},
            function(err, data) {
              if ( err ) { done(err); return; }
              mml_builder2.toXML(function(err, data){
                if ( err ) { done(err); return; }
                // TODO: check redis status now
                var xmlDoc = libxmljs.parseXmlString(data);
                var sql = xmlDoc.get("//Parameter[@name='table']");
                assert.equal(sql.text(), "tab");
                // NOTE: there's no need to explicitly delete style
                //       of mml_builder because it is an extension
                //       of mml_builder2 (extended by SQL)
                mml_builder2.delStyle(done);
              });
            });
        });
      });
  });

  test("can retrieve basic XML specifying polygon default geom", function(done){
    var mml_store = new grainstore.MMLStore(redis_opts);
    var mml_builder = mml_store.mml_builder(
      {dbname: 'my_databaasez', table: 'my_polygon_tablez', geom_type: 'polygon'},
      function() {
        mml_builder.toXML(function(err, data){
          var xmlDoc = libxmljs.parseXmlString(data);
          var sql = xmlDoc.get("//Parameter[@name='table']");
          assert.equal(sql.text(), "my_polygon_tablez");
          var style = xmlDoc.get("//PolygonSymbolizer");
          assert.equal(style.attr('fill').value(), "#ff6600");
          mml_builder.delStyle(done);
        });
      });
  });

  test("bails out on unsupported geometry type with mapnik 2.0.x", function(done){
    var mml_store = new grainstore.MMLStore(redis_opts, {mapnik_version: '2.0.2'});
    var mml_builder = mml_store.mml_builder(
      {dbname: 'd', table: 't', geom_type: 'geometry'},
      function(err) {
        assert.ok(err);
        assert.equal(err.message, "No style available for geometry of type 'geometry'");
        mml_builder.delStyle(done);
      });
  });

  test("can set style and then retrieve XML", function(done){
    var mml_store = new grainstore.MMLStore(redis_opts);
    var mml_builder = mml_store.mml_builder({dbname: 'my_databaasez', table:'my_special_design'},
      function() {
        var style = "#my_special_design {\n  polygon-fill: #fff;\n}";
        mml_builder.setStyle(style, function(err, output){
          mml_builder.toXML(function(err, data){
            var xmlDoc = libxmljs.parseXmlString(data);
            var style = xmlDoc.get("//PolygonSymbolizer");
            assert.equal(style.attr('fill').value(), "#ffffff");
            mml_builder.delStyle(done);
          });
        });
      });
  });

  test("can set style and then retrieve XML specifying sql", function(done){
    var mml_store = new grainstore.MMLStore(redis_opts);
    var mml_builder = mml_store.mml_builder(
      {dbname: 'my_databaasez', table:'big_test', sql: "select * from my_fish"},
      function() {
        var style = "#big_test {\n  polygon-fill: #000;\n}";
        mml_builder.setStyle(style, function(err, output){
          mml_builder.toXML(function(err, data){
            var xmlDoc = libxmljs.parseXmlString(data);
            var style = xmlDoc.get("//PolygonSymbolizer");
            assert.equal(style.attr('fill').value(), "#000000");
            mml_builder.delStyle(done);
          });
        });
      });
  });

  test("can set style and then retrieve XML specifying sql, then update style and regenerate", function(done){
    var mml_store = new grainstore.MMLStore(redis_opts);
    var mml_builder = mml_store.mml_builder(
      {dbname: 'my_databaasez', table:'big_tester', sql: "select * from my_fish"},
      function() {
        var style = "#big_tester {\n  polygon-fill: #000;\n}";
        mml_builder.setStyle(style, function(err, output){
          mml_builder.toXML(function(err, data){
            var xmlDoc = libxmljs.parseXmlString(data);
            var style = xmlDoc.get("//PolygonSymbolizer");
            assert.equal(style.attr('fill').value(), "#000000");

            var style2 = "#big_tester {\n  polygon-fill: #999999;\n}";
            mml_builder.setStyle(style2, function(err, output){
              mml_builder.toXML(function(err, data){
                var xmlDoc = libxmljs.parseXmlString(data);
                var style = xmlDoc.get("//PolygonSymbolizer");
                assert.equal(style.attr('fill').value(), "#999999");
                mml_builder.delStyle(done);
              });
            });
          });
        });
      });
  });

  test('by default datasource has full webmercator extent', function(done) {
    var mml_store = new grainstore.MMLStore(redis_opts);
    var mml_builder = mml_store.mml_builder(
      {dbname: 'my_database', table:'my_table'},
      function() {
        var baseMML = mml_builder.baseMML();
        assert.ok(_.isArray(baseMML.Layer));
        assert.equal(baseMML.Layer[0].Datasource.extent, '-20037508.3,-20037508.3,20037508.3,20037508.3');
        mml_builder.delStyle(done);
      });
  });

  test('SRS in XML should use the "+init=epsg:xxx" form', function(done) {
    var mml_store = new grainstore.MMLStore(redis_opts);
    var mml_builder = mml_store.mml_builder(
      {dbname: 'my_databaasez', table:'my_tablez'},
      function() {
        mml_builder.toXML(function(err, data){
          if ( err ) { mml_builder.delStyle(function() { done(err); }); return; }
          var xmlDoc = libxmljs.parseXmlString(data);
          var srs = xmlDoc.get("//@srs");
          assert.equal(srs.value().indexOf("+init=epsg:"), 0,
            '"' + srs.value() + '" does not start with "+init=epsg:"');
          mml_builder.delStyle(done);
        });
      });
  });

  test('store, retrive and convert to XML a set of reference styles', function(done) {

    var cachedir = '/tmp/gt-' + process.pid;

    var styles = [
      // point-transform without point-file
      { cartocss: "#tab { point-transform: 'scale(0.9)'; }",
        xml_re: new RegExp(/PointSymbolizer transform="scale\(0.9\)"/) }
      ,
      // localize external resources
      { cartocss: "#tab { point-file: url('http://localhost:" + server_port + "/circle.svg'); }",
        xml_re: new RegExp('PointSymbolizer file="' + cachedir + '/cache/.*.svg"') }
      ,
      // localize external resources with a + in the url
      { cartocss: "#tab { point-file: url('http://localhost:" + server_port + "/+circle.svg'); }",
        xml_re: new RegExp('PointSymbolizer file="' + cachedir + '/cache/.*.svg"') }
      ,
      // transform marker-width and height from 2.0.0 to 2.1.0 resources with a + in the url
      { cartocss: "#tab { marker-width: 8; marker-height: 3; }",
        version: '2.0.0', target_version: '2.1.0',
        xml_re: new RegExp('MarkersSymbolizer width="16" height="6"') }
      ,
      // recognize mapnik-geometry-type
      { cartocss: "#tab [mapnik-geometry-type=3] { marker-placement:line; }",
        xml_re: new RegExp(/Filter.*\[mapnik::geometry_type\] = 3.*Filter/) }
      ,
      // properly encode & signs
      // see http://github.com/CartoDB/cartodb20/issues/137
      { cartocss: "#tab [f='&'] { marker-width: 8; }",
        xml_re: new RegExp(/<Filter>\(\[f\] = '&amp;'\)<\/Filter>/) }
    ];

    var StylesRunner = function(styles, done) {
      this.styles = styles;
      this.done = done;
      this.errors = [];
    };

    StylesRunner.prototype.runNext = function(err) {
      if ( err ) this.errors.push(err); 
      if ( ! this.styles.length ) {
        var err = this.errors.length ? new Error(this.errors) : null;
        // TODO: remove all from cachedir ?
        var mml_store = new grainstore.MMLStore(redis_opts, {cachedir: cachedir});
        var that = this;
        mml_store.purgeLocalizedResources(0, function(e) {
          if ( e ) console.log("Error purging localized resources: " + e);
          that.done(err);
        });
        return;
      }
      var that = this;
      var style_spec = this.styles.shift();
      var style = style_spec.cartocss;
      var style_out = style; 
      var style_version = style_spec.version || '2.0.2';
      var target_mapnik_version = style_spec.target_version || style_version;
      var xml_re = style_spec.xml_re;

      var mml_store = new grainstore.MMLStore(redis_opts, {cachedir: cachedir, mapnik_version: target_mapnik_version});
      var mml_builder = mml_store.mml_builder({dbname: 'db', table:'tab'}, function() {

        Step(
          function setStyle() {
            mml_builder.setStyle(style, this, style_version);
          },
          function getStyle(err, data) {
            if ( err ) {
              mml_builder.delStyle(function() {
                that.runNext(new Error('setStyle: ' + style + ': ' + err));
              });
              return;
            }
            mml_builder.getStyle(this);
          },
          function toXML(err, data) {
            if ( err ) {
              that.runNext(new Error('getStyle: ' + style + ': ' + err));
              return;
            }
            try { assert.equal(data.style, style_out); }
            catch (err) { 
              that.runNext(new Error('getStyle check: ' + style + ': ' + err));
              return;
            }
            mml_builder.toXML(this);
          },
          function finish(err, data) {
            var errs = [];
            if ( err ) errs.push(err);
            //console.log("toXML returned: "); console.dir(data);
            assert.ok(xml_re.test(data), 'toXML: ' + style + ': expected ' + xml_re + ' got:\n' + data);
            mml_builder.delStyle(function(err) {
              if ( err ) errs.push(err);
              if ( errs.length ) err = new Error('toXML: ' + style + ': ' + errs.join("\n"));
              that.runNext(err);
            });
          }
        );
      });
    }

    var runner = new StylesRunner(styles, done);
    runner.runNext();

  });

  // External resources are downloaded in isolation
  // See https://github.com/Vizzuality/grainstore/issues/60
  test('external resources are downloaded in isolation', function(done) {

      var style = "{ point-file: url('http://localhost:" + server_port + "/circle.svg'); }";
      var cachedir = '/tmp/gt1-' + process.pid;

      var cdir1 = cachedir + '1';
      var style1 = '#t1 ' + style;
      var store1 = new grainstore.MMLStore(redis_opts, {cachedir: cdir1 });
      var re1 = new RegExp('PointSymbolizer file="' + cdir1 + '/cache/.*.svg"');

      var cdir2 = cachedir + '2';
      var style2 = '#t2 ' + style;
      var store2 = new grainstore.MMLStore(redis_opts, {cachedir: cdir2 });
      var re2 = new RegExp('PointSymbolizer file="' + cdir2 + '/cache/.*.svg"');

      var pending = 2;
      var err = [];
      var finish = function (e) {
          if ( e ) err.push(e.toString());
          if ( ! --pending ) {
            if ( err.length ) err = new Error(err.join('\n'));
            else err = null;
            done(err);
          }
      }

      var b1 = store1.mml_builder({dbname: 'd', table:'t1', style: style1}, function(e) {
        if ( e ) { finish(e); return; }
        b1.toXML(function(e, data){
          if ( e ) { finish(e); return; }
          try {
            assert.ok(re1.test(data), 'toXML: ' + style + ': expected ' + re1 + ' got:\n' + data);
          } catch (e) {
            err.push(e);
          }
          b1.delStyle(finish);
        });
      });

      var b2 = store2.mml_builder({dbname: 'd', table:'t2', style: style2}, function(e) {
        if ( e ) { finish(e); return; }
        b2.toXML(function(e, data){
          if ( e ) { finish(e); return; }
          try {
            assert.ok(re2.test(data), 'toXML: ' + style + ': expected ' + re2 + ' got:\n' + data);
          } catch (e) {
            err.push(e);
          }
          b2.delStyle(finish);
        });
      });

  });

  test('lost XML in base key triggers re-creation', function(done) {
    var mml_store = new grainstore.MMLStore(redis_opts);
    var mml_builder0, mml_builder, xml0;
    Step (
      function builder0() {
        mml_builder0 = mml_store.mml_builder({dbname: 'db', table:'tab'}, this);
      },
      function getXML0(err) {
        if ( err ) { done(err); return; }
        mml_builder0.toXML(this)
      },
      function dropXML0(err, data) {
        if ( err ) { done(err); return; }
        xml0 = data;
        dropXMLFromStore("map_style|db|tab", this);
      },
      function builder1(err, val) {
        if ( err ) { done(err); return; }
        mml_builder = mml_store.mml_builder({dbname: 'db', table:'tab'}, this);
      },
      function getXML1(err) {
        if ( err ) { done(err); return; }
        mml_builder.toXML(this);
      },
      function checkXML(err, data) {
        if ( err ) { done(err); return; }
        assert.equal(data, xml0);
        mml_builder.delStyle(done);
      }
    );
  });

  test('resetStyle can re-write converted versions', function(done) {
    var mml_store = new grainstore.MMLStore(redis_opts, {mapnik_version: "2.1.0"});
    var mml_builder;
    var style_input = "#t { marker-width:2 }";
    var style_converted = '#t { marker-width:4; ["mapnik::geometry_type"=1] { marker-placement:point; marker-type:ellipse; } ["mapnik::geometry_type">1] { marker-placement:line; marker-type:arrow; marker-transform:scale(.5, .5); marker-clip:false; } }';

    Step(
      function initBuilder() {
        mml_builder = mml_store.mml_builder({dbname: 'db', table:'t'}, this);
      },
      function setStyle(err) {
        if ( err ) { done(err); return; }
        mml_builder.setStyle(style_input, this, '2.0.2');
      },
      function resetStyle(err, data) {
        if ( err ) { mml_builder.delStyle(function() { done(err); }); }
        else mml_builder.resetStyle(this, true);
      },
      function getStyle(err, data) {
        if ( err ) { mml_builder.delStyle(function() { done(err); }); return; }
        else mml_builder.getStyle(this);
      },
      function checkStyle(err, data) {
        if ( err ) { mml_builder.delStyle(function() { done(err); }); return; }
        assert.equal(data.style, style_converted );
        assert.equal(data.version, '2.1.0');
        mml_builder.delStyle(done);
      }
    );
  });

  // See https://github.com/Vizzuality/grainstore/issues/26
  test('deletes all related keys', function(done) {
    var mml_store = new grainstore.MMLStore(redis_opts, {mapnik_version: "2.1.0"});
    var mml_builder;
    Step(
      function initBuilder() {
        mml_builder = mml_store.mml_builder({dbname: 'db', table:'t', sql:'select * from test_table'}, this);
      },
      function initBuilder2(err) {
        if ( err ) { done(err); return; }
        mml_builder = mml_store.mml_builder({dbname: 'db', table:'t', sql:'select * from test_table limit 1'}, this);
      },
      function initBuilder3(err) {
        if ( err ) { done(err); return; }
        mml_builder = mml_store.mml_builder({dbname: 'db', table:'t'}, this);
      },
      function checkRedis0(err, data) {
        if ( err ) { done(err); return; }
        var next = this;
        redis_client.keys("map_style|db|t*", function(err, matches) {
            assert.equal(matches.length, 1);
            next();
        });
      },
      function delStyle(err, data) {
        if ( err ) { mml_builder.delStyle(function() { done(err); }); }
        mml_builder.delStyle(this);
      },
      function checkRedis(err, data) {
        if ( err ) { done(err); return; }
        redis_client.keys("map_style|*", function(err, matches) {
            assert.equal(matches.length, 0);
            done();
        });
      }
    );
  });

  // See http://github.com/Vizzuality/grainstore/issues/27
  test('init does not override setStyle work', function(done) {
    var mml_store0 = new grainstore.MMLStore(redis_opts, {mapnik_version: "2.0.2"});
    var mml_store1 = new grainstore.MMLStore(redis_opts, {mapnik_version: "2.1.0"});
    var mml_builder0, mml_builder1;
    var ready = false;
    var completed = [];
    // Make a big style, so that setStyle takes a lot
    var style = '#t { ';
    for (var i=0; i<6000; ++i)
      style += 'marker-width: 6.2; marker-height: 7.2;'
            +  'marker-width: 3.3; marker-height: 5.1;'
            +  'marker-width: 2.4; marker-height: 5.5;';
    style += '}';

    var checkWhenReady = function() {
      if ( ! ready ) {
        setTimeout(checkWhenReady, 100); // check again in 0.1 secs
        return;
      }
      // Check that redis contains the set style
      redis_client.get('map_style|db|t', function(err, val) {
        if ( err ) { done(err); return; }
        val = JSON.parse(val);
        // Check processing order is as expected
        try {
          assert.equal(completed.join(','), 'get,set');
        } catch (e) {
          console.warn("NOTE: Could not produce a race (" + completed.join(',') + ")");
          mml_builder0.delStyle(done);
          return;
        }
        // Check that current redis contains SET style
        assert.equal(val.style.length, style.length, "mml_builder initialization won the race against setStyle");
        mml_builder0.delStyle(done);
      });
    }

    Step(
      function initBuilder0() {
        mml_builder0 = mml_store0.mml_builder({dbname: 'db', table:'t'}, this);
      },
      function setStyle_and_initBuilder1(err) {
        if ( err ) { done(err); return; }
        mml_builder0.setStyle(style, function(err, out) {
          if ( err ) { done(err); return; }
          completed.push('set');
          checkWhenReady();
        });
        // NOTE: intentionally initializing BEFORE waiting for setStyle above
        mml_builder1 = mml_store1.mml_builder({dbname: 'db', table:'t'}, function(err) {
          if ( err ) { done(err); return; }
          completed.push('get');
          ready = true;
        });
      }
    );
  });

  test('store a good style with version 2.0.2 and retrieve it converted', function(done) {
    var style = "#t { marker-width: 3; }";
    var style_converted = '#t { marker-width:6; ["mapnik::geometry_type"=1] { marker-placement:point; marker-type:ellipse; } ["mapnik::geometry_type">1] { marker-placement:line; marker-type:arrow; marker-transform:scale(.5, .5); marker-clip:false; } }';
    var mml_store = new grainstore.MMLStore(redis_opts, {mapnik_version: '2.1.0'});
    var mml_builder = mml_store.mml_builder({dbname: 'my_database', table:'t'}, function() {
      mml_builder.setStyle(style, function(err, output){
        if ( err ) { done(err); return; }
        mml_builder.getStyle(function(err, data){
          if ( err ) { done(err); return; }
          assert.equal(data.style, style_converted);
          assert.equal(data.version, '2.1.0');
          mml_builder.delStyle(done);
        }, true); // NOTE: true means _do_convert_ !
      }, '2.0.2', false); // NOTE: false means _do_not_convert_ !
    });
  });

  // See https://github.com/Vizzuality/grainstore/issues/62
  test('throws useful error message on invalid text-name', function(done) {
    var style = "#t { text-name: invalid; text-face-name:'Dejagnu'; }";
    var mml_store = new grainstore.MMLStore(redis_opts, {mapnik_version: '2.1.0'});
    var mml_builder = mml_store.mml_builder({dbname: 'd', table:'t', style:style}, function(err) {
        assert.ok(err);
        var re = new RegExp(/Invalid value for text-name/);
        assert.ok(err.message.match(re), 'No match for ' + re + ' in "' + err.message + '"');
        done();
    });
  });

  test('use exponential in filters', function(done) {
    var style =  "#t[a=1.2e-3] { polygon-fill: #000000; }";
        style += "#t[b=1.2e+3] { polygon-fill: #000000; }";
        style += "#t[c=2.3e4] { polygon-fill: #000000; }";
    var mml_store = new grainstore.MMLStore(redis_opts, {mapnik_version: '2.1.0'});
    var mml_builder;
    Step(
      function initBuilder() {
        mml_builder = mml_store.mml_builder({dbname: 'd2', table:'t', style:style, style_version:'2.1.0'}, this);
      },
      function getXML(err, data) {
        if ( err ) throw err;
        mml_builder.toXML(this);
      },
      function checkXML(err, data) {
        if ( err ) throw err;
        var xmlDoc = libxmljs.parseXmlString(data);
        var node = xmlDoc.find("//Filter");
        assert.equal(node.length, 3);
        for (var i=0; i<node.length; i++) {
          var txt = node[i].text();
          if ( txt.match(/\[a\] =/) ) {
            assert.equal(txt, '([a] = 0.0012)');
          }
          else if ( txt.match(/\[b\] =/) ) {
            assert.equal(txt, '([b] = 1200)');
          }
          else if ( txt.match(/\[c\] =/) ) {
            assert.equal(txt, '([c] = 23000)');
          }
          else {
            assert.fail("No match for " + txt);
          }
        }
        return null;
      },
      function finish(err) {
        if ( mml_builder ) mml_builder.delStyle(function() { done(err); });
        else done(err);
      }
    );
  });

  // See https://github.com/CartoDB/grainstore/issues/71
  test('can construct mml_builder when invalid CartoCSS is found in redis',
  function(done) {
    var base_key = 'map_style|d|t';
    var style = '#t {bogus}';
    // NOTE: we need mapnik_version to be != 2.0.0 
    var mml_store = new grainstore.MMLStore(redis_opts, {mapnik_version: '2.1.0'});
    var builder;
    var error_expected = false;
    Step(
      function setupRedisBase() {
        redis_client.set(base_key,
          JSON.stringify({ style: style }),
        this);
      },
      function initBuilder() {
        builder = mml_store.mml_builder({dbname: 'd', table:'t'}, this);
      },
      function checkInit_getXML(err, b) {
        if ( err ) throw err;
        assert.ok(b);
        error_expected = true;
        builder.toXML(this);
      },
      function checkXML_setStyle(err) {
        if ( err && ! error_expected ) throw err;
        error_expected = false;
        assert.ok(err);
        assert.ok(err.message.match(/bogus/), err.message);
        builder.setStyle('#t {line-color:red}', this);
      },
      function getGoodXML(err) {
        if ( err ) throw err;
        builder.toXML(this);
      },
      function checkGoodXML(err, xml) {
        if ( err ) throw err;
        assert.ok(xml);
        assert.ok(xml.match(/LineSymbolizer/), xml);
        return null;
      },
      function finish(err) {
        if ( builder ) builder.delStyle(function() { done(err); });
        else done(err);
      }
    );
  });

  // See https://github.com/CartoDB/grainstore/issues/72
  test('invalid fonts are complained about',
  function(done) {
    var error_expected = false;
    var mml_store = new grainstore.MMLStore(redis_opts, {
      mapnik_version: '2.1.0',
      carto_env: {
        validation_data: {
          fonts: ['Dejagnu','good']
        }
      }
    });
    var builder;
    Step(
      function initBuilder() {
        builder = mml_store.mml_builder({dbname: 'd', table:'t'}, this);
      },
      function setGoodFont(err, b) {
        if ( err ) throw err;
        assert.ok(b);
        builder.setStyle(
          '#t{text-name:[a]; text-face-name:"good";}',
          this);
      },
      function setBogusFont(err) {
        if ( err ) throw err;
        error_expected = true;
        builder.setStyle(
          "#t { text-name:[a]; text-face-name:'bogus_font'; }",
          this);
      },
      function checkBogusFont(err) {
        if ( err && ! error_expected ) throw err;
        error_expected = false;
        assert.ok(err, "no error raised when using bogus font");
        assert.ok(err.message.match(/Invalid.*text-face-name.*bogus_font/), err);
        return null;
      },
      function finish(err) {
        if ( builder ) builder.delStyle(function() { done(err); });
        else done(err);
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
