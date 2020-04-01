'use strict';

var assert = require('assert');
var _ = require('underscore');
var grainstore = require('../lib/grainstore');
var libxmljs = require('libxmljs');
var step = require('step');
var http = require('http');
var fs = require('fs');
var carto = require('carto');
var semver = require('semver');

var server;

var serverPort = 8033;

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

[false, true].forEach(function (useWorkers) {
    suite('mmlBuilder use_workers=' + useWorkers, function () {
        suiteSetup(function (done) {
            // Start a server to test external resources
            server = http.createServer(function (request, response) {
                var filename = 'test/support/resources' + request.url;
                fs.readFile(filename, 'binary', function (err, file) {
                    if (err) {
                        response.writeHead(404, { 'Content-Type': 'text/plain' });
                        console.log("File '" + filename + "' not found");
                        response.write('404 Not Found\n');
                    } else {
                        response.writeHead(200);
                        response.write(file, 'binary');
                    }
                    response.end();
                });
            });
            server.listen(serverPort, done);
        });

        suiteTeardown(function () {
            server.close();
        });

        test('can generate base mml with normal ops', function (done) {
            var mmlStore = new grainstore.MMLStore({ use_workers: useWorkers });
            var mmlBuilder = mmlStore.mml_builder({ dbname: 'my_database', sql: SAMPLE_SQL, style: DEFAULT_POINT_STYLE });
            var baseMML = mmlBuilder.baseMML();

            assert.ok(_.isArray(baseMML.Layer));
            assert.equal(baseMML.Layer[0].id, 'layer0');
            assert.equal(baseMML.Layer[0].Datasource.dbname, 'my_database');

            done();
        });

        test('can be initialized with custom style and version', function (done) {
            var mmlStore = new grainstore.MMLStore({ use_workers: useWorkers, mapnik_version: '2.1.0' });
            mmlStore.mml_builder({ dbname: 'd', sql: SAMPLE_SQL, style: DEFAULT_POINT_STYLE, styleVersion: '2.0.2' })
                .toXML(done);
        });

        test('can be initialized with custom interactivity', function (done) {
            var mmlStore = new grainstore.MMLStore({ use_workers: useWorkers, mapnik_version: '2.1.0' });
            mmlStore.mml_builder({ dbname: 'd', sql: SAMPLE_SQL, style: DEFAULT_POINT_STYLE, interactivity: 'cartodb_id' })
                .toXML(done);
        });

        test('can generate base mml with overridden authentication', function (done) {
            var mmlStore = new grainstore.MMLStore({
                use_workers: useWorkers,
                datasource: {
                    user: 'overridden_user',
                    password: 'overridden_password'
                }
            }
            );
            var mmlBuilder = mmlStore.mml_builder({
                dbname: 'my_database',
                sql: SAMPLE_SQL,
                style: DEFAULT_POINT_STYLE,
                // NOTE: authentication tokens here are silently discarded
                user: 'shadow_user',
                password: 'shadow_password'
            });
            var baseMML = mmlBuilder.baseMML();

            assert.ok(_.isArray(baseMML.Layer));
            assert.equal(baseMML.Layer[0].id, 'layer0');
            assert.equal(baseMML.Layer[0].Datasource.dbname, 'my_database');
            assert.equal(baseMML.Layer[0].Datasource.user, 'overridden_user');
            assert.equal(baseMML.Layer[0].Datasource.password, 'overridden_password');

            done();
        });

        test('search_path is set in the datasource', function (done) {
            var searchPath = "'foo', 'bar'";
            var mmlStore = new grainstore.MMLStore({ use_workers: useWorkers });
            var mmlBuilder = mmlStore.mml_builder(
                { dbname: 'my_database', sql: SAMPLE_SQL, style: DEFAULT_POINT_STYLE, search_path: searchPath }
            );

            var baseMML = mmlBuilder.baseMML();
            assert.equal(baseMML.Layer[0].Datasource.search_path, searchPath);
            done();
        });

        test('search_path is NOT set in the datasource', function (done) {
            var mmlStore = new grainstore.MMLStore({ use_workers: useWorkers });
            var mmlBuilder = mmlStore.mml_builder(
                { dbname: 'my_database', sql: SAMPLE_SQL, style: DEFAULT_POINT_STYLE, search_path: null }
            );
            var baseMML = mmlBuilder.baseMML();
            assert.ok(
                !Object.prototype.hasOwnProperty.call(baseMML.Layer[0].Datasource, 'search_path'),
                'search_path was not expected in the datasource but was found with value: ' +
                baseMML.Layer[0].Datasource.search_path
            );
            done();
        });

        test('default format is png', function (done) {
            var mmlStore = new grainstore.MMLStore({ use_workers: useWorkers });
            var mmlBuilder = mmlStore.mml_builder({ dbname: 'my_database', sql: SAMPLE_SQL, style: DEFAULT_POINT_STYLE });
            var baseMML = mmlBuilder.baseMML();
            assert.equal(baseMML.format, 'png');
            done();
        });

        test('format can be overwritten with optional args', function (done) {
            var format = 'png32';
            var mmlStore = new grainstore.MMLStore({ use_workers: useWorkers, mapnik_tile_format: format });
            var mmlBuilder = mmlStore.mml_builder({ dbname: 'my_database', sql: SAMPLE_SQL, style: DEFAULT_POINT_STYLE });
            var baseMML = mmlBuilder.baseMML();
            assert.equal(baseMML.format, format);
            done();
        });

        test('can override authentication with mmlBuilder constructor', function (done) {
            var mmlStore = new grainstore.MMLStore({
                use_workers: useWorkers,
                datasource: { user: 'shadow_user', password: 'shadow_password' }
            });
            var mmlBuilder = mmlStore.mml_builder({
                dbname: 'my_database',
                sql: SAMPLE_SQL,
                style: DEFAULT_POINT_STYLE,
                dbuser: 'overridden_user',
                dbpassword: 'overridden_password'
            }
            );

            var baseMML = mmlBuilder.baseMML();

            assert.ok(_.isArray(baseMML.Layer));
            assert.equal(baseMML.Layer[0].id, 'layer0');
            assert.equal(baseMML.Layer[0].Datasource.dbname, 'my_database');
            assert.equal(baseMML.Layer[0].Datasource.user, 'overridden_user');
            assert.equal(baseMML.Layer[0].Datasource.password, 'overridden_password');

            // Test that new mmlBuilder, with no overridden user/password, uses the default ones
            var mmlBuilder2 = mmlStore.mml_builder({ dbname: 'my_database', sql: SAMPLE_SQL, style: DEFAULT_POINT_STYLE });
            var baseMML2 = mmlBuilder2.baseMML();
            assert.equal(baseMML2.Layer[0].id, 'layer0');
            assert.equal(baseMML2.Layer[0].Datasource.dbname, 'my_database');
            assert.equal(baseMML2.Layer[0].Datasource.user, 'shadow_user');
            assert.equal(baseMML2.Layer[0].Datasource.password, 'shadow_password');

            done();
        });

        // See https://github.com/CartoDB/grainstore/issues/70
        test('can override db host and port with mmlBuilder constructor', function (done) {
            var mmlStore = new grainstore.MMLStore({
                use_workers: useWorkers,
                datasource: { host: 'shadow_host', port: 'shadow_port' }
            });
            var mmlBuilder = mmlStore.mml_builder({
                dbname: 'my_database',
                sql: SAMPLE_SQL,
                style: DEFAULT_POINT_STYLE,
                dbhost: 'overridden_host',
                dbport: 'overridden_port'
            }
            );

            var baseMML = mmlBuilder.baseMML();

            assert.ok(_.isArray(baseMML.Layer));
            assert.equal(baseMML.Layer[0].id, 'layer0');
            assert.equal(baseMML.Layer[0].Datasource.dbname, 'my_database');
            assert.equal(baseMML.Layer[0].Datasource.host, 'overridden_host');
            assert.equal(baseMML.Layer[0].Datasource.port, 'overridden_port');

            // Test that new mmlBuilder, with no overridden user/password, uses the default ones
            var mmlBuilder2 = mmlStore.mml_builder({ dbname: 'my_database', sql: SAMPLE_SQL, style: DEFAULT_POINT_STYLE });
            var baseMML2 = mmlBuilder2.baseMML();
            assert.equal(baseMML2.Layer[0].id, 'layer0');
            assert.equal(baseMML2.Layer[0].Datasource.dbname, 'my_database');
            assert.equal(baseMML2.Layer[0].Datasource.host, 'shadow_host');
            assert.equal(baseMML2.Layer[0].Datasource.port, 'shadow_port');

            done();
        });

        test('can generate base mml with sql ops, maintain id', function (done) {
            var mmlStore = new grainstore.MMLStore({ use_workers: useWorkers });
            var mmlBuilder = mmlStore.mml_builder(
                { dbname: 'my_database', sql: 'SELECT * from my_table', style: DEFAULT_POINT_STYLE }
            );
            var baseMML = mmlBuilder.baseMML();
            assert.equal(baseMML.Layer[0].id, 'layer0');
            assert.equal(baseMML.Layer[0].Datasource.table, 'SELECT * from my_table');
            done();
        });

        test('can force plain base mml with sql ops', function (done) {
            var mmlStore = new grainstore.MMLStore({ use_workers: useWorkers });
            var mmlBuilder = mmlStore.mml_builder(
                { dbname: 'my_database', sql: SAMPLE_SQL, style: DEFAULT_POINT_STYLE }
            );
            var baseMML = mmlBuilder.baseMML();
            assert.equal(baseMML.Layer[0].id, 'layer0');
            assert.equal(baseMML.Layer[0].Datasource.table, SAMPLE_SQL);
            done();
        });

        test('can generate full mml with style', function (done) {
            var mmlStore = new grainstore.MMLStore({ use_workers: useWorkers });
            var mmlBuilder = mmlStore.mml_builder({ dbname: 'my_database', sql: SAMPLE_SQL, style: DEFAULT_POINT_STYLE });
            var mml = mmlBuilder.toMML('my carto style');
            assert.equal(mml.Stylesheet[0].data, 'my carto style');
            done();
        });

        test('can render XML from full mml with style', function (done) {
            var mmlStore = new grainstore.MMLStore({ use_workers: useWorkers });
            var mmlBuilder = mmlStore.mml_builder(
                { dbname: 'my_database', sql: 'my_table', style: '#my_table {\n  polygon-fill: #fff;\n}' }
            );
            mmlBuilder.toXML(function (err, output) {
                assert.ok(_.isNull(err), _.isNull(err) ? '' : err.message);
                assert.ok(output);
                done();
            });
        });

        test('Render a 2.2.0 style', function (done) {
            var style = '#t { polygon-fill: #fff; }';
            var mmlStore = new grainstore.MMLStore({ use_workers: useWorkers, mapnik_version: '2.2.0' });
            mmlStore.mml_builder({ dbname: 'd', sql: SAMPLE_SQL, style: style }).toXML(function (err, output) {
                try {
                    assert.ok(_.isNull(err), _.isNull(err) ? '' : err.message);
                    assert.ok(output);
                    var xmlDoc = libxmljs.parseXmlString(output);
                    // assert.equal(output, '');
                    var srs = xmlDoc.get('//PolygonSymbolizer/@fill');
                    assert.equal(srs.value(), '#ffffff');
                    done();
                } catch (err) { done(err); }
            });
        });

        test('can render errors from full mml with bad style', function (done) {
            var mmlStore = new grainstore.MMLStore({ use_workers: useWorkers });
            mmlStore.mml_builder(
                { dbname: 'my_database', sql: SAMPLE_SQL, style: '#my_table {\n  backgrxxxxxound-color: #fff;\n}' }
            ).toXML(function (err) {
                assert.ok(err.message.match(/Unrecognized rule/), err.message);
                done();
            });
        });

        test('can render multiple errors from full mml with bad style', function (done) {
            var mmlStore = new grainstore.MMLStore({ use_workers: useWorkers });
            mmlStore.mml_builder(
                { dbname: 'my_database', sql: SAMPLE_SQL, style: '#my_table {\n  backgrxxound-color: #fff;bad-tag: #fff;\n}' }
            ).toXML(
                function (err) {
                    assert.ok(err.message.match(/Unrecognized rule[\s\S]*Unrecognized rule/), err.message);
                    done();
                }
            );
        });

        test('retrieves a dynamic style should return XML with dynamic style', function (done) {
            var mmlStore = new grainstore.MMLStore({ use_workers: useWorkers });
            mmlStore.mml_builder({ dbname: 'my_databaasez', sql: 'my_tablez', style: '#my_tablez {marker-fill: #000000;}' })
                .toXML(function (err, data) {
                    if (err) { return done(err); }
                    var xmlDoc = libxmljs.parseXmlString(data);
                    var color = xmlDoc.get('//@fill');
                    assert.equal(color.value(), '#000000');
                    done();
                });
        });

        test('includes interactivity in XML', function (done) {
            var mmlStore = new grainstore.MMLStore({ use_workers: useWorkers });
            mmlStore.mml_builder(
                {
                    dbname: 'd2',
                    sql: SAMPLE_SQL,
                    style: DEFAULT_POINT_STYLE,
                    interactivity: 'a,b'
                }).toXML(function (err, data) {
                if (err) { return done(err); }
                var xmlDoc = libxmljs.parseXmlString(data);
                var x = xmlDoc.get("//Parameter[@name='interactivity_layer']");
                assert.ok(x);
                assert.equal(x.text(), 'layer0');
                x = xmlDoc.get("//Parameter[@name='interactivity_fields']");
                assert.ok(x);
                assert.equal(x.text(), 'a,b');
                done();
            });
        });

        // See https://github.com/Vizzuality/grainstore/issues/61
        test('zoom variable is special', function (done) {
            var mmlStore = new grainstore.MMLStore({ use_workers: useWorkers });
            mmlStore.mml_builder(
                {
                    dbname: 'd',
                    sql: SAMPLE_SQL,
                    style: '#t [ zoom  >=  4 ] {marker-fill:red;}'
                }).toXML(function (err, data) {
                if (err) { return done(err); }
                var xmlDoc = libxmljs.parseXmlString(data);
                var xpath = '//MaxScaleDenominator';
                var x = xmlDoc.get(xpath);
                assert.ok(x, "Xpath '" + xpath + "' does not match " + xmlDoc);
                assert.equal(x.text(), '50000000');
                done();
            });
        });

        test('quotes in CartoCSS are accepted', function (done) {
            var mmlStore = new grainstore.MMLStore({ use_workers: useWorkers });
            mmlStore.mml_builder(
                {
                    dbname: 'd',
                    table: 't',
                    sql: ["select 'x' as n, 'SRID=3857;POINT(0 0)'::geometry as the_geom_webmercator",
                        "select 'x' as n, 'SRID=3857;POINT(2 0)'::geometry as the_geom_webmercator"],
                    style: ['#t [n="t\'q"] {marker-fill:red;}', '#t[n=\'t"q\'] {marker-fill:green;}']
                }).toXML(function (err, data) {
                if (err) { return done(err); }
                var xmlDoc = libxmljs.parseXmlString(data);
                var xpath = '//Filter';
                var x = xmlDoc.find(xpath);
                assert.equal(x.length, 2);
                for (var i = 0; i < 2; ++i) {
                    var f = x[i];
                    var m = f.toString().match(/(['"])t(\\?)(["'])q(['"])/);
                    assert.ok(m, 'Unexpected filter: ' + f.toString());
                    assert.equal(m[1], m[4]); // opening an closing quotes are the same
                    // internal quote must be different or escaped
                    assert.ok(m[3] !== m[1] || m[2] === '\\', 'Unescaped quote ' + m[3] + ' found: ' + f.toString());
                }
                done();
            });
        });

        test('base style and custom style keys do not affect each other', function (done) {
            var mmlStore = new grainstore.MMLStore({ use_workers: useWorkers });
            var style1 = '#tab { marker-fill: #111111; }';
            var style2 = '#tab { marker-fill: #222222; }';
            var style3 = '#tab { marker-fill: #333333; }';
            var baseBuilder = mmlStore.mml_builder({ dbname: 'db', sql: 'tab', style: style1 });
            var custBuilder = mmlStore.mml_builder({ dbname: 'db', sql: 'tab', style: style2 });
            step(
                function checkBase1 () {
                    var cb = this;
                    baseBuilder.toXML(function (err, xml) {
                        if (err) { cb(err); return; }
                        var xmlDoc = libxmljs.parseXmlString(xml);
                        var color = xmlDoc.get('//@fill');
                        assert.equal(color.value(), '#111111');
                        cb(null);
                    });
                },
                function checkCustom1 (err) {
                    if (err) {
                        throw err;
                    }
                    var cb = this;
                    custBuilder.toXML(function (err, xml) {
                        if (err) { cb(err); return; }
                        var xmlDoc = libxmljs.parseXmlString(xml);
                        var color = xmlDoc.get('//@fill');
                        assert.equal(color.value(), '#222222');
                        cb(null);
                    });
                },
                function checkCustom2 (err) {
                    if (err) {
                        throw err;
                    }
                    var cb = this;
                    mmlStore.mml_builder({ dbname: 'db', sql: 'tab', style: style3 }).toXML(function (err, xml) {
                        if (err) { cb(err); return; }
                        var xmlDoc = libxmljs.parseXmlString(xml);
                        var color = xmlDoc.get('//@fill');
                        assert.equal(color.value(), '#333333');
                        done();
                    });
                }
            );
        });

        test('can retrieve basic XML', function (done) {
            var mmlStore = new grainstore.MMLStore({ use_workers: useWorkers });
            mmlStore.mml_builder({ dbname: 'my_databaasez', sql: SAMPLE_SQL, style: DEFAULT_POINT_STYLE })
                .toXML(function (err, data) {
                    if (err) { done(err); return; }
                    var xmlDoc = libxmljs.parseXmlString(data);
                    var sql = xmlDoc.get("//Parameter[@name='table']");
                    assert.equal(sql.text(), SAMPLE_SQL);
                    done();
                });
        });

        test('XML contains connection parameters', function (done) {
            var mmlStore = new grainstore.MMLStore({
                use_workers: useWorkers,
                datasource: {
                    user: 'u', host: 'h', port: '12', password: 'p'
                }
            });
            mmlStore.mml_builder({ dbname: 'd', sql: SAMPLE_SQL, style: DEFAULT_POINT_STYLE }).toXML(function (err, data) {
                assert.ok(data, err);
                var xmlDoc = libxmljs.parseXmlString(data);
                var node = xmlDoc.get("//Parameter[@name='user']");
                assert.equal(node.text(), 'u');
                node = xmlDoc.get("//Parameter[@name='host']");
                assert.equal(node.text(), 'h');
                node = xmlDoc.get("//Parameter[@name='port']");
                assert.equal(node.text(), '12');
                node = xmlDoc.get("//Parameter[@name='password']");
                assert.equal(node.text(), 'p');
                done();
            });
        });

        test('can retrieve basic XML specifying sql', function (done) {
            var mmlStore = new grainstore.MMLStore({ use_workers: useWorkers });
            mmlStore.mml_builder({ dbname: 'db', sql: 'SELECT * FROM my_face', style: DEFAULT_POINT_STYLE })
                .toXML(function (err, data) {
                    if (err) { done(err); return; }
                    var xmlDoc = libxmljs.parseXmlString(data);
                    var sql = xmlDoc.get("//Parameter[@name='table']");
                    assert.equal(sql.text(), 'SELECT * FROM my_face');
                    mmlStore.mml_builder({ dbname: 'db', sql: 'tab', style: DEFAULT_POINT_STYLE }).toXML(function (err, data) {
                        if (err) { done(err); return; }
                        var xmlDoc = libxmljs.parseXmlString(data);
                        var sql = xmlDoc.get("//Parameter[@name='table']");
                        assert.equal(sql.text(), 'tab');
                        // NOTE: there's no need to explicitly delete style
                        //       of mmlBuilder because it is an extension
                        //       of mmlBuilder2 (extended by SQL)
                        done();
                    });
                });
        });

        test('by default datasource has full webmercator extent', function (done) {
            var mmlStore = new grainstore.MMLStore({ use_workers: useWorkers });
            var mmlBuilder = mmlStore.mml_builder(
                { dbname: 'my_database', sql: 'SELECT * FROM my_face', style: DEFAULT_POINT_STYLE }
            );
            var baseMML = mmlBuilder.baseMML();
            assert.ok(_.isArray(baseMML.Layer));
            assert.equal(baseMML.Layer[0].Datasource.extent, '-20037508.3,-20037508.3,20037508.3,20037508.3');
            done();
        });

        test('SRS in XML should use the "+init=epsg:xxx" form', function (done) {
            var mmlStore = new grainstore.MMLStore({ use_workers: useWorkers });
            mmlStore.mml_builder({ dbname: 'my_databaasez', sql: 'SELECT * FROM my_face', style: DEFAULT_POINT_STYLE })
                .toXML(function (err, data) {
                    if (err) { return done(err); }
                    var xmlDoc = libxmljs.parseXmlString(data);
                    var srs = xmlDoc.get('//@srs');
                    assert.equal(srs.value().indexOf('+init=epsg:'), 0,
                        '"' + srs.value() + '" does not start with "+init=epsg:"');
                    done();
                });
        });

        test('store, retrive and convert to XML a set of reference styles', function (done) {
            var cachedir = '/tmp/gt-' + process.pid;

            var styles = [
                // point-transform without point-file
                {
                    cartocss: "#tab { point-transform: 'scale(0.9)'; }",
                    reXML: /PointSymbolizer transform="scale\(0.9\)"/
                },
                // localize external resources
                {
                    cartocss: "#tab { point-file: url('http://localhost:" + serverPort + "/circle.svg'); }",
                    reXML: new RegExp('PointSymbolizer file="' + cachedir + '/cache/.*.svg"')
                },
                // localize external resources with a + in the url
                {
                    cartocss: "#tab { point-file: url('http://localhost:" + serverPort + "/+circle.svg'); }",
                    reXML: new RegExp('PointSymbolizer file="' + cachedir + '/cache/.*.svg"')
                },
                // transform marker-width and height from 2.0.0 to 2.1.0 resources with a + in the url
                {
                    cartocss: '#tab { marker-width: 8; marker-height: 3; }',
                    version: '2.0.0',
                    target_version: '2.1.0',
                    reXML: new RegExp('MarkersSymbolizer width="16" height="6"')
                },
                // recognize mapnik-geometry-type
                {
                    cartocss: '#tab [mapnik-geometry-type=3] { marker-placement:line; }',
                    reXML: /Filter.*\[mapnik::geometry_type\] = 3.*Filter/
                },
                // properly encode & signs
                // see http://github.com/CartoDB/cartodb20/issues/137
                {
                    cartocss: "#tab [f='&'] { marker-width: 8; }",
                    reXML: /<Filter>\(\[f\] = '&amp;'\)<\/Filter>/
                }
            ];

            var StylesRunner = function (styles, done) {
                this.styles = styles;
                this.done = done;
                this.errors = [];
            };

            StylesRunner.prototype.runNext = function (err) {
                if (err) {
                    this.errors.push(err);
                }
                if (!this.styles.length) {
                    err = this.errors.length ? new Error(this.errors) : null;
                    // TODO: remove all from cachedir ?
                    const mmlStore = new grainstore.MMLStore({ use_workers: useWorkers, cachedir: cachedir });
                    const that = this;
                    mmlStore.purgeLocalizedResources(0, function (e) {
                        if (e) {
                            console.log('Error purging localized resources: ' + e);
                        }
                        that.done(err);
                    });
                    return;
                }
                const that = this;
                var styleSpec = this.styles.shift();
                var style = styleSpec.cartocss;
                var styleVersion = styleSpec.version || '2.0.2';
                var targetMapnikVersion = styleSpec.target_version || styleVersion;
                var reXML = styleSpec.reXML;

                const mmlStore = new grainstore.MMLStore({
                    use_workers: useWorkers,
                    cachedir: cachedir,
                    mapnik_version: targetMapnikVersion,
                    cachettl: 0.01
                });
                var mmlBuilder = mmlStore.mml_builder({ dbname: 'db', sql: 'tab', style: style });
                step(
                    function toXML () {
                        mmlBuilder.toXML(this);
                    },
                    function finish (err, data) {
                        var errs = [];
                        if (err) {
                            errs.push(err);
                        }
                        // console.log("toXML returned: "); console.dir(data);
                        assert.ok(reXML.test(data), 'toXML: ' + style + ': expected ' + reXML + ' got:\n' + data);
                        that.runNext(err);
                    }
                );
            };

            var runner = new StylesRunner(styles, done);
            runner.runNext();
        });

        // External resources are downloaded in isolation
        // See https://github.com/Vizzuality/grainstore/issues/60
        test('external resources are downloaded in isolation', function (done) {
            var style = "{ point-file: url('http://localhost:" + serverPort + "/circle.svg'); }";
            var cachedir = '/tmp/gt1-' + process.pid;

            var cdir1 = cachedir + '1';
            var style1 = '#t1 ' + style;
            var store1 = new grainstore.MMLStore({ use_workers: useWorkers, cachedir: cdir1 });
            var re1 = new RegExp('PointSymbolizer file="' + cdir1 + '/cache/.*.svg"');

            var cdir2 = cachedir + '2';
            var style2 = '#t2 ' + style;
            var store2 = new grainstore.MMLStore({ use_workers: useWorkers, cachedir: cdir2 });
            var re2 = new RegExp('PointSymbolizer file="' + cdir2 + '/cache/.*.svg"');

            var pending = 2;
            var err = [];
            var finish = function (e) {
                if (e) {
                    err.push(e.toString());
                }
                if (!--pending) {
                    if (err.length) {
                        err = new Error(err.join('\n'));
                    } else {
                        err = null;
                    }
                    done(err);
                }
            };

            var b1 = store1.mml_builder({ dbname: 'd', sql: 't1', style: style1 });
            b1.toXML(function (e, data) {
                if (e) { finish(e); return; }
                try {
                    assert.ok(re1.test(data), 'toXML: ' + style + ': expected ' + re1 + ' got:\n' + data);
                } catch (e) {
                    err.push(e);
                }
                finish();
            });

            var b2 = store2.mml_builder({ dbname: 'd', sql: 't2', style: style2 });
            b2.toXML(function (e, data) {
                if (e) { finish(e); return; }
                try {
                    assert.ok(re2.test(data), 'toXML: ' + style + ': expected ' + re2 + ' got:\n' + data);
                } catch (e) {
                    err.push(e);
                }
                finish();
            });
        });

        test('lost XML in base key triggers re-creation', function (done) {
            var mmlStore = new grainstore.MMLStore({ use_workers: useWorkers });
            var mmlBuilder0 = mmlStore.mml_builder({ dbname: 'db', sql: 'SELECT * FROM my_face', style: DEFAULT_POINT_STYLE });
            var mmlBuilder = mmlStore.mml_builder({ dbname: 'db', sql: 'SELECT * FROM my_face', style: DEFAULT_POINT_STYLE });
            var xml0;
            step(
                function getXML0 () {
                    mmlBuilder0.toXML(this);
                },
                function dropXML0 (err, data) {
                    if (err) { done(err); return; }
                    xml0 = data;
                    return null;
                },
                function getXML1 (err) {
                    if (err) { done(err); return; }
                    mmlBuilder.toXML(this);
                },
                function checkXML (err, data) {
                    if (err) { done(err); return; }
                    assert.equal(data, xml0);
                    done();
                }
            );
        });

        if (semver.satisfies(new carto.Renderer().options.mapnik_version, '<=2.3.0')) {
            // See https://github.com/Vizzuality/grainstore/issues/62
            test('throws useful error message on invalid text-name', function (done) {
                var style = "#t { text-name: invalid; text-face-name:'Dejagnu'; }";
                var mmlStore = new grainstore.MMLStore({ use_workers: useWorkers, mapnik_version: '2.1.0' });
                mmlStore.mml_builder({ dbname: 'd', sql: 't', style: style }).toXML(function (err, xml) {
                    assert.ok(err);
                    var re = /Invalid value for text-name/;
                    assert.ok(err.message.match(re), 'No match for ' + re + ' in "' + err.message + '"');
                    done();
                });
            });
        }

        test('use exponential in filters', function (done) {
            var style = '#t[a=1.2e-3] { polygon-fill: #000000; }';
            style += '#t[b=1.2e+3] { polygon-fill: #000000; }';
            style += '#t[c=2.3e4] { polygon-fill: #000000; }';
            var mmlStore = new grainstore.MMLStore({ use_workers: useWorkers, mapnik_version: '2.1.0' });
            var mmlBuilder = mmlStore.mml_builder({ dbname: 'd2', sql: 't', style: style, styleVersion: '2.1.0' });
            step(
                function getXML () {
                    mmlBuilder.toXML(this);
                },
                function checkXML (err, data) {
                    if (err) {
                        throw err;
                    }
                    var xmlDoc = libxmljs.parseXmlString(data);
                    var node = xmlDoc.find('//Filter');
                    assert.equal(node.length, 3);
                    for (var i = 0; i < node.length; i++) {
                        var txt = node[i].text();
                        if (txt.match(/\[a\] =/)) {
                            assert.equal(txt, '([a] = 0.0012)');
                        } else if (txt.match(/\[b\] =/)) {
                            assert.equal(txt, '([b] = 1200)');
                        } else if (txt.match(/\[c\] =/)) {
                            assert.equal(txt, '([c] = 23000)');
                        } else {
                            assert.fail('No match for ' + txt);
                        }
                    }
                    return null;
                },
                function finish (err) {
                    return done(err);
                }
            );
        });

        test('can construct mmlBuilder', function (done) {
            var style = '#t {bogus}';
            // NOTE: we need mapnik_version to be != 2.0.0
            var mmlStore = new grainstore.MMLStore({ use_workers: useWorkers, mapnik_version: '2.1.0' });
            mmlStore.mml_builder({ dbname: 'd', sql: 't', style: style }).toXML(
                function checkInitGetXML (err) {
                    assert.ok(err.message.match(/bogus/), err.message);
                    done();
                }
            );
        });

        // See https://github.com/CartoDB/grainstore/issues/72
        test('invalid fonts are complained about',
            function (done) {
                var mmlStore = new grainstore.MMLStore({
                    use_workers: useWorkers,
                    mapnik_version: '2.1.0',
                    carto_env: {
                        validation_data: {
                            fonts: ['Dejagnu', 'good']
                        }
                    }
                });
                step(
                    function checkGoodFont () {
                        mmlStore.mml_builder({ dbname: 'd', sql: 't', style: '#t{text-name:[a]; text-face-name:"good";}' }).toXML(this);
                    },
                    function setGoodFont (err) {
                        if (err) {
                            throw err;
                        }
                        mmlStore.mml_builder(
                            { dbname: 'd', sql: 't', style: "#t { text-name:[a]; text-face-name:'bogus_font'; }" }
                        ).toXML(this);
                    },
                    function setBogusFont (err) {
                        assert.ok(err);
                        assert.ok(err, 'no error raised when using bogus font');
                        assert.ok(err.message.match(/Invalid.*text-face-name.*bogus_font/), err);
                        done();
                    }
                );
            });

        test('should can set format after building the MML', function (done) {
            var mmlStore = new grainstore.MMLStore({ use_workers: useWorkers });
            var mml = mmlStore.mml_builder({
                dbname: 'my_databaasez',
                sql: SAMPLE_SQL,
                style: DEFAULT_POINT_STYLE
            });

            mml.set('grainstore_map', { format: 'png32' });

            mml.toXML(function (err, data) {
                if (err) { return done(err); }
                var xmlDoc = libxmljs.parseXmlString(data);
                var format = xmlDoc.get("//Parameter[@name='format']");

                assert.equal(format.text(), 'png32');
                done();
            });
        });

        test('when setting a property not allowed should throw error', function () {
            var mmlStore = new grainstore.MMLStore({ use_workers: useWorkers });
            var mml = mmlStore.mml_builder({
                dbname: 'my_databaasez',
                sql: SAMPLE_SQL,
                style: DEFAULT_POINT_STYLE
            });

            assert.throws(function () {
                mml.set('toXML', { format: 'png32' });
            }, Error);
        });

        test('can set layer name from ids array', function (done) {
            var mmlStore = new grainstore.MMLStore({ use_workers: useWorkers });
            var mml = mmlStore.mml_builder({
                dbname: 'my_databaasez',
                ids: ['layer-name-wadus'],
                sql: SAMPLE_SQL,
                style: DEFAULT_POINT_STYLE
            });

            mml.toXML(function (err, data) {
                if (err) { return done(err); }
                var xmlDoc = libxmljs.parseXmlString(data);
                var layer = xmlDoc.get('//Layer');

                assert.equal(layer.attr('name').value(), 'layer-name-wadus');

                done();
            });
        });

        test('set valid interactivity layer name based on ids array', function (done) {
            var mmlStore = new grainstore.MMLStore({ use_workers: useWorkers });
            var mml = mmlStore.mml_builder({
                dbname: 'd2',
                ids: ['layer-wadus'],
                sql: SAMPLE_SQL,
                style: DEFAULT_POINT_STYLE,
                interactivity: 'a,b'
            });
            mml.toXML(function (err, data) {
                if (err) { return done(err); }
                var xmlDoc = libxmljs.parseXmlString(data);
                var x = xmlDoc.get("//Parameter[@name='interactivity_layer']");
                assert.ok(x);
                assert.equal(x.text(), 'layer-wadus');
                x = xmlDoc.get("//Parameter[@name='interactivity_fields']");
                assert.ok(x);
                assert.equal(x.text(), 'a,b');
                done();
            });
        });

        test('can generate a valid xml without styles', function (done) {
            var mmlStore = new grainstore.MMLStore({ use_workers: useWorkers });
            var mmlBuilder = mmlStore.mml_builder({
                dbname: 'my_database',
                sql: SAMPLE_SQL
            });

            mmlBuilder.toXML((err, xml) => {
                if (err) {
                    return done(err);
                }

                var xmlDoc = libxmljs.parseXmlString(xml);
                var x = xmlDoc.get("//Parameter[@name='dbname']");
                assert.ok(x);
                assert.equal(x.text(), 'my_database');
                x = xmlDoc.get("//Parameter[@name='table']");
                assert.ok(x);
                assert.equal(x.text(), SAMPLE_SQL);

                done();
            });
        });

        suite('minzoom and maxzoom', function () {
            const ZOOM_2_SCALE = {
                0: 1000000000,
                1: 500000000,
                2: 200000000,
                3: 100000000,
                4: 50000000,
                5: 25000000,
                6: 12500000,
                7: 6500000,
                8: 3000000,
                9: 1500000,
                10: 750000,
                11: 400000,
                12: 200000,
                13: 100000,
                14: 50000,
                15: 25000,
                16: 12500,
                17: 5000,
                18: 2500,
                19: 1500,
                20: 750,
                21: 500,
                22: 250,
                23: 100,
                24: 50,
                25: 25,
                26: 12.5
            };
            const zoomScenarios = [
                {
                    desc: 'sets layer minzoom',
                    zoom: { minzoom: 6 },
                    // Zooms properties are reversed, using scale denominator ranges.
                    expectedScale: { maxzoom: ZOOM_2_SCALE[6] }
                },
                {
                    desc: 'sets layer maxzoom',
                    zoom: { maxzoom: 12 },
                    // Zooms properties are reversed, using scale denominator ranges.
                    expectedScale: { minzoom: ZOOM_2_SCALE[13] }
                },
                {
                    desc: 'sets layer minzoom and maxzoom',
                    zoom: { minzoom: 6, maxzoom: 18 },
                    // Zooms properties are reversed, using scale denominator ranges.
                    expectedScale: {
                        maxzoom: ZOOM_2_SCALE[6],
                        minzoom: ZOOM_2_SCALE[19]
                    }
                }
            ];
            const ZOOM_PROP_2_KEY = {
                minzoom: 'maxzoom',
                maxzoom: 'minzoom'
            };
            zoomScenarios.forEach(scenario => {
                test(scenario.desc, function (done) {
                    const mmlStore = new grainstore.MMLStore({ use_workers: useWorkers });
                    const mml = mmlStore.mml_builder({
                        dbname: 'd2',
                        ids: ['layer-wadus'],
                        zooms: [scenario.zoom],
                        sql: SAMPLE_SQL,
                        style: DEFAULT_POINT_STYLE
                    });

                    mml.toXML(function (err, xml) {
                        if (err) { return done(err); }

                        const xmlDoc = libxmljs.parseXmlString(xml);
                        const layer = xmlDoc.get("//Layer[@name='layer-wadus']");
                        assert.ok(layer);

                        Object.keys(scenario.zoom).forEach(function (zoomProp) {
                        // Zooms properties are reversed, using scale denominator ranges.
                            const zoomAttrKey = ZOOM_PROP_2_KEY[zoomProp];
                            const zoom = layer.attr(zoomAttrKey).value();
                            const expectedScale = scenario.expectedScale[zoomAttrKey];
                            assert.equal(
                                zoom,
                                expectedScale,
                                `Unexpected scale value for '${zoomProp}': got ${zoom}, expected ${expectedScale}`
                            );
                        });

                        return done();
                    });
                });
            });
        });

        test('support global cache-features', function (done) {
            var mmlStore = new grainstore.MMLStore({ use_workers: useWorkers });
            var mmlBuilder = mmlStore.mml_builder({
                dbname: 'd2',
                ids: ['layer-features'],
                'cache-features': true,
                sql: SAMPLE_SQL,
                style: DEFAULT_POINT_STYLE
            });

            mmlBuilder.toXML((err, xml) => {
                if (err) { return done(err); }

                var xmlDoc = libxmljs.parseXmlString(xml);
                const layer = xmlDoc.get("//Layer[@name='layer-features']");
                assert.ok(layer);
                assert.equal(layer.attr('cache-features').value(), 'true');
            });

            mmlBuilder = mmlStore.mml_builder({
                dbname: 'd2',
                ids: ['layer-features'],
                'cache-features': false,
                sql: SAMPLE_SQL,
                style: DEFAULT_POINT_STYLE
            });

            mmlBuilder.toXML((err, xml) => {
                if (err) { return done(err); }

                var xmlDoc = libxmljs.parseXmlString(xml);
                const layer = xmlDoc.get("//Layer[@name='layer-features']");
                assert.ok(layer);
                assert.equal(layer.attr('cache-features').value(), 'false');
                done();
            });
        });

        test('support per layer cache-features', function (done) {
            var mmlStore = new grainstore.MMLStore({ use_workers: useWorkers });
            var mmlBuilder = mmlStore.mml_builder({
                dbname: 'd2',
                ids: ['layer-features', ['other-layer']],
                'cache-features': [true, false],
                sql: [SAMPLE_SQL, SAMPLE_SQL],
                style: DEFAULT_POINT_STYLE
            });

            mmlBuilder.toXML((err, xml) => {
                if (err) { return done(err); }

                var xmlDoc = libxmljs.parseXmlString(xml);
                var layer = xmlDoc.get("//Layer[@name='layer-features']");
                assert.ok(layer);
                assert.equal(layer.attr('cache-features').value(), 'true');

                layer = xmlDoc.get("//Layer[@name='other-layer']");
                assert.ok(layer);
                assert.equal(layer.attr('cache-features').value(), 'false');
                done();
            });
        });

        test('support per map markers_symbolizer_caches', function (done) {
            var mmlStore = new grainstore.MMLStore({ use_workers: useWorkers });

            var mmlBuilder = mmlStore.mml_builder({
                dbname: 'my_database',
                sql: SAMPLE_SQL,
                style: DEFAULT_POINT_STYLE,
                markers_symbolizer_caches: {
                    disabled: true
                }
            });
            mmlBuilder.toXML((err, xml) => {
                if (err) { return done(err); }
                var xmlDoc = libxmljs.parseXmlString(xml);
                var xpath = "/Map/Parameters/Parameter[@name='markers_symbolizer_caches_disabled']";
                var markersSymbolizerCachesDisabled = xmlDoc.get(xpath);
                assert.equal(markersSymbolizerCachesDisabled.text(), 'true');
            });

            mmlBuilder = mmlStore.mml_builder({
                dbname: 'my_database',
                sql: SAMPLE_SQL,
                style: DEFAULT_POINT_STYLE,
                markers_symbolizer_caches: {
                    disabled: false
                }
            });
            mmlBuilder.toXML((err, xml) => {
                if (err) { return done(err); }
                var xmlDoc = libxmljs.parseXmlString(xml);
                var xpath = "/Map/Parameters/Parameter[@name='markers_symbolizer_caches_disabled']";
                var markersSymbolizerCachesDisabled = xmlDoc.get(xpath);
                assert.equal(markersSymbolizerCachesDisabled.text(), 'false');
            });

            mmlBuilder = mmlStore.mml_builder({
                dbname: 'my_database',
                sql: SAMPLE_SQL,
                style: DEFAULT_POINT_STYLE
            });
            mmlBuilder.toXML((err, xml) => {
                if (err) { return done(err); }
                var xmlDoc = libxmljs.parseXmlString(xml);
                var xpath = "/Map/Parameters/Parameter[@name='markers_symbolizer_caches_disabled']";
                var markersSymbolizerCachesDisabled = xmlDoc.get(xpath);
                assert.equal(markersSymbolizerCachesDisabled, undefined);
                done();
            });
        });
    });
});
