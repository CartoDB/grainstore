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
    var s = t.transform(style, '2.0.0', '2.0.3');
    assert.equal(s, style);
  });

  // No change from 2.0.2 to ~2.0.3
  test('2.0.2 to ~2.0.3', function() {
    var style = "#tab[zoom=1] { marker-width:10; marker-height:20; }\n#tab[zoom=2] { marker-height:'6'; marker-width: '7'; }";
    var s = t.transform(style, '2.0.2', '2.0.3');
    assert.equal(s, style);
  });

  // Adapts marker width and height, from 2.0.2 to 2.1.0
  test('2.0.2 to 2.1.0, markers', function() {
    var s = t.transform(
"#tab[zoom=1] { marker-width:10; marker-height:20; }\n#tab[zoom=2] { marker-height:'6'; marker-width: '7'; }"
    , '2.0.2', '2.1.0'
    );
    assert.equal(s,
"#tab[zoom=1] { marker-width:20; marker-height:40; marker-placement:line; }\n#tab[zoom=2] { marker-height:'12'; marker-width:'14'; marker-placement:line; }"
    );

    var s = t.transform(
"#t { marker-width :\n10; \nmarker-height\t:   20; }"
    , '2.0.2', '2.1.0'
    );
    assert.equal(s,
"#t { marker-width:20; \nmarker-height:40; marker-placement:line; }"
    );

  });

  // Adapts marker width and height, from 2.0.0 to 2.1.0
  test('2.0.0 to 2.1.0, markers', function() {
    var s = t.transform(
"#tab[zoom=1] { marker-width:10; marker-height:20; }\n#tab[zoom=2] { marker-height:'6'; marker-width: \"7\"; }"
    , '2.0.0', '2.1.0'
    );
    assert.equal(s,
"#tab[zoom=1] { marker-width:20; marker-height:40; marker-placement:line; }\n#tab[zoom=2] { marker-height:'12'; marker-width:\"14\"; marker-placement:line; }"
    );

    var s = t.transform(
"#t { marker-width :\n10; \nmarker-height\t:   20; }"
    , '2.0.0', '2.1.0'
    );
    assert.equal(s,
"#t { marker-width:20; \nmarker-height:40; marker-placement:line; }"
    );

    var s = t.transform(
"#tab { marker-width:2 }"
    , '2.0.0', '2.1.0'
    );
    assert.equal(s,
"#tab { marker-width:4; marker-placement:line; }"
    );

  });

  // Adapts marker-placement default, from 2.0.0 to 2.1.0
  //
  // The default changed from "line" to "point", we want to set it back to "line"
  // See https://github.com/mapnik/mapnik/wiki/API-changes-between-v2.0-and-v2.1
  test('2.0.0 to 2.1.0, marker-placement default', function() {

    // Add a default marker-placement to an empty style
    var s = t.transform(
      "#t { }"
    , '2.0.0', '2.1.0');
    assert.equal(s, 
      "#t { marker-placement:line; }"
    , '2.0.0', '2.1.0');

    // Add a default marker-placement to an empty multiline style
    var s = t.transform(
      "#t { \t \n}"
    , '2.0.0', '2.1.0');
    assert.equal(s, 
      "#t { marker-placement:line; }"
    , '2.0.0', '2.1.0');

    // Add a default to a non-empty style
    var s = t.transform(
      "#t { marker-fill:'#ff0000'; }"
    , '2.0.0', '2.1.0');
    assert.equal(s, 
      "#t { marker-fill:'#ff0000'; marker-placement:line; }"
    , '2.0.0', '2.1.0');

    // Add a default without overriding
    // existing setting (only first label is used)
    var s = t.transform(
      "#t { marker-fill:'#ff0000'; marker-placement:point; }"
    , '2.0.0', '2.1.0');
    assert.equal(s, 
      "#t { marker-fill:'#ff0000'; marker-placement:point; marker-placement:line; }"
    , '2.0.0', '2.1.0');

  });

  //suiteTeardown(function() { });

});
