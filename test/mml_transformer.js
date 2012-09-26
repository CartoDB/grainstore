var assert     = require('assert');
var _          = require('underscore');
var MMLTransformer = require('../lib/grainstore/mml_transformer.js');

suite('mml_transformer', function() {

  //suiteSetup(function() { });

  test('add missing version, no transform', function() {

    var t = new MMLTransformer('2.0.2', '2.0.2');
    var s = t.transform('#t { marker-width:10; marker-height:5}');
    assert.equal(s, "version: '2.0.2'; #t { marker-width:10; marker-height:5}");

    var t = new MMLTransformer('2.1.0', '2.1.0');
    var s = t.transform('#t { marker-width:10; marker-height:5}');
    assert.equal(s, "version: '2.1.0'; #t { marker-width:10; marker-height:5}");

    // Don't be fooled by version within style
    var s = t.transform('#t { text-name: "version: \'2.1.0\'"; }');
    assert.equal(s, 'version: \'2.1.0\'; #t { text-name: "version: \'2.1.0\'"; }');

  });

  test('adapt version, no transform', function() {

    var t = new MMLTransformer('2.0.2', '2.1.0');

    var s = t.transform("version: '2.0.2'; #t {}");
    assert.equal(s, "version: '2.1.0'; #t {}");

    // no space between 'version:' and the version
    var s = t.transform("version:'2.0.2'; #t {}");
    assert.equal(s, "version: '2.1.0'; #t {}");

    // multiple spaces between 'version:' and the version
    var s = t.transform("version:  '2.0.2'; #t {}");
    assert.equal(s, "version: '2.1.0'; #t {}");

    // spaces, tabs and newlines between 'version:' and the version
    var s = t.transform("version: \t  \n '2.0.2'; #t {}");
    assert.equal(s, "version: '2.1.0'; #t {}");

    // More spaces in version
    var s = t.transform("\n \t version \t \n : \t  \n '2.0.2'; #t {}");
    assert.equal(s, "version: '2.1.0'; #t {}");

    // Version string in double quotes
    var s = t.transform("\n \t version \t \n : \t  \n \"2.0.2\"; #t {}");
    assert.equal(s, "version: '2.1.0'; #t {}");

    // TODO: write version after a comment, should it be valid ?
    // "/* comment */ version: '2.1.0'; #t {}"

  });

  // Adapts marker width and height, from 2.0.2 (missing) to 2.1.0
  test('2.0.2 (missing) to 2.1.0, markers', function() {
    var t = new MMLTransformer('2.0.2', '2.1.0');
    var s = t.transform(
"#tab[zoom=1] { marker-width:10; marker-height:20; }\n#tab[zoom=2] { marker-height:'6'; marker-width: '7'; }"
    );
    assert.equal(s,
"version: '2.1.0'; #tab[zoom=1] { marker-width:20; marker-height:40; }\n#tab[zoom=2] { marker-height:12; marker-width:14; }"
    );
  });

  // Adapts marker width and height, from 2.0.2 (expliclit) to 2.1.0
  test('2.0.2 (explicit) to 2.1.0, markers', function() {
    var t = new MMLTransformer('2.0.2', '2.1.0');
    var s = t.transform(
"version: '2.0.2'; #tab { marker-height: 10; marker-width: 20; }"
    );
    assert.equal(s,
"version: '2.1.0'; #tab { marker-height:20; marker-width:40; }"
    );
  });

  //suiteTeardown(function() { });

});
