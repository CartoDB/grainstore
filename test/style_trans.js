var assert     = require('assert');
var _          = require('underscore');
var StyleTrans = require('../lib/grainstore/style_trans.js');

var t = new StyleTrans();

suite('style_trans', function() {

  //suiteSetup(function() { });

  // Adapts marker width and height, from 2.0.2 to 2.1.0
  test('2.0.2 to 2.1.0, markers', function() {
    var s = t.transform(
"#tab[zoom=1] { marker-width:10; marker-height:20; }\n#tab[zoom=2] { marker-height:'6'; marker-width: '7'; }"
    , '2.0.2', '2.1.0'
    );
    assert.equal(s,
"#tab[zoom=1] { marker-width:20; marker-height:40; }\n#tab[zoom=2] { marker-height:'12'; marker-width:'14'; }"
    );

    var s = t.transform(
"#t { marker-width :\n10; \nmarker-height\t:   20; }; }"
    , '2.0.2', '2.1.0'
    );
    assert.equal(s,
"#t { marker-width:20; \nmarker-height:40; }; }"
    );

  });

  // Adapts marker width and height, from 2.0.0 to 2.1.0
  test('2.0.0 to 2.1.0, markers', function() {
    var s = t.transform(
"#tab[zoom=1] { marker-width:10; marker-height:20; }\n#tab[zoom=2] { marker-height:'6'; marker-width: \"7\"; }"
    , '2.0.0', '2.1.0'
    );
    assert.equal(s,
"#tab[zoom=1] { marker-width:20; marker-height:40; }\n#tab[zoom=2] { marker-height:'12'; marker-width:\"14\"; }"
    );

    var s = t.transform(
"#t { marker-width :\n10; \nmarker-height\t:   20; }; }"
    , '2.0.0', '2.1.0'
    );
    assert.equal(s,
"#t { marker-width:20; \nmarker-height:40; }; }"
    );

    var s = t.transform(
"#tab { marker-width:2 }"
    , '2.0.0', '2.1.0'
    );
    assert.equal(s,
"#tab { marker-width:4 }"
    );

  });

  //suiteTeardown(function() { });

});
