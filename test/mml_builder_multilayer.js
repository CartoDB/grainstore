var assert     = require('assert');
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

suite('mml_builder multilayer', function() {

  var queryMakeLine = 'SELECT ST_MakeLine(ST_MakePoint(-10,-5),ST_MakePoint(10,-5))';
  var queryMakePoint = 'SELECT ST_MakePoint(0,0)';

  var styleLine = "#layer1 { line-color:red; }";
  var stylePoint = "#layer0 { marker-width:3; }";

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

  test('accept sql array with style array', function(done) {
    var style0 = "#layer0 { marker-width:3; }";
    var style1 = "#layer1 { line-color:red; }";
    var mml_store = new grainstore.MMLStore({mapnik_version: '2.1.0'});

    step(
      function initBuilder() {
        mml_store.mml_builder({
              dbname: 'my_database',
              sql:['SELECT ST_MakePoint(0,0)','SELECT ST_MakeLine(ST_MakePoint(-10,-5),ST_MakePoint(10,-5))'],
              style: [style0, style1],
              style_version:'2.1.0'
            }).toXML(this);
      },
      function checkXML0(err, xml) {
          if ( err ) { done(err); return; }
          var xmlDoc = libxmljs.parseXmlString(xml);

          var layer0 = xmlDoc.get("Layer[@name='layer0']");
          assert.ok(layer0, "Layer0 not found in XML");

          var gf0 = layer0.get("Datasource/Parameter[@name='geometry_field']");
          assert.ok(gf0, "geometry_field for layer0 not found in XML");
          assert.equal(gf0.text(), "the_geom_webmercator"); // default

          var layer1 = xmlDoc.get("Layer[@name='layer1']");
          assert.ok(layer1, "Layer1 not found in XML");

          var gf1 = layer1.get("Datasource/Parameter[@name='geometry_field']");
          assert.ok(gf1, "geometry_field for layer1 not found in XML");
          assert.equal(gf1.text(), "the_geom_webmercator"); // default

          var style0 = xmlDoc.get("Style[@name='layer0']");
          assert.ok(style0, "Style for layer0 not found in XML");

          var style1 = xmlDoc.get("Style[@name='layer1']");
          assert.ok(style1, "Style for layer1 not found in XML");

          done();
      }
    );
  });

  // See http://github.com/CartoDB/grainstore/issues/92
  test('accept sql array with style array and gcols array', function(done) {
    var style0 = "#layer0 { marker-width:3; }";
    var style1 = "#layer1 { line-color:red; }";
    var mml_store = new grainstore.MMLStore({mapnik_version: '2.1.0'});
    var mml_builder;

    step(
      function initBuilder() {
        mml_builder = mml_store.mml_builder({
              dbname: 'my_database',
              sql:['SELECT ST_MakePoint(0,0) g','SELECT ST_MakeLine(ST_MakePoint(-10,-5),ST_MakePoint(10,-5)) g2'],
              style: [style0, style1],
              gcols: [,'g2'], // first intentionally blank
              style_version:'2.1.0'
            }).toXML(this);
      },
      function checkXML0(err, xml) {
          if ( err ) { done(err); return; }
          var xmlDoc = libxmljs.parseXmlString(xml);

          var layer0 = xmlDoc.get("Layer[@name='layer0']");
          assert.ok(layer0, "Layer0 not found in XML");

          var gf0 = layer0.get("Datasource/Parameter[@name='geometry_field']");
          assert.ok(gf0, "geometry_field for layer0 not found in XML");
          assert.equal(gf0.text(), "the_geom_webmercator"); // default

          var layer1 = xmlDoc.get("Layer[@name='layer1']");
          assert.ok(layer1, "Layer1 not found in XML");

          var gf1 = layer1.get("Datasource/Parameter[@name='geometry_field']");
          assert.ok(gf1, "geometry_field for layer1 not found in XML");
          assert.equal(gf1.text(), "g2");

          done();
      }
    );
  });

[
    [
        {type: 'geometry', name: 'g'},
        {type: 'raster', name: 'r'}
    ],
    [
        'g',
        {type: 'raster', name: 'r'}
    ],
    [
        {name: 'g'},
        {type: 'raster', name: 'r'}
    ]
].forEach(function(gcols) {
  // See http://github.com/CartoDB/grainstore/issues/93
  test('accept types in gcols', function(done) {
    var mml_store = new grainstore.MMLStore({mapnik_version: '2.1.0'});

    step(
      function initBuilder() {
        mml_store.mml_builder({
              dbname: 'my_database',
              sql:['SELECT ST_MakePoint(0,0) g',
                   'SELECT ST_AsRaster(ST_MakePoint(0,0),1.0,1.0) r'],
              style: [DEFAULT_POINT_STYLE, DEFAULT_POINT_STYLE],
              gcols: gcols,
              style_version:'2.1.0'
        }).toXML(this);
      },
      function checkXML0(err, xml) {
          if ( err ) { done(err); return; }
          var xmlDoc = libxmljs.parseXmlString(xml);

          var layer0 = xmlDoc.get("Layer[@name='layer0']");
          assert.ok(layer0, "Layer0 not found in XML");
          var ds0 = layer0.get("Datasource");
          assert.ok(ds0, "Datasource for layer0 not found in XML");
          var gf0 = ds0.get("Parameter[@name='geometry_field']");
          assert.equal(gf0.text(), "g", xmlDoc); 

          var layer1 = xmlDoc.get("Layer[@name='layer1']");
          assert.ok(layer1, "Layer1 not found in XML");
          var ds1 = layer1.get("Datasource");
          assert.ok(ds1, "Datasource for layer1 not found in XML: " + xmlDoc);
          var gf1 = ds1.get("Parameter[@name='raster_field']");
          assert.ok(gf1, "raster_field for layer1 not found in: " + ds1);
          assert.equal(gf1.text(), "r"); 
          var typ1 = ds1.get("Parameter[@name='type']");
          assert.equal(typ1.text(), "pgraster"); 
          assert.ok(! ds1.get("Parameter[@name='band']") );

          done();
      }
    );
  });
});


  // See http://github.com/CartoDB/grainstore/issues/93
  test('accept rcolbands and extra_ds_opts arrays', function(done) {
    var mml_store = new grainstore.MMLStore({mapnik_version: '2.1.0'});

    step(
      function initBuilder() {
        mml_store.mml_builder({
              dbname: 'my_database',
              sql:['SELECT ST_MakePoint(0,0) g',
                   'SELECT ST_AsRaster(ST_MakePoint(0,0),1.0,1.0) r',
                   'SELECT ST_AsRaster(ST_MakePoint(0,0),1.0,1.0) r2'],
              style: [DEFAULT_POINT_STYLE, DEFAULT_POINT_STYLE, DEFAULT_POINT_STYLE],
              gcols: [
                  {type: 'geometry', name: 'g'},
                  {type: 'raster', name: 'r'},
                  {type: 'raster', name: 'r2'}
              ],
              extra_ds_opts: [
                {'geometry_field':'fake'}, // will not override
                {'use_overviews':1, 'prescale_rasters':true},
                {'band':1,'clip_rasters':1}
              ],
              style_version:'2.1.0'
            }).toXML(this);
      },
      function checkXML0(err, xml) {
          if ( err ) { done(err); return; }
          var xmlDoc = libxmljs.parseXmlString(xml);

          var layer0 = xmlDoc.get("Layer[@name='layer0']");
          assert.ok(layer0, "Layer0 not found in XML");
          var ds0 = layer0.get("Datasource");
          assert.ok(ds0, "Datasource for layer0 not found in XML");
          var gf0 = ds0.get("Parameter[@name='geometry_field']");
          assert.equal(gf0.text(), "g", xmlDoc); 

          var layer1 = xmlDoc.get("Layer[@name='layer1']");
          assert.ok(layer1, "Layer1 not found in XML");
          var ds1 = layer1.get("Datasource");
          assert.ok(ds1, "Datasource for layer1 not found in XML: " + xmlDoc);
          var gf1 = ds1.get("Parameter[@name='raster_field']");
          assert.ok(gf1, "raster_field for layer1 not found in: " + ds1);
          assert.equal(gf1.text(), "r"); 
          var typ1 = ds1.get("Parameter[@name='type']");
          assert.equal(typ1.text(), "pgraster"); 
          assert.ok(! ds1.get("Parameter[@name='band']") );
          assert.ok(! ds1.get("Parameter[@name='clip_rasters']") );
          var ovv1 = ds1.get("Parameter[@name='use_overviews']");
          assert.equal(ovv1.text(), "1"); 
          var scl1 = ds1.get("Parameter[@name='prescale_rasters']");
          assert.equal(scl1.text(), "true"); 

          var layer2 = xmlDoc.get("Layer[@name='layer2']");
          assert.ok(layer2, "Layer2 not found in XML");
          var ds2 = layer2.get("Datasource");
          assert.ok(ds2, "Datasource for layer2 not found in XML: " + xmlDoc);
          var gf2 = ds2.get("Parameter[@name='raster_field']");
          assert.ok(gf2, "raster_field for layer2 not found in: " + ds2);
          assert.equal(gf2.text(), "r2"); 
          var typ2 = ds2.get("Parameter[@name='type']");
          assert.equal(typ2.text(), "pgraster"); 
          var bnd2 = ds2.get("Parameter[@name='band']");
          assert.equal(bnd2.text(), "1");
          var clp2 = ds2.get("Parameter[@name='clip_rasters']");
          assert.equal(clp2.text(), "1");
          assert.ok(! ds2.get("Parameter[@name='use_overviews']") );
          assert.ok(! ds2.get("Parameter[@name='prescale_rasters']") );

          done();
      }
    );
  });


  test('gcol with objects fails when name is not provided', function(done) {
      var mml_store = new grainstore.MMLStore({mapnik_version: '2.1.0'}),
          mml_builder;

      step(
          function initBuilder() {
              mml_builder = mml_store.mml_builder({
                  dbname: 'my_database',
                  sql:['SELECT ST_MakePoint(0,0) g',
                      'SELECT ST_AsRaster(ST_MakePoint(0,0),1.0,1.0) r'],
                  style: [DEFAULT_POINT_STYLE, DEFAULT_POINT_STYLE],
                  gcols: [
                      {type: 'geometry'}
                  ],
                  style_version:'2.1.0'
              }).toXML(this);
          },
          function getXML0(err) {
              assert.ok(!!err);
              done();
          }
      );
  });

    test('datasource_extend option allows to have different datasources per layer', function(done) {
        var mmlStore = new grainstore.MMLStore({ mapnik_version: '2.3.0' });

        var default_user = 'default_user',
            default_pass = 'default_pass',
            wadus_user = 'wadus_user',
            wadus_pass = 'wadus_password';

        var datasource_extend = {
            user: wadus_user,
            password: wadus_pass
        };

        step(
            function initBuilder() {
                mmlStore.mml_builder({
                    dbuser: default_user,
                    dbpassword: default_pass,
                    dbname: 'my_database',
                    sql: [queryMakeLine, queryMakePoint],
                    datasource_extend: [,datasource_extend],
                    style: [styleLine, stylePoint],
                    style_version: '2.3.0'
                }).toXML(this);
            },
            function validateXML(err, xml) {
                if (err) {
                    throw err;
                }
                var xmlDoc = libxmljs.parseXmlString(xml);

                var layer0 = xmlDoc.get("Layer[@name='layer0']");
                assert.ok(layer0, "Layer0 not found in XML");
                var layer1 = xmlDoc.get("Layer[@name='layer1']");
                assert.ok(layer1, "Layer1 not found in XML");

                var layer0Datasource = layer0.get("Datasource");
                assert.ok(layer0Datasource, "Datasource for layer0 not found in XML");
                var layer1Datasource = layer1.get("Datasource");
                assert.ok(layer1Datasource, "Datasource for layer1 not found in XML");


                var layer0User = layer0Datasource.get("Parameter[@name='user']");
                assert.equal(layer0User.text(), default_user, xml);
                var layer1User = layer1Datasource.get("Parameter[@name='user']");
                assert.equal(layer1User.text(), wadus_user, xml);

                var layer0Password = layer0Datasource.get("Parameter[@name='password']");
                assert.equal(layer0Password.text(), default_pass, xml);
                var layer1Password = layer1Datasource.get("Parameter[@name='password']");
                assert.equal(layer1Password.text(), wadus_pass, xml);

                return null;
            },
            function finish(err) {
                return done(err);
            }
        );
    });

  test('error out on blank CartoCSS in a style array', function(done) {
    var style0 = "#layer0 { marker-width:3; }";
    var style1 = "";
    var mml_store = new grainstore.MMLStore({mapnik_version: '2.1.0'});

    step(
      function initBuilder() {
        mml_store.mml_builder({
              dbname: 'my_database',
              sql:['SELECT ST_MakePoint(0,0)','SELECT ST_MakeLine(ST_MakePoint(-10,-5),ST_MakePoint(10,-5))'],
              style: [style0, style1],
              style_version:'2.1.0'
            }).toXML(this);
      },
      function checkError(err) {
          assert(err);
          assert.equal(err.message, "style1: CartoCSS is empty");
          return null;
      },
      function finish(err) {
          done(err);
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
    var mml_store = new grainstore.MMLStore({mapnik_version: '2.1.0'});

    step(
      function initBuilder() {
        mml_store.mml_builder({
              dbname: 'my_database',
              sql:[sql0, sql1],
              style: [style0, style1],
              style_version: [style_version0, style_version1]
            }).toXML(this);
      },
      function checkXML0(err, xml) {
          if ( err ) {
              throw err;
          }
          var xmlDoc = libxmljs.parseXmlString(xml);

          var layer0 = xmlDoc.get("Layer[@name='layer0']");
          assert.ok(layer0, "Layer0 not found in XML");
          var table0 = layer0.get("Datasource/Parameter[@name='table']");
          assert.ok(table0, "Layer0.table not found in XML");
          var table0txt = table0.toString();
          assert.ok(
              table0txt.indexOf(sql0) !== -1,
              'Cannot find sql [' + sql0 + '] in table datasource, got ' + table0txt
          );

          var layer1 = xmlDoc.get("Layer[@name='layer1']");
          assert.ok(layer1, "Layer1 not found in XML");
          var table1 = layer1.get("Datasource/Parameter[@name='table']");
          assert.ok(table1, "Layer1.table not found in XML");
          var table1txt = table1.toString();
          assert.ok(
              table1txt.indexOf(sql1) !== -1,
              'Cannot find sql [' + sql1 + '] in table datasource, got ' + table1txt
          );

          var style0 = xmlDoc.get("Style[@name='layer0']");
          assert.ok(style0, "Style for layer0 not found in XML");
          var style0txt = style0.toString();
          var re = /MarkersSymbolizer width="6"/;
          assert.ok(re.test(style0txt), 'Expected ' + re + ' -- got ' + style0txt);

          var style1 = xmlDoc.get("Style[@name='layer1']");
          assert.ok(style1, "Style for layer1 not found in XML");
          var style1txt = style1.toString();
          re = /MarkersSymbolizer width="4"/;
          assert.ok(re.test(style1txt), 'Expected ' + re + ' -- got ' + style1txt);

          return true;
      },
      done
    );
  });

  test('layer name in style array is only a placeholder', function(done) {
    var style0 = "#layer { marker-width:3; }";
    var style1 = "#style { line-color:red; }";
    var mml_store = new grainstore.MMLStore({mapnik_version: '2.1.0'});

    step(
      function initBuilder() {
        mml_store.mml_builder({
              dbname: 'my_database',
              sql:['SELECT ST_MakePoint(0,0)','SELECT ST_MakeLine(ST_MakePoint(-10,-5),ST_MakePoint(10,-5))'],
              style: [style0, style1],
              style_version:'2.1.0'
            }).toXML(this);
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

          done();
      }
    );
  });

  test('layer name in single style is only a placeholder', function(done) {
    var style0 = "#layer { marker-width:3; } #layer[a=1] { marker-fill:#ff0000 }";
    var mml_store = new grainstore.MMLStore({mapnik_version: '2.1.0'});

    step(
      function initBuilder() {
        mml_store.mml_builder({
              dbname: 'my_database',
              sql:['SELECT ST_MakePoint(0,0)'],
              style: [style0],
              style_version:'2.1.0'
            }).toXML(this);
      },
      function checkXML0(err, xml) {
          if ( err ) { done(err); return; }
          var xmlDoc = libxmljs.parseXmlString(xml);

          var layer0 = xmlDoc.get("Layer[@name='layer0']");
          assert.ok(layer0, "Layer0 not found in XML");

          var style0 = xmlDoc.get("Style[@name='layer0']");
          assert.ok(style0, "Style for layer0 not found in XML");
          var style0txt = style0.toString();
          var re = /MarkersSymbolizer fill="#ff0000" width="3"/;
          assert.ok(re.test(style0txt), 'Expected ' + re + ' -- got ' + style0txt);

          done();
      }
    );
  });

  test('accept sql array with single style string', function(done) {
    var style0 = "#layer0 { marker-width:3; }";
    var style1 = "#layer1 { line-color:red; }";
    var mml_store = new grainstore.MMLStore({mapnik_version: '2.1.0'});

    step(
      function initBuilder() {
        mml_store.mml_builder({
              dbname: 'my_database',
              sql:['SELECT ST_MakePoint(0,0)','SELECT ST_MakeLine(ST_MakePoint(-10,-5),ST_MakePoint(10,-5))'],
              style: [style0, style1],
              style_version:'2.1.0'
            }).toXML(this);
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

          done();
      }
    );
  });

  test('Error out on malformed interactivity', function(done) {
    var sql0 = 'SELECT 1 as a, 2 as b, ST_MakePoint(0,0)';
    var sql1 = 'SELECT 3 as a, 4 as b, ST_MakeLine(ST_MakePoint(-10,-5),ST_MakePoint(10,-5))';
    var style0 = "#layer0 { marker-width:3; }";
    var style1 = "#layer1 { line-color:red; }";
    var fullstyle = style0 + style1;
    var mml_store = new grainstore.MMLStore({mapnik_version: '2.1.0'});
    var iact0;
    var iact1 = ['a','b'];

    step(
      function initBuilder() {
        mml_store.mml_builder({
              dbname: 'my_database',
              sql:[sql0, sql1],
              interactivity: [iact0, iact1],
              style: fullstyle, 
              style_version:'2.1.0'
            }).toXML(this);
      },
      function checkError(err) {
          assert.ok(err);
          assert.equal(err.message, 'Invalid interactivity value type for layer 1: object');
          done();
      }
    );
  });

  test('Error out on malformed layer', function(done) {
    var mml_store = new grainstore.MMLStore({mapnik_version: '2.1.0'});

    step(
      function initBuilder() {
        mml_store.mml_builder({
              dbname: 'my_database',
              sql: 'select 1',
              style: DEFAULT_POINT_STYLE,
              layer: 'cipz'
            }).toXML(this);
      },
      function checkError(err) {
          assert.ok(err);
          assert.equal(err.message, 'Invalid (non-integer) layer value type: cipz');
          done();
      }
    );
  });

});
