var assert     = require('assert');
var _          = require('underscore');
var grainstore = require('../lib/grainstore');
var libxmljs   = require('libxmljs');
var tests      = module.exports = {};

var redis_opts = {
  max: 10, 
  idleTimeoutMillis: 1, 
  reapIntervalMillis: 1, 
}

tests['true'] = function() {
  assert.ok(true);
}

tests['can generate base mml with normal ops'] = function() {
  var mml_store = new grainstore.MMLStore(redis_opts);
  var mml_builder = mml_store.mml_builder({dbname: 'my_database', table:'my_table'});
  var baseMML = mml_builder.baseMML();

  assert.ok(_.isArray(baseMML.Layer));
  assert.equal(baseMML.Layer[0].id, 'my_table');
  assert.equal(baseMML.Layer[0].Datasource.dbname, 'my_database');
}

tests['can generate base mml with sql ops, maintain id'] = function() {
  var mml_store = new grainstore.MMLStore(redis_opts);
  var mml_builder = mml_store.mml_builder({dbname: 'my_database', table:'my_table', sql: 'SELECT * from my_table'});
  var baseMML = mml_builder.baseMML();

  assert.equal(baseMML.Layer[0].id, 'my_table');
  assert.equal(baseMML.Layer[0].Datasource.table, 'SELECT * from my_table');
}

tests['can force plain base mml with sql ops'] = function() {
  var mml_store = new grainstore.MMLStore(redis_opts);
  var mml_builder = mml_store.mml_builder({dbname: 'my_database', table:'my_table', sql: 'SELECT * from my_table'});
  var baseMML = mml_builder.baseMML({use_sql: false});

  assert.equal(baseMML.Layer[0].id, 'my_table');
  assert.equal(baseMML.Layer[0].Datasource.table, 'my_table');
}

tests['can generate full mml with style'] = function() {
  var mml_store = new grainstore.MMLStore(redis_opts);
  var mml_builder = mml_store.mml_builder({dbname: 'my_database', table:'my_table'});
  var mml = mml_builder.toMML("my carto style");

  assert.equal(mml.Stylesheet[0].data, 'my carto style');
}

tests['can render XML from full mml with style'] = function() {
  var mml_store = new grainstore.MMLStore(redis_opts);
  var mml_builder = mml_store.mml_builder({dbname: 'my_database', table:'my_table'});
  mml_builder.render("#my_table {\n  background-color: #fff;\n}", function(err, output){
    assert.ok(_.isNull(err));
    assert.ok(output);
  });
}

tests['can render errors from full mml with bad style'] = function() {
  var mml_store = new grainstore.MMLStore(redis_opts);
  var mml_builder = mml_store.mml_builder({dbname: 'my_database', table:'my_table'});
  mml_builder.render("#my_table {\n  backgrxxxxxound-color: #fff;\n}", function(err, output){
    assert.eql(err.message, 'style.mss:2:2 Unrecognized rule: backgrxxxxxound-color');
  });
}

tests['can render multiple errors from full mml with bad style'] = function() {
  var mml_store = new grainstore.MMLStore(redis_opts);
  var mml_builder = mml_store.mml_builder({dbname: 'my_database', table:'my_table'});
  mml_builder.render("#my_table {\n  backgrxxound-color: #fff;bad-tag: #fff;\n}", function(err, output){
   assert.eql(err.message, 'style.mss:2:2 Unrecognized rule: backgrxxound-color\nstyle.mss:2:27 Unrecognized rule: bad-tag');
  });
}

tests['storing a bad style throws errors'] = function() {
  var mml_store = new grainstore.MMLStore(redis_opts);
  var mml_builder = mml_store.mml_builder({dbname: 'my_database', table:'my_table'});
  mml_builder.setStyle("#my_table {\n  backgrxxound-color: #fff;bad-tag: #fff;\n}", function(err, output){
   assert.eql(err.message, 'style.mss:2:2 Unrecognized rule: backgrxxound-color\nstyle.mss:2:27 Unrecognized rule: bad-tag');
  });
}

tests['store a good style'] = function() {
  var mml_store = new grainstore.MMLStore(redis_opts);
  var mml_builder = mml_store.mml_builder({dbname: 'my_database', table:'my_table'});
  mml_builder.setStyle("#my_table {\n  background-color: #fff;\n}", function(err, output){});
};

tests['store a good style and retrieve it'] = function() {
  var style = "#my_table {\n  background-color: #fff;\n}"
  var mml_store = new grainstore.MMLStore(redis_opts);
  var mml_builder = mml_store.mml_builder({dbname: 'my_database', table:'my_table'});
  mml_builder.setStyle(style, function(err, output){
    mml_builder.getStyle(function(err, data){
      assert.eql(data.style, style);
    });
  });
};

tests['store a good style and delete it, resetting to default'] = function() {
  var style = "#my_table {\n  background-color: #fff;\n}"
  var mml_store = new grainstore.MMLStore(redis_opts);
  var mml_builder = mml_store.mml_builder({dbname: 'my_database', table:'my_tableismo'});
  mml_builder.setStyle(style, function(err, output){
    mml_builder.delStyle(function(err, data){
      mml_builder.getStyle(function(err, data){
        assert.eql(data.style, "#my_tableismo {marker-fill: #FF6600;marker-opacity: 1;marker-width: 8;marker-line-color: white;marker-line-width: 3;marker-line-opacity: 0.9;marker-placement: point;marker-type: ellipse;marker-allow-overlap: true;}");
      });
    });
  });
};

