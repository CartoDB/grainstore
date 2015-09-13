var assert     = require('assert');
var _          = require('underscore');
var grainstore = require('../lib/grainstore');
var libxmljs   = require('libxmljs');
var step       = require('step');
var http       = require('http');
var fs         = require('fs');

var server;

var server_port = 8033;

var DEFAULT_POINT_STYLE = [
    '#layer {',
    '  marker-fill: #FF6600;',
    '  marker-opacity: 1;',
    '  marker-width: 16;',
    '  marker-line-color: white;',
    '  marker-line-width: 3;',
    '  marker-line-opacity: 0.9;',
    '  marker-placement: point;',
    '  marker-type: ellipse;',
    '  marker-allow-overlap: true;',
    '}'
].join('');

var SAMPLE_SQL = 'SELECT ST_MakePoint(0,0)';

suite('mml_builder', function() {

  suiteSetup(function(done) {
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

  suiteTeardown(function() {
    server.close();
  });

    test('can generate base mml with normal ops', function(done) {
        var mml_store = new grainstore.MMLStore();
        var mml_builder = mml_store.mml_builder({dbname: 'my_database', sql: SAMPLE_SQL, style: DEFAULT_POINT_STYLE});
        var baseMML = mml_builder.baseMML();

        assert.ok(_.isArray(baseMML.Layer));
        assert.equal(baseMML.Layer[0].id, 'layer0');
        assert.equal(baseMML.Layer[0].Datasource.dbname, 'my_database');

        done();
    });

    test('can be initialized with custom style and version', function(done) {
        var mml_store = new grainstore.MMLStore({mapnik_version: '2.1.0'});
        mml_store.mml_builder({dbname: 'd', sql: SAMPLE_SQL, style: DEFAULT_POINT_STYLE, style_version: '2.0.2' })
            .toXML(done);
    });

    test('can be initialized with custom interactivity', function(done) {
        var mml_store = new grainstore.MMLStore({mapnik_version: '2.1.0'});
        mml_store.mml_builder({dbname: 'd', sql: SAMPLE_SQL, style: DEFAULT_POINT_STYLE, interactivity: 'cartodb_id' })
            .toXML(done);
    });

    test('can generate base mml with overridden authentication', function(done) {
        var mml_store = new grainstore.MMLStore({
            datasource: {
                user:'overridden_user',
                password:'overridden_password'
            }}
        );
        var mml_builder = mml_store.mml_builder({
                dbname: 'my_database',
                sql: SAMPLE_SQL, style: DEFAULT_POINT_STYLE,
                // NOTE: authentication tokens here are silently discarded
                user:'shadow_user', password:'shadow_password'
        });
        var baseMML = mml_builder.baseMML();

        assert.ok(_.isArray(baseMML.Layer));
        assert.equal(baseMML.Layer[0].id, 'layer0');
        assert.equal(baseMML.Layer[0].Datasource.dbname, 'my_database');
        assert.equal(baseMML.Layer[0].Datasource.user, 'overridden_user');
        assert.equal(baseMML.Layer[0].Datasource.password, 'overridden_password');

        done();
    });

    test('search_path is set in the datasource', function(done) {
        var search_path = "'foo', 'bar'";
        var mml_store = new grainstore.MMLStore();
        var mml_builder = mml_store.mml_builder(
            {dbname: 'my_database', sql: SAMPLE_SQL, style: DEFAULT_POINT_STYLE, search_path: search_path}
        );

        var baseMML = mml_builder.baseMML();
        assert.equal(baseMML.Layer[0].Datasource.search_path, search_path);
        done();
    });

    test('search_path is NOT set in the datasource', function(done) {
        var mml_store = new grainstore.MMLStore();
        var mml_builder = mml_store.mml_builder(
            {dbname: 'my_database', sql: SAMPLE_SQL, style: DEFAULT_POINT_STYLE, search_path: null}
        );
        var baseMML = mml_builder.baseMML();
        assert.ok(
            !baseMML.Layer[0].Datasource.hasOwnProperty('search_path'),
            "search_path was not expected in the datasource but was found with value: " +
                baseMML.Layer[0].Datasource.search_path
        );
        done();
    });

    test('default format is png', function(done) {
        var mml_store = new grainstore.MMLStore();
        var mml_builder = mml_store.mml_builder({dbname: 'my_database', sql: SAMPLE_SQL, style: DEFAULT_POINT_STYLE});
        var baseMML = mml_builder.baseMML();
        assert.equal(baseMML.format, 'png');
        done();
    });

    test('format can be overwritten with optional args', function(done) {
        var format = 'png32';
        var mml_store = new grainstore.MMLStore({mapnik_tile_format: format});
        var mml_builder = mml_store.mml_builder({dbname: 'my_database', sql: SAMPLE_SQL, style: DEFAULT_POINT_STYLE});
        var baseMML = mml_builder.baseMML();
        assert.equal(baseMML.format, format);
        done();
    });

    test('can override authentication with mml_builder constructor', function(done) {
        var mml_store = new grainstore.MMLStore({
            datasource: { user:'shadow_user', password:'shadow_password' }});
        var mml_builder = mml_store.mml_builder({
                dbname: 'my_database',
                sql: SAMPLE_SQL, style: DEFAULT_POINT_STYLE,
                dbuser:'overridden_user', dbpassword:'overridden_password' }
        );

        var baseMML = mml_builder.baseMML();

        assert.ok(_.isArray(baseMML.Layer));
        assert.equal(baseMML.Layer[0].id, 'layer0');
        assert.equal(baseMML.Layer[0].Datasource.dbname, 'my_database');
        assert.equal(baseMML.Layer[0].Datasource.user, 'overridden_user');
        assert.equal(baseMML.Layer[0].Datasource.password, 'overridden_password');

        // Test that new mml_builder, with no overridden user/password, uses the default ones
        var mml_builder2 = mml_store.mml_builder({dbname:'my_database', sql: SAMPLE_SQL, style: DEFAULT_POINT_STYLE});
        var baseMML2 = mml_builder2.baseMML();
        assert.equal(baseMML2.Layer[0].id, 'layer0');
        assert.equal(baseMML2.Layer[0].Datasource.dbname, 'my_database');
        assert.equal(baseMML2.Layer[0].Datasource.user, 'shadow_user');
        assert.equal(baseMML2.Layer[0].Datasource.password, 'shadow_password');

        done();
    });

    // See https://github.com/CartoDB/grainstore/issues/70
    test('can override db host and port with mml_builder constructor', function(done) {
        var mml_store = new grainstore.MMLStore({
            datasource: { host:'shadow_host', port:'shadow_port' }});
        var mml_builder = mml_store.mml_builder({
                dbname: 'my_database',
                sql: SAMPLE_SQL, style: DEFAULT_POINT_STYLE,
                dbhost:'overridden_host', dbport:'overridden_port' }
        );

        var baseMML = mml_builder.baseMML();

        assert.ok(_.isArray(baseMML.Layer));
        assert.equal(baseMML.Layer[0].id, 'layer0');
        assert.equal(baseMML.Layer[0].Datasource.dbname, 'my_database');
        assert.equal(baseMML.Layer[0].Datasource.host, 'overridden_host');
        assert.equal(baseMML.Layer[0].Datasource.port, 'overridden_port');

        // Test that new mml_builder, with no overridden user/password, uses the default ones
        var mml_builder2 = mml_store.mml_builder({dbname:'my_database', sql: SAMPLE_SQL, style: DEFAULT_POINT_STYLE});
        var baseMML2 = mml_builder2.baseMML();
        assert.equal(baseMML2.Layer[0].id, 'layer0');
        assert.equal(baseMML2.Layer[0].Datasource.dbname, 'my_database');
        assert.equal(baseMML2.Layer[0].Datasource.host, 'shadow_host');
        assert.equal(baseMML2.Layer[0].Datasource.port, 'shadow_port');

        done();
    });

    test('can generate base mml with sql ops, maintain id', function(done) {
        var mml_store = new grainstore.MMLStore();
        var mml_builder = mml_store.mml_builder(
            {dbname: 'my_database', sql: 'SELECT * from my_table', style: DEFAULT_POINT_STYLE}
        );
        var baseMML = mml_builder.baseMML();
        assert.equal(baseMML.Layer[0].id, 'layer0');
        assert.equal(baseMML.Layer[0].Datasource.table, 'SELECT * from my_table');
        done();
    });

    test('can force plain base mml with sql ops', function(done) {
        var mml_store = new grainstore.MMLStore();
        var mml_builder = mml_store.mml_builder(
            {dbname: 'my_database', sql: SAMPLE_SQL, style: DEFAULT_POINT_STYLE}
        );
        var baseMML = mml_builder.baseMML();
        assert.equal(baseMML.Layer[0].id, 'layer0');
        assert.equal(baseMML.Layer[0].Datasource.table, SAMPLE_SQL);
        done();
    });

  test('can generate full mml with style', function(done) {
    var mml_store = new grainstore.MMLStore();
    var mml_builder = mml_store.mml_builder({dbname: 'my_database', sql: SAMPLE_SQL, style: DEFAULT_POINT_STYLE});
    var mml = mml_builder.toMML("my carto style");
    assert.equal(mml.Stylesheet[0].data, 'my carto style');
    done();
  });

  test('can render XML from full mml with style', function(done) {
    var mml_store = new grainstore.MMLStore();
    var mml_builder = mml_store.mml_builder(
        {dbname: 'my_database', sql:'my_table', style: "#my_table {\n  polygon-fill: #fff;\n}"}
    );
    mml_builder.toXML(function(err, output){
        assert.ok(_.isNull(err), _.isNull(err) ? '' : err.message);
        assert.ok(output);
        done();
    });
  });

  test('Render a 2.2.0 style', function(done) {
    var style = "#t { polygon-fill: #fff; }";
    var mml_store = new grainstore.MMLStore({mapnik_version: '2.2.0'});
    mml_store.mml_builder({dbname: 'd', sql: SAMPLE_SQL, style: style}).toXML(function(err, output) {
        try {
          assert.ok(_.isNull(err), _.isNull(err) ? '' : err.message);
          assert.ok(output);
          var xmlDoc = libxmljs.parseXmlString(output);
          //assert.equal(output, '');
          var srs = xmlDoc.get("//PolygonSymbolizer/@fill");
          assert.equal(srs.value(), '#ffffff');
          done();
        } catch (err) { done(err); }
    });
  });

  test('can render errors from full mml with bad style', function(done) {
    var mml_store = new grainstore.MMLStore();
    mml_store.mml_builder(
        {dbname: 'my_database', sql: SAMPLE_SQL, style: "#my_table {\n  backgrxxxxxound-color: #fff;\n}"}
    ).toXML(function(err) {
        assert.ok(err.message.match(/Unrecognized rule/), err.message);
        done();
    });
  });

  test('can render multiple errors from full mml with bad style', function(done) {
    var mml_store = new grainstore.MMLStore();
    mml_store.mml_builder(
        {dbname: 'my_database', sql: SAMPLE_SQL, style: "#my_table {\n  backgrxxound-color: #fff;bad-tag: #fff;\n}"}
    ).toXML(
        function(err) {
            assert.ok(err.message.match(/Unrecognized rule[\s\S]*Unrecognized rule/), err.message);
            done();
        }
    );
  });

    test('retrieves a dynamic style should return XML with dynamic style', function(done) {
        var mml_store = new grainstore.MMLStore();
        mml_store.mml_builder({dbname: 'my_databaasez', sql:'my_tablez', style: '#my_tablez {marker-fill: #000000;}'})
            .toXML(function(err, data){
                if ( err ) { return done(err); }
                var xmlDoc = libxmljs.parseXmlString(data);
                var color = xmlDoc.get("//@fill");
                assert.equal(color.value(), "#000000");
                done();
            });
    });

  test('includes interactivity in XML', function(done) {
    var mml_store = new grainstore.MMLStore();
    mml_store.mml_builder(
      { dbname: 'd2', sql: SAMPLE_SQL, style: DEFAULT_POINT_STYLE,
        interactivity: 'a,b'
      }).toXML(function(err, data){
          if ( err ) { return done(err); }
          var xmlDoc = libxmljs.parseXmlString(data);
          var x = xmlDoc.get("//Parameter[@name='interactivity_layer']");
          assert.ok(x);
          assert.equal(x.text(), "layer0");
          x = xmlDoc.get("//Parameter[@name='interactivity_fields']");
          assert.ok(x);
          assert.equal(x.text(), "a,b");
          done();
      });
  });

  // See https://github.com/Vizzuality/grainstore/issues/61
  test('zoom variable is special', function(done) {
    var mml_store = new grainstore.MMLStore();
    mml_store.mml_builder(
      { dbname: 'd', sql: SAMPLE_SQL,
        style: '#t [ zoom  >=  4 ] {marker-fill:red;}'
      }).toXML(function(err, data){
          if ( err ) { return done(err); }
          var xmlDoc = libxmljs.parseXmlString(data);
          var xpath = "//MaxScaleDenominator";
          var x = xmlDoc.get(xpath);
          assert.ok(x, "Xpath '" + xpath + "' does not match " + xmlDoc);
          assert.equal(x.text(), "50000000");
          done();
      });
  });

  test('quotes in CartoCSS are accepted', function(done) {
    var mml_store = new grainstore.MMLStore();
    mml_store.mml_builder(
      { dbname: 'd', table:'t',
        sql: [ "select 'x' as n, 'SRID=3857;POINT(0 0)'::geometry as the_geom_webmercator",
               "select 'x' as n, 'SRID=3857;POINT(2 0)'::geometry as the_geom_webmercator" ],
        style: [ '#t [n="t\'q"] {marker-fill:red;}', '#t[n=\'t"q\'] {marker-fill:green;}' ]
      }).toXML(function(err, data){
          if ( err ) { return done(err); }
          var xmlDoc = libxmljs.parseXmlString(data);
          var xpath = "//Filter";
          var x = xmlDoc.find(xpath);
          assert.equal(x.length, 2);
          for (var i=0; i<2; ++i) {
            var f = x[i];
            var m = f.toString().match(/(['"])t(\\?)(["'])q(['"])/);
            assert.ok(m, "Unexpected filter: " + f.toString());
            assert.equal(m[1],m[4]); // opening an closing quotes are the same
            // internal quote must be different or escaped
            assert.ok(m[3] !== m[1] || m[2] === '\\', 'Unescaped quote ' + m[3] + ' found: ' + f.toString());
          }
          done();
      });
  });

  test('base style and custom style keys do not affect each other', function(done) {
    var mml_store = new grainstore.MMLStore();
    var style1 = "#tab { marker-fill: #111111; }";
    var style2 = "#tab { marker-fill: #222222; }";
    var style3 = "#tab { marker-fill: #333333; }";
    var base_builder = mml_store.mml_builder({dbname:'db', sql:'tab', style: style1});
    var cust_builder = mml_store.mml_builder({dbname:'db', sql:'tab', style: style2});
    step(
      function checkBase1() {
        var cb = this;
        base_builder.toXML(function(err, xml) {
          if ( err ) { cb(err); return; }
          var xmlDoc = libxmljs.parseXmlString(xml);
          var color = xmlDoc.get("//@fill");
          assert.equal(color.value(), '#111111');
          cb(null);
        });
      },
      function checkCustom1(err) {
        if ( err ) {
            throw err;
        }
        var cb = this;
        cust_builder.toXML(function(err, xml) {
          if ( err ) { cb(err); return; }
          var xmlDoc = libxmljs.parseXmlString(xml);
          var color = xmlDoc.get("//@fill");
          assert.equal(color.value(), '#222222');
          cb(null);
        });
      },
      function checkCustom2(err) {
        if ( err ) {
            throw err;
        }
        var cb = this;
        mml_store.mml_builder({dbname:'db', sql:'tab', style: style3}).toXML(function(err, xml) {
          if ( err ) { cb(err); return; }
          var xmlDoc = libxmljs.parseXmlString(xml);
          var color = xmlDoc.get("//@fill");
          assert.equal(color.value(), '#333333');
          done();
        });
      }
    );
  });

  test('can retrieve basic XML', function(done) {
    var mml_store = new grainstore.MMLStore();
    mml_store.mml_builder({dbname: 'my_databaasez', sql: SAMPLE_SQL, style: DEFAULT_POINT_STYLE})
        .toXML(function(err, data){
            var xmlDoc = libxmljs.parseXmlString(data);
            var sql = xmlDoc.get("//Parameter[@name='table']");
            assert.equal(sql.text(), SAMPLE_SQL);
            done();
        });
  });

  test('XML contains connection parameters', function(done) {
    var mml_store = new grainstore.MMLStore({
        datasource: {
          user:'u', host:'h', port:'12', password:'p'
        }
    });
    mml_store.mml_builder({dbname: 'd', sql: SAMPLE_SQL, style: DEFAULT_POINT_STYLE}).toXML(function(err, data){
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
        done();
    });
  });

  test("can retrieve basic XML specifying sql", function(done){
    var mml_store = new grainstore.MMLStore();
    mml_store.mml_builder({dbname: 'db', table:'tab', sql: "SELECT * FROM my_face", style: DEFAULT_POINT_STYLE})
        .toXML(function(err, data){
          if ( err ) { done(err); return; }
          var xmlDoc = libxmljs.parseXmlString(data);
          var sql = xmlDoc.get("//Parameter[@name='table']");
          assert.equal(sql.text(), "SELECT * FROM my_face");
          mml_store.mml_builder({dbname: 'db', sql: "tab", style: DEFAULT_POINT_STYLE}).toXML(function(err, data){
                if ( err ) { done(err); return; }
                var xmlDoc = libxmljs.parseXmlString(data);
                var sql = xmlDoc.get("//Parameter[@name='table']");
                assert.equal(sql.text(), "tab");
                // NOTE: there's no need to explicitly delete style
                //       of mml_builder because it is an extension
                //       of mml_builder2 (extended by SQL)
                done();
          });
        });
  });

  test('by default datasource has full webmercator extent', function(done) {
    var mml_store = new grainstore.MMLStore();
    var mml_builder = mml_store.mml_builder(
        {dbname: 'my_database', sql: "SELECT * FROM my_face", style: DEFAULT_POINT_STYLE}
    );
    var baseMML = mml_builder.baseMML();
    assert.ok(_.isArray(baseMML.Layer));
    assert.equal(baseMML.Layer[0].Datasource.extent, '-20037508.3,-20037508.3,20037508.3,20037508.3');
    done();
  });

  test('SRS in XML should use the "+init=epsg:xxx" form', function(done) {
    var mml_store = new grainstore.MMLStore();
    mml_store.mml_builder({dbname: 'my_databaasez', sql: "SELECT * FROM my_face", style: DEFAULT_POINT_STYLE})
        .toXML(function(err, data){
          if ( err ) { return done(err); }
          var xmlDoc = libxmljs.parseXmlString(data);
          var srs = xmlDoc.get("//@srs");
          assert.equal(srs.value().indexOf("+init=epsg:"), 0,
            '"' + srs.value() + '" does not start with "+init=epsg:"');
          done();
      });
  });

  test('store, retrive and convert to XML a set of reference styles', function(done) {

    var cachedir = '/tmp/gt-' + process.pid;

    var styles = [
        // point-transform without point-file
        {
            cartocss: "#tab { point-transform: 'scale(0.9)'; }",
            xml_re: /PointSymbolizer transform="scale\(0.9\)"/
        },
        // localize external resources
        {
            cartocss: "#tab { point-file: url('http://localhost:" + server_port + "/circle.svg'); }",
            xml_re: new RegExp('PointSymbolizer file="' + cachedir + '/cache/.*.svg"')
        },
        // localize external resources with a + in the url
        {
            cartocss: "#tab { point-file: url('http://localhost:" + server_port + "/+circle.svg'); }",
            xml_re: new RegExp('PointSymbolizer file="' + cachedir + '/cache/.*.svg"')
        },
        // transform marker-width and height from 2.0.0 to 2.1.0 resources with a + in the url
        {
            cartocss: "#tab { marker-width: 8; marker-height: 3; }",
            version: '2.0.0', target_version: '2.1.0',
            xml_re: new RegExp('MarkersSymbolizer width="16" height="6"')
        },
        // recognize mapnik-geometry-type
        {
            cartocss: "#tab [mapnik-geometry-type=3] { marker-placement:line; }",
            xml_re: /Filter.*\[mapnik::geometry_type\] = 3.*Filter/
        },
        // properly encode & signs
        // see http://github.com/CartoDB/cartodb20/issues/137
        {
            cartocss: "#tab [f='&'] { marker-width: 8; }",
            xml_re: /<Filter>\(\[f\] = '&amp;'\)<\/Filter>/
        }
    ];

    var StylesRunner = function(styles, done) {
      this.styles = styles;
      this.done = done;
      this.errors = [];
    };

    StylesRunner.prototype.runNext = function(err) {
      if ( err ) {
          this.errors.push(err);
      }
      if ( ! this.styles.length ) {
        err = this.errors.length ? new Error(this.errors) : null;
        // TODO: remove all from cachedir ?
        mml_store = new grainstore.MMLStore({cachedir: cachedir});
        that = this;
        mml_store.purgeLocalizedResources(0, function(e) {
          if ( e ) {
              console.log("Error purging localized resources: " + e);
          }
          that.done(err);
        });
        return;
      }
      var that = this;
      var style_spec = this.styles.shift();
      var style = style_spec.cartocss;
      var style_version = style_spec.version || '2.0.2';
      var target_mapnik_version = style_spec.target_version || style_version;
      var xml_re = style_spec.xml_re;

      var mml_store = new grainstore.MMLStore({
          cachedir: cachedir,
          mapnik_version: target_mapnik_version,
          cachettl: 0.01
      });
      var mml_builder = mml_store.mml_builder({dbname: 'db', sql:'tab', style:style});
        step(
          function toXML() {
            mml_builder.toXML(this);
          },
          function finish(err, data) {
            var errs = [];
            if ( err ) {
                errs.push(err);
            }
            //console.log("toXML returned: "); console.dir(data);
            assert.ok(xml_re.test(data), 'toXML: ' + style + ': expected ' + xml_re + ' got:\n' + data);
            that.runNext(err);
          }
        );
    };

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
      var store1 = new grainstore.MMLStore({cachedir: cdir1 });
      var re1 = new RegExp('PointSymbolizer file="' + cdir1 + '/cache/.*.svg"');

      var cdir2 = cachedir + '2';
      var style2 = '#t2 ' + style;
      var store2 = new grainstore.MMLStore({cachedir: cdir2 });
      var re2 = new RegExp('PointSymbolizer file="' + cdir2 + '/cache/.*.svg"');

      var pending = 2;
      var err = [];
      var finish = function (e) {
          if ( e ) {
              err.push(e.toString());
          }
          if ( ! --pending ) {
            if ( err.length ) {
                err = new Error(err.join('\n'));
            }
            else {
                err = null;
            }
            done(err);
          }
      };

      var b1 = store1.mml_builder({dbname: 'd', sql:'t1', style: style1});
        b1.toXML(function(e, data){
          if ( e ) { finish(e); return; }
          try {
            assert.ok(re1.test(data), 'toXML: ' + style + ': expected ' + re1 + ' got:\n' + data);
          } catch (e) {
            err.push(e);
          }
          finish();
        });

      var b2 = store2.mml_builder({dbname: 'd', sql:'t2', style: style2});
        b2.toXML(function(e, data){
          if ( e ) { finish(e); return; }
          try {
            assert.ok(re2.test(data), 'toXML: ' + style + ': expected ' + re2 + ' got:\n' + data);
          } catch (e) {
            err.push(e);
          }
          finish();
        });
  });

  test('lost XML in base key triggers re-creation', function(done) {
    var mml_store = new grainstore.MMLStore();
    var mml_builder0 = mml_store.mml_builder({dbname: 'db', sql: "SELECT * FROM my_face", style: DEFAULT_POINT_STYLE}),
        mml_builder = mml_store.mml_builder({dbname: 'db', sql: "SELECT * FROM my_face", style: DEFAULT_POINT_STYLE}),
        xml0;
    step (
      function getXML0() {
        mml_builder0.toXML(this);
      },
      function dropXML0(err, data) {
        if ( err ) { done(err); return; }
        xml0 = data;
        return null;
      },
      function getXML1(err) {
        if ( err ) { done(err); return; }
        mml_builder.toXML(this);
      },
      function checkXML(err, data) {
        if ( err ) { done(err); return; }
        assert.equal(data, xml0);
        done();
      }
    );
  });

  // See https://github.com/Vizzuality/grainstore/issues/62
  test('throws useful error message on invalid text-name', function(done) {
    var style = "#t { text-name: invalid; text-face-name:'Dejagnu'; }";
    var mml_store = new grainstore.MMLStore({mapnik_version: '2.1.0'});
    mml_store.mml_builder({dbname: 'd', sql:'t', style:style}).toXML(function(err) {
        assert.ok(err);
        var re = /Invalid value for text-name/;
        assert.ok(err.message.match(re), 'No match for ' + re + ' in "' + err.message + '"');
        done();
    });
  });

  test('use exponential in filters', function(done) {
    var style =  "#t[a=1.2e-3] { polygon-fill: #000000; }";
        style += "#t[b=1.2e+3] { polygon-fill: #000000; }";
        style += "#t[c=2.3e4] { polygon-fill: #000000; }";
    var mml_store = new grainstore.MMLStore({mapnik_version: '2.1.0'});
    var mml_builder = mml_store.mml_builder({dbname: 'd2', sql:'t', style:style, style_version:'2.1.0'});
    step(
      function getXML() {
        mml_builder.toXML(this);
      },
      function checkXML(err, data) {
        if ( err ) {
            throw err;
        }
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
        return done(err);
      }
    );
  });

  test('can construct mml_builder', function(done) {
    var style = '#t {bogus}';
    // NOTE: we need mapnik_version to be != 2.0.0
    var mml_store = new grainstore.MMLStore({mapnik_version: '2.1.0'});
    mml_store.mml_builder({dbname: 'd', sql:'t', style: style}).toXML(
        function checkInit_getXML(err) {
            assert.ok(err.message.match(/bogus/), err.message);
            done();
        }
    );
  });

  // See https://github.com/CartoDB/grainstore/issues/72
  test('invalid fonts are complained about',
  function(done) {
    var mml_store = new grainstore.MMLStore({
      mapnik_version: '2.1.0',
      carto_env: {
        validation_data: {
          fonts: ['Dejagnu','good']
        }
      }
    });
    step(
      function checkGoodFont() {
        mml_store.mml_builder({dbname: 'd', sql:'t', style: '#t{text-name:[a]; text-face-name:"good";}'}).toXML(this);
      },
      function setGoodFont(err) {
        if ( err ) {
            throw err;
        }
        mml_store.mml_builder(
            {dbname: 'd', sql:'t', style: "#t { text-name:[a]; text-face-name:'bogus_font'; }"}
        ).toXML(this);
      },
      function setBogusFont(err) {
        assert.ok(err);
        assert.ok(err, "no error raised when using bogus font");
        assert.ok(err.message.match(/Invalid.*text-face-name.*bogus_font/), err);
        done();
      }
    );
  });

    test('should can set format after building the MML', function(done) {
        var mml_store = new grainstore.MMLStore();
        var mml = mml_store.mml_builder({
            dbname: 'my_databaasez',
            sql: SAMPLE_SQL,
            style: DEFAULT_POINT_STYLE
        });

        mml.set('grainstore_map', { format: 'png32' });

        mml.toXML(function (err, data) {
            var xmlDoc = libxmljs.parseXmlString(data);
            var format = xmlDoc.get("//Parameter[@name='format']");

            assert.equal(format.text(), 'png32');
            done();
        });
    });

    test('when setting a property not allowed should throw error', function () {
        var mml_store = new grainstore.MMLStore();
        var mml = mml_store.mml_builder({
            dbname: 'my_databaasez',
            sql: SAMPLE_SQL,
            style: DEFAULT_POINT_STYLE
        });

        assert.throws(function() {
            mml.set('toXML', { format: 'png32' });
        }, Error);
    });

});
