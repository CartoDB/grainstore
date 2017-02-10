var assert     = require('assert');
var _          = require('underscore');
var StyleTrans = require('../lib/grainstore/style_trans.js');

var t = new StyleTrans();

suite('style_trans', function() {

  //suiteSetup(function() { });

  // No change from 2.0.0 to ~2.0.2
  test('2.0.0 to ~2.0.2', function (done) {
    var style = "#tab[zoom=1] { marker-width:10; marker-height:20; }\n#tab[zoom=2] { marker-height:'6'; marker-width: '7'; }";
    t.transform(style, '2.0.0', '2.0.2', function (err, s) {
        assert.ifError(err);
        assert.equal(s, style);

        t.transform(style, '2.0.0', '2.0.3', function (err, s) {
            assert.ifError(err);
            assert.equal(s, style);
            done();
        });
    });
  });

  // No change from 2.0.2 to ~2.0.3
  test('2.0.2 to ~2.0.3', function (done) {
    var style = "#tab[zoom=1] { marker-width:10; marker-height:20; }\n" +
        "#tab[zoom=2] { marker-height:'6'; marker-width: '7'; }";
    t.transform(style, '2.0.2', '2.0.3', function (err, s) {
        assert.ifError(err);
        assert.equal(s, style);
        done();
    });
  });

  // Adapts marker width and height, from 2.0.2 to 2.1.0
  test('2.0.2 to 2.1.0, markers and zoom filter', function (done) {
    var style = "#tab[zoom=1] { marker-width:10; marker-height:20; }\n#tab[zoom=2] { marker-height:'6'; marker-width: '7'; }";
    var e = "#tab[zoom=1] { marker-width:20; marker-height:40; [\"mapnik::geometry_type\"=1] { marker-placement:point; marker-type:ellipse; } [\"mapnik::geometry_type\">1] { marker-placement:line; marker-type:arrow; marker-transform:scale(.5, .5); marker-clip:false; } }\n#tab[zoom=2] { marker-height:'12'; marker-width:'14'; [\"mapnik::geometry_type\"=1] { marker-placement:point; marker-type:ellipse; } [\"mapnik::geometry_type\">1] { marker-placement:line; marker-type:arrow; marker-transform:scale(.5, .5); marker-clip:false; } }"

    t.transform(style, '2.0.2', '2.1.0', function (err, s) {
        assert.ifError(err);
        assert.equal(s,e);
        done();
    });
  });

  test('2.0.2 to 2.1.0, markers', function (done) {
    var style = "#t { marker-width :\n10; \nmarker-height\t:   20; }";
    var e = "#t { marker-width:20; \n" +
        "marker-height:40; [\"mapnik::geometry_type\"=1] { marker-placement:point; marker-type:ellipse; } " +
        "[\"mapnik::geometry_type\">1] { " +
        "marker-placement:line; marker-type:arrow; marker-transform:scale(.5, .5); marker-clip:false; } }";

    t.transform(style, '2.0.2', '2.1.0', function (err, s) {
        assert.ifError(err);
        assert.equal(s,e);
        done();
    });
  });

  // More markers, see https://github.com/Vizzuality/grainstore/issues/30
  test('2.0.0 to 2.1.0, more markers', function (done) {
    var style = "#t [a<1] { marker-width:1 } # [a>1] { marker-width:2 }";
    var e = "#t [a<1] { marker-width:2; " +
        "[\"mapnik::geometry_type\"=1] { marker-placement:point; marker-type:ellipse; } " +
        "[\"mapnik::geometry_type\">1] {" +
        " marker-placement:line; marker-type:arrow; marker-transform:scale(.5, .5); marker-clip:false; } }" +
        " # [a>1] { marker-width:4; " +
        "[\"mapnik::geometry_type\"=1] { marker-placement:point; marker-type:ellipse; } " +
        "[\"mapnik::geometry_type\">1] {" +
        " marker-placement:line; marker-type:arrow; marker-transform:scale(.5, .5); marker-clip:false; } }";
    t.transform(style, '2.0.2', '2.1.0', function (err, s) {
        assert.ifError(err);
        assert.equal(s, e);
        done();
    });
  });

  // More markers, see https://github.com/Vizzuality/grainstore/issues/33
  test('2.0.0 to 2.1.0, markers dependent on filter', function (done) {
    var style = "#t[a=1] { marker-width:1 } #t[a=2] { line-color:red } #t[a=3] { marker-placement:line }";
    var e = "#t[a=1] { marker-width:2; " +
            "[\"mapnik::geometry_type\"=1] { marker-placement:point; marker-type:ellipse; } " +
            "[\"mapnik::geometry_type\">1] { " +
            "marker-placement:line; marker-type:arrow; marker-transform:scale(.5, .5); marker-clip:false; } } " +
            "#t[a=2] { line-color:red; } " +
            "#t[a=3] { marker-placement:line; " +
            // NOTE: we do override marker-placement for points because "line" doesn't work in 2.1.0
            //       and it worked exactly as "point" in 2.0.0
            "[\"mapnik::geometry_type\"=1] { marker-placement:point; marker-type:ellipse; } " +
            // NOTE: we do NOT override marker-placement for lines or polys
            "[\"mapnik::geometry_type\">1] { marker-type:arrow; marker-transform:scale(.5, .5); marker-clip:false; } }";

    t.transform(style , '2.0.2', '2.1.0', function (err, s) {
        assert.ifError(err);
        assert.equal(s, e);
        done();
    });
  });

  // Adapts marker width and height, from 2.0.0 to 2.1.0
  test('2.0.0 to 2.1.0, markers 1', function(done) {
    var style = "#tab[zoom=1] { marker-width:10; marker-height:20; }\n#tab[zoom=2] { marker-height:'6'; marker-width: \"7\"; }";
    var e = "#tab[zoom=1] { marker-width:20; marker-height:40; [\"mapnik::geometry_type\"=1] { marker-placement:point; marker-type:ellipse; } [\"mapnik::geometry_type\">1] { marker-placement:line; marker-type:arrow; marker-transform:scale(.5, .5); marker-clip:false; } }\n#tab[zoom=2] { marker-height:'12'; marker-width:\"14\"; [\"mapnik::geometry_type\"=1] { marker-placement:point; marker-type:ellipse; } [\"mapnik::geometry_type\">1] { marker-placement:line; marker-type:arrow; marker-transform:scale(.5, .5); marker-clip:false; } }"
    t.transform(style, '2.0.0', '2.1.0', function (err, s) {
        assert.ifError(err);
        assert.equal(s, e, "Obt:"+s+"\nExp:"+s);
        done();
    });
  });

  test('2.0.0 to 2.1.0, markers 2', function (done) {
    var style = "#t { marker-width :\n10; \nmarker-height\t:   20; }";
    var e = "#t { marker-width:20; \nmarker-height:40; [\"mapnik::geometry_type\"=1] { marker-placement:point; marker-type:ellipse; } [\"mapnik::geometry_type\">1] { marker-placement:line; marker-type:arrow; marker-transform:scale(.5, .5); marker-clip:false; } }"

    t.transform(style, '2.0.0', '2.1.0', function (err, s) {
        assert.ifError(err);
        assert.equal(s, e);
        done();
    });
  });

  test('2.0.0 to 2.1.0, markers 3', function (done) {
    var style = "#tab { marker-width:2 }";
    var e = "#tab { marker-width:4; [\"mapnik::geometry_type\"=1] { marker-placement:point; marker-type:ellipse; } [\"mapnik::geometry_type\">1] { marker-placement:line; marker-type:arrow; marker-transform:scale(.5, .5); marker-clip:false; } }"

    t.transform(style, '2.0.0', '2.1.0', function (err, s) {
        assert.ifError(err);
        assert.equal(s, e);
        done();
    });
  });

  test('2.0.0 to 2.1.0, markers 3', function (done) {
    var style = "#tab{ marker-width:2 }";
    var e = "#tab{ marker-width:4; [\"mapnik::geometry_type\"=1] { marker-placement:point; marker-type:ellipse; } [\"mapnik::geometry_type\">1] { marker-placement:line; marker-type:arrow; marker-transform:scale(.5, .5); marker-clip:false; } }";

    t.transform(style, '2.0.0', '2.1.0', function (err, s) {
        assert.ifError(err);
        assert.equal(s, e);
        done();
    });
  });

  test('2.0.0 to 2.1.0, line clipping', function (done) {
    var style = "#tab{ line-opacity:.5 }";
    var e = "#tab{ line-opacity:.5; }";

    t.transform(style, '2.0.0', '2.1.0', function (err, s) {
        assert.ifError(err);
        assert.equal(s, e);
        done();
    });
  });

  test('2.0.0 to 2.1.0, line clipping, bug #37', function (done) {
    var style = "#t{ marker-line-color:red; }";
    var e = "#t{ marker-line-color:red; [\"mapnik::geometry_type\"=1] { marker-placement:point; marker-type:ellipse; } [\"mapnik::geometry_type\">1] { marker-placement:line; marker-type:arrow; marker-transform:scale(.5, .5); marker-clip:false; } }"

    t.transform(style, '2.0.0', '2.1.0', function (err, s) {
        assert.ifError(err);
        assert.equal(s, e);
        done();
    });
  });

  test('2.0.0 to 2.1.0, polygon clipping', function (done) {
    var style = "#tab{ polygon-fill:red }";
    var e = "#tab{ polygon-fill:red; }";
    t.transform(style, '2.0.0', '2.1.0', function (err, s) {
        assert.ifError(err);
        assert.equal(s, e);
        done();
    });
  });

  // https://github.com/Vizzuality/grainstore/issues/35
  test('2.0.0 to 2.1.0, one line comments', function (done) {
    var style = "#tab{ //polygon-fill:red;\n}";
    var e = "#tab{  }";

    t.transform(style, '2.0.0', '2.1.0', function (err, s) {
        assert.ifError(err);
        assert.equal(s, e);
        done();
    });
  });

  // https://github.com/Vizzuality/grainstore/issues/41
  test('2.0.0 to 2.1.0, multiple one line comments', function (done) {
    var style = "#tab{ //polygon-fill:red;\n //marker-type:ellipse;\n }";
    var e = "#tab{  }";
    t.transform(style, '2.0.0', '2.1.0', function (err, s) {
        assert.ifError(err);
        assert.equal(s, e);
        done();
    });
  });

  test('2.0.0 to 2.1.0, symbolizers hidden in one line comments', function (done) {
    var style = "#tab{ //polygon-fill:red;\n line-opacity:1; }";
    var e = "#tab{ line-opacity:1; }";

    t.transform(style, '2.0.0', '2.1.0', function (err, s) {
        assert.ifError(err);
        assert.equal(s, e);
        done();
    });
  });

  test('2.0.0 to 2.1.0, symbolizers hidden in multiline line comments', function(done) {
    var style = "#tab{ /* polygon-fill:\nred; */ line-opacity:1; }";
    var e = "#tab{ line-opacity:1; }";

    t.transform(style, '2.0.0', '2.1.0', function (err, s) {
        assert.ifError(err);
        assert.equal(s, e);
        done();
    });
  });

  test('2.0.0 to 2.1.0, missing semicolon', function (done) {
    var style = "#t{ marker-placement:point; marker-width:8}";
    var e = "#t{ marker-placement:point; marker-width:16; [\"mapnik::geometry_type\"=1] { marker-placement:point; marker-type:ellipse; } [\"mapnik::geometry_type\">1] { marker-type:ellipse; marker-clip:false; } }";

    t.transform(style, '2.0.0', '2.1.0', function (err, s) {
        assert.ifError(err);
        assert.equal(s, e);
        done();
    });
  });

  test('2.0.0 to 2.1.1, marker-multi-policy', function (done) {
    var style = "#t{ marker-fill-color:red; }";
    var e = "#t{ marker-fill-color:red; [\"mapnik::geometry_type\"=1] { marker-placement:point; marker-type:ellipse; } [\"mapnik::geometry_type\">1] { marker-placement:line; marker-type:arrow; marker-transform:scale(.5, .5); marker-clip:false; } marker-multi-policy:whole; }"

    t.transform(style, '2.0.0', '2.1.1', function (err, s) {
        assert.ifError(err);
        assert.equal(s, e);
        done();
    });
  });

  // Nothing to adapt (yet) when no markers are involved
  test('2.0.0 to 2.1.0, no markers', function (done) {
    var style = "#tab[zoom=1] { line-fill:red; }\n#tab[zoom=2] { polygon-fill:blue; }";
    var e = "#tab[zoom=1] { line-fill:red; }\n#tab[zoom=2] { polygon-fill:blue; }";

    t.transform(style, '2.0.0', '2.1.0', function (err, s) {
        assert.ifError(err);
        assert.equal(s, e);
        done();
    });
  });

  // See https://github.com/Vizzuality/grainstore/issues/39
  test('2.0.0 to 2.1.0, arrow marker specified in outer block', function (done) {
    var style = "#t{ marker-type:arrow; } #t[id=1] { marker-fill:red; }";
    var e = "#t{ marker-type:arrow; [\"mapnik::geometry_type\"=1] { marker-placement:point; marker-type:ellipse; } [\"mapnik::geometry_type\">1] { marker-placement:line; marker-clip:false; } } #t[id=1] { marker-fill:red; [\"mapnik::geometry_type\"=1] { marker-placement:point; marker-type:ellipse; } [\"mapnik::geometry_type\">1] { marker-placement:line; marker-clip:false; } }";

    t.transform(style, '2.0.0', '2.1.0', function (err, s) {
        assert.ifError(err);
        assert.equal(s, e);
        done();
    });
  });

  // See https://github.com/Vizzuality/grainstore/issues/40
  test('2.0.0 to 2.1.0, marker-opacity', function (done) {
    var style = "#t{marker-opacity:0.5;}";
    var e = "#t{ marker-fill-opacity:0.5; [\"mapnik::geometry_type\"=1] { marker-placement:point; marker-type:ellipse; } [\"mapnik::geometry_type\">1] { marker-placement:line; marker-type:arrow; marker-transform:scale(.5, .5); marker-clip:false; } }";

    t.transform(style, '2.0.0', '2.1.0', function (err, s) {
        assert.ifError(err);
        assert.equal(s, e);
        done();
    });
  });

  test('transform retains quotes in CartoCSS 1', function (done) {
    var style = "#t [t=\"ja'ja\\\"ja\"] {  }";
    var e = "#t [t=\"ja'ja\\\"ja\"] {  }";

    t.transform(style, '2.0.0','2.1.0', function (err, s) {
        assert.ifError(err);
        assert.equal(s, e);
        done();
    });
  });



  test('transform retains quotes in CartoCSS 2', function (done) {
    var style = "#t [t='ja\\\'ja\"ja'] {  }";
    var e = "#t [t='ja\\'ja\"ja'] {  }";

    t.transform(style , '2.0.0','2.1.0', function (err, s) {
        assert.ifError(err);
        assert.equal(s, e);
        done();
    });
  });

  test('2.1.1 to 2.2.0, mapnik-geometry-type', function (done) {
    var style = "#t [mapnik-geometry-type=1] { marker-fill:red; }";
    var e = '#t ["mapnik::geometry_type"=1] { marker-fill:red; }';
    t.transform(style, '2.1.1', '2.2.0', function (err, s) {
        assert.ifError(err);
        assert.equal(s, e);
        done();
    });
  });

  test('2.0.1 to 2.2.0', function (done) {
    var style = "#t [mapnik-geometry-type=1] { line-color:red; }";
    var e = '#t ["mapnik::geometry_type"=1] { line-color:red; }';

    t.transform(style, '2.0.1', '2.2.0', function (err, s) {
        assert.ifError(err);
        assert.equal(s, e);
        done();
    });
  });

  test('2.1.1 to 2.1.0', function (done) {
    t.transform( "#t { }", '2.1.1', '2.1.0', function (e) {
        assert.ok(e);
        assert.ok(RegExp(/No CartoCSS transform path/).exec(e),
                  "Unexpected exception message " + e);
        done();
    });

  });

  test('2.1.1 to 2.2.1', function (done) {
    t.transform( "#t { }", '2.1.1', '2.2.1', function (e) {
        assert.ok(e);
        assert.ok(RegExp(/No CartoCSS transform path/).exec(e),
                  "Unexpected exception message " + e);
        done();
    });
  });

  //-----------------------------------------------------------------
  // setLayerName
  //-----------------------------------------------------------------


  // See https://github.com/Vizzuality/grainstore/issues/54
  test('layername replacement', function() {
    var s = t.setLayerName("#t{ [l='1']{ marker-line-color: #FFF;} [l='2'] { marker-line-color: #FF1;} }", 'layer0');
    var e = "#layer0 { [l='1']{ marker-line-color: #FFF;} [l='2'] { marker-line-color: #FF1;} }";
    assert.equal(s, e);
  });

  // See https://github.com/Vizzuality/grainstore/issues/57
  test('layername replacement with labels', function() {
    var s = t.setLayerName("#t { marker-color: #FFF; } #t::l1 { text-name: [name]; }", 'layer0');
    var e = "#layer0 { marker-color: #FFF; } #layer0 ::l1 { text-name: [name]; }";
    assert.equal(s, e);
  });

  test('setLayerName retains quotes in CartoCSS', function() {
    var s = t.setLayerName( "#t [t=\"ja'ja\\\"ja\"] {  }", 's');
    var e = "#s [t=\"ja'ja\\\"ja\"] {  }";
    assert.equal(s, e);

    var s = t.setLayerName( "#t [t='ja\\\'ja\"ja'] {  }", 's');
    var e = "#s [t='ja\\'ja\"ja'] {  }";
    assert.equal(s, e);
  });


  //suiteTeardown(function() { });

});