tests['retrieves a non-existant style should return default style'] = function() {
  var mml_store = new grainstore.MMLStore(redis_opts);
  var mml_builder = mml_store.mml_builder({dbname: 'my_databaasez', table:'my_tablez'});

  mml_builder.getStyle(function(err, data){
    assert.eql(data.style, "#my_tablez {marker-fill: #FF6600;marker-opacity: 1;marker-width: 8;marker-line-color: white;marker-line-width: 3;marker-line-opacity: 0.9;marker-placement: point;marker-type: ellipse;marker-allow-overlap: true;}");
  });
};

tests['retrieves a dynamic style should return XML with dynamic style'] = function() {
  var mml_store = new grainstore.MMLStore(redis_opts);
  var mml_builder = mml_store.mml_builder({dbname: 'my_databaasez', table:'my_tablez', style: '#my_tablez {marker-fill: #000000;}'});
  mml_builder.toXML(function(err, data){
    var xmlDoc = libxmljs.parseXmlString(data);
    var color = xmlDoc.get("//@fill");
    assert.eql(color.text(), "#000000");
  });
};

tests['can retrieve basic XML'] = function() {
  var mml_store = new grainstore.MMLStore(redis_opts);
  var mml_builder = mml_store.mml_builder({dbname: 'my_databaasez', table:'my_tablez'});

  mml_builder.toXML(function(err, data){
    var xmlDoc = libxmljs.parseXmlString(data);
    var sql = xmlDoc.get("//Parameter[@name='table']");
    assert.eql(sql.text(), "my_tablez");
  });
};

tests["can retrieve basic XML specifying sql"] = function(){
  var mml_store = new grainstore.MMLStore(redis_opts);
  var mml_builder = mml_store.mml_builder({dbname: 'my_databaasez', table:'my_tablez', sql: "SELECT * FROM my_face"});

   mml_builder.toXML(function(err, data){
     var xmlDoc = libxmljs.parseXmlString(data);
     var sql = xmlDoc.get("//Parameter[@name='table']");
     assert.eql(sql.text(), "SELECT * FROM my_face");
   });
}

tests["can retrieve basic XML specifying polygon default geom"] = function(){
  var mml_store = new grainstore.MMLStore(redis_opts);
  var mml_builder = mml_store.mml_builder({dbname: 'my_databaasez', table: 'my_polygon_tablez', geom_type: 'polygon'});

  mml_builder.toXML(function(err, data){
    var xmlDoc = libxmljs.parseXmlString(data);
    var sql = xmlDoc.get("//Parameter[@name='table']");
    assert.eql(sql.text(), "my_polygon_tablez");

    var style = xmlDoc.get("//PolygonSymbolizer");
    assert.eql(style.attr('fill').value(), "#ff6600");
  });
}

tests["can set style and then retrieve XML"] = function(){
  var mml_store = new grainstore.MMLStore(redis_opts);
  var mml_builder = mml_store.mml_builder({dbname: 'my_databaasez', table:'my_special_design'});

  var style = "#my_special_design {\n  background-color: #fff;\n}"
  mml_builder.setStyle(style, function(err, output){
    mml_builder.toXML(function(err, data){
      var xmlDoc = libxmljs.parseXmlString(data);
      var style = xmlDoc.get("//MapSymbolizer");
      assert.eql(style.attr('background-color').value(), "#ffffff");
    });
  });
}

tests["can set style and then retrieve XML specifying sql"] = function(){
  var mml_store = new grainstore.MMLStore(redis_opts);
  var mml_builder = mml_store.mml_builder({dbname: 'my_databaasez', table:'big_test', sql: "select * from my_fish"});

  var style = "#big_test {\n  background-color: #000;\n}"
  mml_builder.setStyle(style, function(err, output){
    mml_builder.toXML(function(err, data){
      var xmlDoc = libxmljs.parseXmlString(data);
      var style = xmlDoc.get("//MapSymbolizer");
      assert.eql(style.attr('background-color').value(), "#000000");
    });
  });
}

tests["can set style and then retrieve XML specifying sql, then update style and regenerate"] = function(){
  var mml_store = new grainstore.MMLStore(redis_opts);
  var mml_builder = mml_store.mml_builder({dbname: 'my_databaasez', table:'big_tester', sql: "select * from my_fish"});

  var style = "#big_tester {\n  background-color: #000;\n}"
  mml_builder.setStyle(style, function(err, output){
    mml_builder.toXML(function(err, data){
      var xmlDoc = libxmljs.parseXmlString(data);
      var style = xmlDoc.get("//MapSymbolizer");
      assert.eql(style.attr('background-color').value(), "#000000");

      var style2 = "#big_tester {\n  background-color: #999999;\n}"
      mml_builder.setStyle(style2, function(err, output){
        mml_builder.toXML(function(err, data){
          var xmlDoc = libxmljs.parseXmlString(data);
          var style = xmlDoc.get("//MapSymbolizer");
          assert.eql(style.attr('background-color').value(), "#999999");
        });
      });
    });
  });
};

