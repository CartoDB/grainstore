var assert     = require('assert');
var _          = require('underscore');
var StyleTrans = require('../lib/grainstore/style_trans.js');

var t = new StyleTrans();

suite('style_trans', function() {

  //suiteSetup(function() { });

  // No change from 2.0.0 to ~2.0.2 
  test('2.0.0 to ~2.0.2', function() {
    var style = "#tab[zoom=1] { marker-width:10; marker-height:20; }\n#tab[zoom=2] { marker-height:'6'; marker-width: '7'; }";
    var s = t.transform(style, '2.0.0', '2.0.2');
    assert.equal(s, style);
    s = t.transform(style, '2.0.0', '2.0.3');
    assert.equal(s, style);
  });

  // No change from 2.0.2 to ~2.0.3
  test('2.0.2 to ~2.0.3', function() {
    var style = "#tab[zoom=1] { marker-width:10; marker-height:20; }\n" +
        "#tab[zoom=2] { marker-height:'6'; marker-width: '7'; }";
    var s = t.transform(style, '2.0.2', '2.0.3');
    assert.equal(s, style);
  });

  // Adapts marker width and height, from 2.0.2 to 2.1.0
  test('2.0.2 to 2.1.0, markers', function() {
    var s = t.transform(
        "#tab[zoom=1] { marker-width:10; marker-height:20; }\n#tab[zoom=2] { marker-height:'6'; marker-width: '7'; }",
        '2.0.2', '2.1.0'
    );
    var e = "#tab[zoom=1] { marker-width:20; marker-height:40; [\"mapnik::geometry_type\"=1] { marker-placement:point; marker-type:ellipse; } [\"mapnik::geometry_type\">1] { marker-placement:line; marker-type:arrow; marker-transform:scale(.5, .5); marker-clip:false; } }\n#tab[zoom=2] { marker-height:'12'; marker-width:'14'; [\"mapnik::geometry_type\"=1] { marker-placement:point; marker-type:ellipse; } [\"mapnik::geometry_type\">1] { marker-placement:line; marker-type:arrow; marker-transform:scale(.5, .5); marker-clip:false; } }"
    assert.equal(s,e);

    s = t.transform(
"#t { marker-width :\n10; \nmarker-height\t:   20; }"
    , '2.0.2', '2.1.0'
    );
    e = "#t { marker-width:20; \n" +
        "marker-height:40; [\"mapnik::geometry_type\"=1] { marker-placement:point; marker-type:ellipse; } " +
        "[\"mapnik::geometry_type\">1] { " +
        "marker-placement:line; marker-type:arrow; marker-transform:scale(.5, .5); marker-clip:false; } }";
    assert.equal(s,e);

  });

  // More markers, see https://github.com/Vizzuality/grainstore/issues/30
  test('2.0.0 to 2.1.0, more markers', function() {
    var s = t.transform("#t [a<1] { marker-width:1 } # [a>1] { marker-width:2 }", '2.0.2', '2.1.0');
    var e = "#t [a<1] { marker-width:2; " +
        "[\"mapnik::geometry_type\"=1] { marker-placement:point; marker-type:ellipse; } " +
        "[\"mapnik::geometry_type\">1] {" +
        " marker-placement:line; marker-type:arrow; marker-transform:scale(.5, .5); marker-clip:false; } }" +
        " # [a>1] { marker-width:4; " +
        "[\"mapnik::geometry_type\"=1] { marker-placement:point; marker-type:ellipse; } " +
        "[\"mapnik::geometry_type\">1] {" +
        " marker-placement:line; marker-type:arrow; marker-transform:scale(.5, .5); marker-clip:false; } }";
//console.log("O:"+s);
//console.log("E:"+e);
    assert.equal(s, e);
  });

  // More markers, see https://github.com/Vizzuality/grainstore/issues/33
  test('2.0.0 to 2.1.0, markers dependent on filter', function() {
    var s = t.transform(
      "#t[a=1] { marker-width:1 } #t[a=2] { line-color:red } #t[a=3] { marker-placement:line }" , '2.0.2', '2.1.0'
    );
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
    assert.equal(s, e);
  });

  // Adapts marker width and height, from 2.0.0 to 2.1.0
  test('2.0.0 to 2.1.0, markers', function() {
    var s = t.transform(
        "#tab[zoom=1] { marker-width:10; marker-height:20; }\n#tab[zoom=2] { marker-height:'6'; marker-width: \"7\"; }",
        '2.0.0', '2.1.0'
    );
    var e = "#tab[zoom=1] { marker-width:20; marker-height:40; [\"mapnik::geometry_type\"=1] { marker-placement:point; marker-type:ellipse; } [\"mapnik::geometry_type\">1] { marker-placement:line; marker-type:arrow; marker-transform:scale(.5, .5); marker-clip:false; } }\n#tab[zoom=2] { marker-height:'12'; marker-width:\"14\"; [\"mapnik::geometry_type\"=1] { marker-placement:point; marker-type:ellipse; } [\"mapnik::geometry_type\">1] { marker-placement:line; marker-type:arrow; marker-transform:scale(.5, .5); marker-clip:false; } }"
//console.log("O:"+s);
//console.log("E:"+e);
    assert.equal(s, e, "Obt:"+s+"\nExp:"+s);

    var s = t.transform(
"#t { marker-width :\n10; \nmarker-height\t:   20; }"
    , '2.0.0', '2.1.0'
    );
    var e = "#t { marker-width:20; \nmarker-height:40; [\"mapnik::geometry_type\"=1] { marker-placement:point; marker-type:ellipse; } [\"mapnik::geometry_type\">1] { marker-placement:line; marker-type:arrow; marker-transform:scale(.5, .5); marker-clip:false; } }"
    assert.equal(s, e);

    var s = t.transform(
"#tab { marker-width:2 }"
    , '2.0.0', '2.1.0'
    );
    var e = "#tab { marker-width:4; [\"mapnik::geometry_type\"=1] { marker-placement:point; marker-type:ellipse; } [\"mapnik::geometry_type\">1] { marker-placement:line; marker-type:arrow; marker-transform:scale(.5, .5); marker-clip:false; } }"
    assert.equal(s, e);

    var s = t.transform(
"#tab{ marker-width:2 }"
    , '2.0.0', '2.1.0'
    );
    var e = "#tab{ marker-width:4; [\"mapnik::geometry_type\"=1] { marker-placement:point; marker-type:ellipse; } [\"mapnik::geometry_type\">1] { marker-placement:line; marker-type:arrow; marker-transform:scale(.5, .5); marker-clip:false; } }";
    assert.equal(s, e);

  });

  test('2.0.0 to 2.1.0, line clipping', function() {
    var s = t.transform(
"#tab{ line-opacity:.5 }"
    , '2.0.0', '2.1.0'
    );
    var e = "#tab{ line-opacity:.5; }";
    assert.equal(s, e);
  });

  test('2.0.0 to 2.1.0, line clipping, bug #37', function() {
    var s = t.transform(
"#t{ marker-line-color:red; }"
    , '2.0.0', '2.1.0'
    );
    var e = "#t{ marker-line-color:red; [\"mapnik::geometry_type\"=1] { marker-placement:point; marker-type:ellipse; } [\"mapnik::geometry_type\">1] { marker-placement:line; marker-type:arrow; marker-transform:scale(.5, .5); marker-clip:false; } }"
    assert.equal(s, e);
  });

  test('2.0.0 to 2.1.0, polygon clipping', function() {
    var s = t.transform(
"#tab{ polygon-fill:red }"
    , '2.0.0', '2.1.0'
    );
    var e = "#tab{ polygon-fill:red; }";
    assert.equal(s, e);
  });

  // https://github.com/Vizzuality/grainstore/issues/35
  test('2.0.0 to 2.1.0, one line comments', function() {
    var s = t.transform(
"#tab{ //polygon-fill:red;\n}"
    , '2.0.0', '2.1.0'
    );
    var e = "#tab{  }";
    assert.equal(s, e);
  });

  // https://github.com/Vizzuality/grainstore/issues/41
  test('2.0.0 to 2.1.0, multiple one line comments', function() {
    var s = t.transform(
"#tab{ //polygon-fill:red;\n //marker-type:ellipse;\n }"
    , '2.0.0', '2.1.0'
    );
    var e = "#tab{  }";
    assert.equal(s, e);
  });

  test('2.0.0 to 2.1.0, symbolizers hidden in one line comments', function() {
    var s = t.transform(
"#tab{ //polygon-fill:red;\n line-opacity:1; }"
    , '2.0.0', '2.1.0'
    );
    var e = "#tab{ line-opacity:1; }";
    assert.equal(s, e);
  });

  test('2.0.0 to 2.1.0, symbolizers hidden in multiline line comments', function() {
    var s = t.transform(
"#tab{ /* polygon-fill:\nred; */ line-opacity:1; }"
    , '2.0.0', '2.1.0'
    );
    var e = "#tab{ line-opacity:1; }";
    assert.equal(s, e);
  });

  test('2.0.0 to 2.1.0, missing semicolon', function() {
    var s = t.transform(
"#t{ marker-placement:point; marker-width:8}"
    , '2.0.0', '2.1.0'
    );
    var e = "#t{ marker-placement:point; marker-width:16; [\"mapnik::geometry_type\"=1] { marker-placement:point; marker-type:ellipse; } [\"mapnik::geometry_type\">1] { marker-type:ellipse; marker-clip:false; } }";
    assert.equal(s, e);
  });

  test('2.0.0 to 2.1.1, marker-multi-policy', function() {
    var s = t.transform(
"#t{ marker-fill-color:red; }"
    , '2.0.0', '2.1.1'
    );
    var e = "#t{ marker-fill-color:red; [\"mapnik::geometry_type\"=1] { marker-placement:point; marker-type:ellipse; } [\"mapnik::geometry_type\">1] { marker-placement:line; marker-type:arrow; marker-transform:scale(.5, .5); marker-clip:false; } marker-multi-policy:whole; }"
    assert.equal(s, e);
  });

  // Nothing to adapt (yet) when no markers are involved
  test('2.0.0 to 2.1.0, no markers', function() {
    var s = t.transform(
"#tab[zoom=1] { line-fill:red; }\n#tab[zoom=2] { polygon-fill:blue; }"
    , '2.0.0', '2.1.0'
    );
    assert.equal(s,
"#tab[zoom=1] { line-fill:red; }\n#tab[zoom=2] { polygon-fill:blue; }"
    );

  });

  // See https://github.com/Vizzuality/grainstore/issues/39
  test('2.0.0 to 2.1.0, arrow marker specified in outer block', function() {
    var s = t.transform(
"#t{ marker-type:arrow; } #t[id=1] { marker-fill:red; }"
    , '2.0.0', '2.1.0'
    );
    var e = "#t{ marker-type:arrow; [\"mapnik::geometry_type\"=1] { marker-placement:point; marker-type:ellipse; } [\"mapnik::geometry_type\">1] { marker-placement:line; marker-clip:false; } } #t[id=1] { marker-fill:red; [\"mapnik::geometry_type\"=1] { marker-placement:point; marker-type:ellipse; } [\"mapnik::geometry_type\">1] { marker-placement:line; marker-clip:false; } }";
    assert.equal(s, e);
  });

  // See https://github.com/Vizzuality/grainstore/issues/40
  test('2.0.0 to 2.1.0, marker-opacity', function() {
    var s = t.transform(
"#t{marker-opacity:0.5;}"
    , '2.0.0', '2.1.0'
    );
    var e = "#t{ marker-fill-opacity:0.5; [\"mapnik::geometry_type\"=1] { marker-placement:point; marker-type:ellipse; } [\"mapnik::geometry_type\">1] { marker-placement:line; marker-type:arrow; marker-transform:scale(.5, .5); marker-clip:false; } }";
    assert.equal(s, e);
  });

  test('transform retains quotes in CartoCSS', function() {
    var s = t.transform( "#t [t=\"ja'ja\\\"ja\"] {  }", '2.0.0','2.1.0');
    var e = "#t [t=\"ja'ja\\\"ja\"] {  }";
    assert.equal(s, e);

    var s = t.transform( "#t [t='ja\\\'ja\"ja'] {  }", '2.0.0','2.1.0');
    var e = "#t [t='ja\\'ja\"ja'] {  }";
    assert.equal(s, e);
  });

  test('2.1.1 to 2.2.0, mapnik-geometry-type', function() {
    var s = t.transform(
"#t [mapnik-geometry-type=1] { marker-fill:red; }"
    , '2.1.1', '2.2.0'
    );
    var e = '#t ["mapnik::geometry_type"=1] { marker-fill:red; }';
    assert.equal(s, e);
  });

  test('2.0.1 to 2.2.0', function() {
    var s = t.transform(
"#t [mapnik-geometry-type=1] { line-color:red; }"
    , '2.0.1', '2.2.0'
    );
    var e = '#t ["mapnik::geometry_type"=1] { line-color:red; }';
    assert.equal(s, e);
  });

  test('2.1.1 to 2.1.0', function() {
    var e = null;
    try { t.transform( "#t { }", '2.1.1', '2.1.0'); }
    catch (err) { e = err }
    assert.ok(e);
    assert.ok(RegExp(/No CartoCSS transform path/).exec(e),
              "Unexpected exception message " + e);
  });

  test('2.1.1 to 2.2.1', function() {
    var e = null;
    try { t.transform( "#t { }", '2.1.1', '2.2.1'); }
    catch (err) { e = err }
    assert.ok(e);
    assert.ok(RegExp(/No CartoCSS transform path/).exec(e),
              "Unexpected exception message " + e);
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
