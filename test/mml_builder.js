var assert     = require('assert');
var _          = require('underscore');
var grainstore = require('../lib/grainstore');
var libxmljs   = require('libxmljs');
var tests      = module.exports = {};

var redis_opts = require('./support/redis_opts');

suite('mml_builder', function() {

  test('can generate base mml with normal ops', function() {
    var mml_store = new grainstore.MMLStore(redis_opts);
    var mml_builder = mml_store.mml_builder({dbname: 'my_database', table:'my_table'});
    var baseMML = mml_builder.baseMML();

    assert.ok(_.isArray(baseMML.Layer));
    assert.equal(baseMML.Layer[0].id, 'my_table');
    assert.equal(baseMML.Layer[0].Datasource.dbname, 'my_database');
  });

  test('can generate base mml with overridden authentication', function() {
    var mml_store = new grainstore.MMLStore(redis_opts, {
        datasource: {
            user:'overridden_user',
            password:'overridden_password'
        }});
    var mml_builder = mml_store.mml_builder({
            dbname: 'my_database',
            table:'my_table',
            // NOTE: authentication tokens here are silengly discarded
            user:'shadow_user', password:'shadow_password'
        });
    var baseMML = mml_builder.baseMML();

    assert.ok(_.isArray(baseMML.Layer));
    assert.equal(baseMML.Layer[0].id, 'my_table');
    assert.equal(baseMML.Layer[0].Datasource.dbname, 'my_database');
    assert.equal(baseMML.Layer[0].Datasource.user, 'overridden_user');
    assert.equal(baseMML.Layer[0].Datasource.password, 'overridden_password');
  });

  test('can generate base mml with sql ops, maintain id', function() {
    var mml_store = new grainstore.MMLStore(redis_opts);
    var mml_builder = mml_store.mml_builder({dbname: 'my_database', table:'my_table', sql: 'SELECT * from my_table'});
    var baseMML = mml_builder.baseMML();

    assert.equal(baseMML.Layer[0].id, 'my_table');
    assert.equal(baseMML.Layer[0].Datasource.table, 'SELECT * from my_table');
  });

  test('can force plain base mml with sql ops', function() {
    var mml_store = new grainstore.MMLStore(redis_opts);
    var mml_builder = mml_store.mml_builder({dbname: 'my_database', table:'my_table', sql: 'SELECT * from my_table'});
    var baseMML = mml_builder.baseMML({use_sql: false});

    assert.equal(baseMML.Layer[0].id, 'my_table');
    assert.equal(baseMML.Layer[0].Datasource.table, 'my_table');
  });

  test('can generate full mml with style', function() {
    var mml_store = new grainstore.MMLStore(redis_opts);
    var mml_builder = mml_store.mml_builder({dbname: 'my_database', table:'my_table'});
    var mml = mml_builder.toMML("my carto style");

    assert.equal(mml.Stylesheet[0].data, 'my carto style');
  });

  test('can render XML from full mml with style', function() {
    var mml_store = new grainstore.MMLStore(redis_opts);
    var mml_builder = mml_store.mml_builder({dbname: 'my_database', table:'my_table'});
    mml_builder.render("#my_table {\n  polygon-fill: #fff;\n}", function(err, output){
      assert.ok(_.isNull(err), _.isNull(err) ? '' : err.message);
      assert.ok(output);
    });
  });

  test('can render errors from full mml with bad style', function() {
    var mml_store = new grainstore.MMLStore(redis_opts);
    var mml_builder = mml_store.mml_builder({dbname: 'my_database', table:'my_table'});
    mml_builder.render("#my_table {\n  backgrxxxxxound-color: #fff;\n}", function(err, output){
      assert.equal(err.message, 'style.mss:2:2 Unrecognized rule: backgrxxxxxound-color');
    });
  });

  test('can render multiple errors from full mml with bad style', function() {
    var mml_store = new grainstore.MMLStore(redis_opts);
    var mml_builder = mml_store.mml_builder({dbname: 'my_database', table:'my_table'});
    mml_builder.render("#my_table {\n  backgrxxound-color: #fff;bad-tag: #fff;\n}", function(err, output){
     assert.equal(err.message, 'style.mss:2:2 Unrecognized rule: backgrxxound-color\nstyle.mss:2:27 Unrecognized rule: bad-tag');
    });
  });

  test('storing a bad style throws errors', function() {
    var mml_store = new grainstore.MMLStore(redis_opts);
    var mml_builder = mml_store.mml_builder({dbname: 'my_database', table:'my_table'});
    mml_builder.setStyle("#my_table {\n  backgrxxound-color: #fff;bad-tag: #fff;\n}", function(err, output){
     assert.equal(err.message, 'style.mss:2:2 Unrecognized rule: backgrxxound-color\nstyle.mss:2:27 Unrecognized rule: bad-tag');
    });
  });

  test('store a good style', function() {
    var mml_store = new grainstore.MMLStore(redis_opts);
    var mml_builder = mml_store.mml_builder({dbname: 'my_database', table:'my_table'});
    mml_builder.setStyle("#my_table {\n  polygon-fill: #fff;\n}", function(err, output){});
  });

  test('store a good style and retrieve it', function() {
    var style = "#my_table {\n  polygon-fill: #fff;\n}";
    var mml_store = new grainstore.MMLStore(redis_opts);
    var mml_builder = mml_store.mml_builder({dbname: 'my_database', table:'my_table'});
    mml_builder.setStyle(style, function(err, output){
      mml_builder.getStyle(function(err, data){
        assert.equal(data.style, style);
      });
    });
  });

  test('store a good style and delete it, resetting to default', function() {
    var style = "#my_table {\n  polygon-fill: #fff;\n}";
    var mml_store = new grainstore.MMLStore(redis_opts);
    var mml_builder = mml_store.mml_builder({dbname: 'my_database', table:'my_tableismo'});
    mml_builder.setStyle(style, function(err, output){
      mml_builder.delStyle(function(err, data){
        mml_builder.getStyle(function(err, data){
          assert.equal(data.style, "#my_tableismo {marker-fill: #FF6600;marker-opacity: 1;marker-width: 8;marker-line-color: white;marker-line-width: 3;marker-line-opacity: 0.9;marker-placement: point;marker-type: ellipse;marker-allow-overlap: true;}");
        });
      });
    });
  });

  test('retrieves a non-existant style should return default style', function() {
    var mml_store = new grainstore.MMLStore(redis_opts);
    var mml_builder = mml_store.mml_builder({dbname: 'my_databaasez', table:'my_tablez'});

    mml_builder.getStyle(function(err, data){
      assert.equal(data.style, "#my_tablez {marker-fill: #FF6600;marker-opacity: 1;marker-width: 8;marker-line-color: white;marker-line-width: 3;marker-line-opacity: 0.9;marker-placement: point;marker-type: ellipse;marker-allow-overlap: true;}");
    });
  });

  test('retrieves a dynamic style should return XML with dynamic style', function() {
    var mml_store = new grainstore.MMLStore(redis_opts);
    var mml_builder = mml_store.mml_builder({dbname: 'my_databaasez', table:'my_tablez', style: '#my_tablez {marker-fill: #000000;}'});
    mml_builder.toXML(function(err, data){
      var xmlDoc = libxmljs.parseXmlString(data);
      var color = xmlDoc.get("//@fill");
      assert.equal(color.text(), "#000000");
    });
  });

  test('can retrieve basic XML', function() {
    var mml_store = new grainstore.MMLStore(redis_opts);
    var mml_builder = mml_store.mml_builder({dbname: 'my_databaasez', table:'my_tablez'});

    mml_builder.toXML(function(err, data){
      var xmlDoc = libxmljs.parseXmlString(data);
      var sql = xmlDoc.get("//Parameter[@name='table']");
      assert.equal(sql.text(), "my_tablez");
    });
  });

  test("can retrieve basic XML specifying sql", function(){
    var mml_store = new grainstore.MMLStore(redis_opts);
    var mml_builder = mml_store.mml_builder({dbname: 'my_databaasez', table:'my_tablez', sql: "SELECT * FROM my_face"});

     mml_builder.toXML(function(err, data){
       var xmlDoc = libxmljs.parseXmlString(data);
       var sql = xmlDoc.get("//Parameter[@name='table']");
       assert.equal(sql.text(), "SELECT * FROM my_face");
     });
  });

  test("can retrieve basic XML specifying polygon default geom", function(){
    var mml_store = new grainstore.MMLStore(redis_opts);
    var mml_builder = mml_store.mml_builder({dbname: 'my_databaasez', table: 'my_polygon_tablez', geom_type: 'polygon'});

    mml_builder.toXML(function(err, data){
      var xmlDoc = libxmljs.parseXmlString(data);
      var sql = xmlDoc.get("//Parameter[@name='table']");
      assert.equal(sql.text(), "my_polygon_tablez");

      var style = xmlDoc.get("//PolygonSymbolizer");
      assert.equal(style.attr('fill').value(), "#ff6600");
    });
  });

  test("can set style and then retrieve XML", function(){
    var mml_store = new grainstore.MMLStore(redis_opts);
    var mml_builder = mml_store.mml_builder({dbname: 'my_databaasez', table:'my_special_design'});

    var style = "#my_special_design {\n  polygon-fill: #fff;\n}";
    mml_builder.setStyle(style, function(err, output){
      mml_builder.toXML(function(err, data){
        var xmlDoc = libxmljs.parseXmlString(data);
        var style = xmlDoc.get("//PolygonSymbolizer");
        assert.equal(style.attr('fill').value(), "#ffffff");
      });
    });
  });

  test("can set style and then retrieve XML specifying sql", function(){
    var mml_store = new grainstore.MMLStore(redis_opts);
    var mml_builder = mml_store.mml_builder({dbname: 'my_databaasez', table:'big_test', sql: "select * from my_fish"});

    var style = "#big_test {\n  polygon-fill: #000;\n}";
    mml_builder.setStyle(style, function(err, output){
      mml_builder.toXML(function(err, data){
        var xmlDoc = libxmljs.parseXmlString(data);
        var style = xmlDoc.get("//PolygonSymbolizer");
        assert.equal(style.attr('fill').value(), "#000000");
      });
    });
  });

  test("can set style and then retrieve XML specifying sql, then update style and regenerate", function(){
    var mml_store = new grainstore.MMLStore(redis_opts);
    var mml_builder = mml_store.mml_builder({dbname: 'my_databaasez', table:'big_tester', sql: "select * from my_fish"});

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
          });
        });
      });
    });
  });

  test('by default datasource has full webmercator extent', function() {
    var mml_store = new grainstore.MMLStore(redis_opts);
    var mml_builder = mml_store.mml_builder({dbname: 'my_database', table:'my_table'});
    var baseMML = mml_builder.baseMML();

    assert.ok(_.isArray(baseMML.Layer));
    assert.equal(baseMML.Layer[0].Datasource.extent, '-20005048.4188,-20005048.4188,20005048.4188,20005048.4188');
  });

});
