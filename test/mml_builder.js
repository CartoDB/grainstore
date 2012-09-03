var assert     = require('assert');
var _          = require('underscore');
var grainstore = require('../lib/grainstore');
var libxmljs   = require('libxmljs');
var tests      = module.exports = {};
var redis      = require('redis');
var Step       = require('step');

var redis_opts = require('./support/redis_opts');
var redis_client = redis.createClient(redis_opts.port);

suite('mml_builder', function() {

  suiteSetup(function() {
    // Check that we start with an empty redis db 
    redis_client.keys("*", function(err, matches) {
        assert.equal(matches.length, 0);
    });
  });

  test('can generate base mml with normal ops', function(done) {
    var mml_store = new grainstore.MMLStore(redis_opts);
    var mml_builder = mml_store.mml_builder(
      {dbname: 'my_database', table:'my_table'},
      function(err, payload) {
        //console.dir(payload);
        var baseMML = mml_builder.baseMML();
    
        assert.ok(_.isArray(baseMML.Layer));
        assert.equal(baseMML.Layer[0].id, 'my_table');
        assert.equal(baseMML.Layer[0].Datasource.dbname, 'my_database');

        redis_client.keys("*", function(err, matches) {
            assert.equal(matches.length, 1);
            assert.equal(matches[0], 'map_style|my_database|my_table');
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

  test('can generate base mml with sql ops, maintain id', function(done) {
    var mml_store = new grainstore.MMLStore(redis_opts);
    var mml_builder = mml_store.mml_builder({dbname: 'my_database', table:'my_table', sql: 'SELECT * from my_table'},
    function() {
      var baseMML = mml_builder.baseMML();
      assert.equal(baseMML.Layer[0].id, 'my_table');
      assert.equal(baseMML.Layer[0].Datasource.table, 'SELECT * from my_table');
      mml_builder.delStyle(done);
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

  test('can render errors from full mml with bad style', function(done) {
    var mml_store = new grainstore.MMLStore(redis_opts);
    var mml_builder = mml_store.mml_builder({dbname: 'my_database', table:'my_table'}, function() {
      mml_builder.render("#my_table {\n  backgrxxxxxound-color: #fff;\n}", function(err, output){
        assert.equal(err.message, 'style.mss:2:2 Unrecognized rule: backgrxxxxxound-color');
        mml_builder.delStyle(done);
      });
    });
  });

  test('can render multiple errors from full mml with bad style', function(done) {
    var mml_store = new grainstore.MMLStore(redis_opts);
    var mml_builder = mml_store.mml_builder({dbname: 'my_database', table:'my_table'}, function() {
      mml_builder.render("#my_table {\n  backgrxxound-color: #fff;bad-tag: #fff;\n}", function(err, output){
       assert.equal(err.message, 'style.mss:2:2 Unrecognized rule: backgrxxound-color\nstyle.mss:2:27 Unrecognized rule: bad-tag');
       mml_builder.delStyle(done);
      });
    });
  });

  test('storing a bad style throws errors', function(done) {
    var mml_store = new grainstore.MMLStore(redis_opts);
    var mml_builder = mml_store.mml_builder({dbname: 'my_database', table:'my_table'}, function() {
      mml_builder.setStyle("#my_table {\n  backgrxxound-color: #fff;bad-tag: #fff;\n}", function(err, output){
       assert.equal(err.message, 'style.mss:2:2 Unrecognized rule: backgrxxound-color\nstyle.mss:2:27 Unrecognized rule: bad-tag');
       mml_builder.delStyle(done);
      });
    });
  });

  test('store a good style', function(done) {
    var mml_store = new grainstore.MMLStore(redis_opts);
    var mml_builder = mml_store.mml_builder({dbname: 'my_database', table:'my_table'}, function() {
      mml_builder.setStyle("#my_table {\n  polygon-fill: #fff;\n}", function(err, output) {
        mml_builder.delStyle(done);
      });
    });
  });

  test('store a good style and retrieve it', function(done) {
    var style = "#my_table {\n  polygon-fill: #fff;\n}";
    var mml_store = new grainstore.MMLStore(redis_opts);
    var mml_builder = mml_store.mml_builder({dbname: 'my_database', table:'my_table'}, function() {
      mml_builder.setStyle(style, function(err, output){
        mml_builder.getStyle(function(err, data){
          assert.equal(data.style, style);
          mml_builder.delStyle(done);
        });
      });
    });
  });

  test('store a good style and delete it, resetting to default', function(done) {
    var style = "#my_table {\n  polygon-fill: #fff;\n}";
    var mml_store = new grainstore.MMLStore(redis_opts);
    var mml_builder = mml_store.mml_builder({dbname: 'my_database', table:'my_tableismo'}, function() {
      mml_builder.setStyle(style, function(err, output){
        mml_builder.delStyle(function(err, data){
          mml_builder.getStyle(function(err, data){
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
        assert.equal(data.style, "#my_tablez {marker-fill: #FF6600;marker-opacity: 1;marker-width: 8;marker-line-color: white;marker-line-width: 3;marker-line-opacity: 0.9;marker-placement: point;marker-type: ellipse;marker-allow-overlap: true;}");
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
          var xmlDoc = libxmljs.parseXmlString(data);
          var color = xmlDoc.get("//@fill");
          assert.equal(color.value(), "#000000");
          mml_builder.delStyle(done);
        });
      });
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

  test("can retrieve basic XML specifying sql", function(done){
    var mml_store = new grainstore.MMLStore(redis_opts);
    var mml_builder = mml_store.mml_builder(
      {dbname: 'my_databaasez', table:'my_tablez', sql: "SELECT * FROM my_face"},
      function() {
        mml_builder.toXML(function(err, data){
          var xmlDoc = libxmljs.parseXmlString(data);
          var sql = xmlDoc.get("//Parameter[@name='table']");
          assert.equal(sql.text(), "SELECT * FROM my_face");
          mml_builder.delStyle(done);
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
        assert.equal(baseMML.Layer[0].Datasource.extent, '-20005048.4188,-20005048.4188,20005048.4188,20005048.4188');
        mml_builder.delStyle(done);
      });
  });

  test('SRS in XML should use the "+init=epsg:xxx" form', function(done) {
    var mml_store = new grainstore.MMLStore(redis_opts);
    var mml_builder = mml_store.mml_builder(
      {dbname: 'my_databaasez', table:'my_tablez'},
      function() {
        mml_builder.toXML(function(err, data){
          var xmlDoc = libxmljs.parseXmlString(data);
          var srs = xmlDoc.get("//@srs");
          assert.equal(srs.value().indexOf("+init=epsg:"), 0,
            '"' + srs.value() + '" does not start with "+init=epsg:"');
          mml_builder.delStyle(done);
        });
      });
  });

  test('store, retrive and convert to XML a set of reference styles', function(done) {

    var styles = [
      // point-transform without point-file
      { cartocss: "#tab { point-transform: 'scale(0.9)'; }",
        xml_re: new RegExp(/PointSymbolizer transform="scale\(0.9\)"/) }
    ];

    var mml_store = new grainstore.MMLStore(redis_opts);
    var mml_builder = mml_store.mml_builder({dbname: 'my_database', table:'tab'}, function() {

      var StylesRunner = function(styles, done) {
        this.styles = styles;
        this.done = done;
        this.errors = [];
      };

      StylesRunner.prototype.runNext = function(err) {
        if ( err ) this.errors.push(err); 
        if ( ! this.styles.length ) {
          var err = this.errors.length ? new Error(this.errors) : null;
          this.done(err);
          return;
        }
        var that = this;
        var style_spec = this.styles.shift();
        var style = style_spec.cartocss;
        var xml_re = style_spec.xml_re;

        Step(
          function setStyle() {
            mml_builder.setStyle(style, this);
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
            try { assert.equal(data.style, style); }
            catch (err) { 
              that.runNext(new Error('getStyle check: ' + style + ': ' + err));
              return;
            }
            mml_builder.toXML(this);
          },
          function finish(err, data) {
            //console.log("toXML returned: "); console.dir(data);
            assert.ok(xml_re.test(data), 'toXML: ' + style + ': expected ' + xml_re + ' got:\n' + data);
            mml_builder.delStyle(function() {});
            if ( err ) {
              that.runNext(new Error('toXML: ' + style + ': ' + err));
              return;
            }
            that.runNext(null);
          }
        );

      };

      var runner = new StylesRunner(styles, done);
      runner.runNext();

    });

  });

  suiteTeardown(function() {
    // Check that we left the redis db empty
    redis_client.keys("*", function(err, matches) {
        assert.equal(matches.length, 0);
    });
    redis_client.flushall();
  });

});
