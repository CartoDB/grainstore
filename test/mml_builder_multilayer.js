'use strict';

var assert = require('assert');
var grainstore = require('../lib/grainstore');
var step = require('step');
var http = require('http');
var fs = require('fs');

const xml2js = require('xml2js');
const xpath = require('xml2js-xpath');

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

[false, true].forEach(function (useWorkers) {
    describe('mml_builder multilayer use_workers=' + useWorkers, function () {
        var queryMakeLine = 'SELECT ST_MakeLine(ST_MakePoint(-10,-5),ST_MakePoint(10,-5))';
        var queryMakePoint = 'SELECT ST_MakePoint(0,0)';

        var styleLine = '#layer1 { line-color:red; }';
        var stylePoint = '#layer0 { marker-width:3; }';

        before(function (done) {
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

        after(function () {
            server.close();
        });

        it('accept sql array with style array', function (done) {
            var style0 = '#layer0 { marker-width:3; }';
            var style1 = '#layer1 { line-color:red; }';
            var mmlStore = new grainstore.MMLStore({ use_workers: useWorkers, mapnik_version: '2.1.0' });

            step(
                function initBuilder () {
                    mmlStore.mml_builder({
                        dbname: 'my_database',
                        sql: ['SELECT ST_MakePoint(0,0)', 'SELECT ST_MakeLine(ST_MakePoint(-10,-5),ST_MakePoint(10,-5))'],
                        style: [style0, style1],
                        style_version: '2.1.0'
                    }).toXML(this);
                },
                function checkXML0 (err, xml) {
                    if (err) { done(err); return; }
                    xml2js.parseString(xml, (err, xmlDoc) => {
                        if (err) { done(err); return; }

                        const layer0 = xpath.find(xmlDoc, '//Layer').find(l => l.$.name === 'layer0');
                        assert.ok(layer0);

                        let geomField = layer0.Datasource[0].Parameter.find(param => param.$.name === 'geometry_field');
                        assert.equal(geomField._, 'the_geom_webmercator');

                        const layer1 = xpath.find(xmlDoc, '//Layer').find(l => l.$.name === 'layer1');
                        assert.ok(layer1);

                        geomField = layer1.Datasource[0].Parameter.find(param => param.$.name === 'geometry_field');
                        assert.equal(geomField._, 'the_geom_webmercator');

                        const style0 = xpath.find(xmlDoc, '//Style').find(s => s.$.name === 'layer0');
                        assert.ok(style0);

                        const style1 = xpath.find(xmlDoc, '//Style').find(s => s.$.name === 'layer1');
                        assert.ok(style1);

                        done();
                    });
                }
            );
        });

        // See http://github.com/CartoDB/grainstore/issues/92
        it('accept sql array with style array and gcols array', function (done) {
            var style0 = '#layer0 { marker-width:3; }';
            var style1 = '#layer1 { line-color:red; }';
            var mmlStore = new grainstore.MMLStore({ use_workers: useWorkers, mapnik_version: '2.1.0' });

            step(
                function initBuilder () {
                    mmlStore.mml_builder({
                        dbname: 'my_database',
                        sql: ['SELECT ST_MakePoint(0,0) g', 'SELECT ST_MakeLine(ST_MakePoint(-10,-5),ST_MakePoint(10,-5)) g2'],
                        style: [style0, style1],
                        gcols: [null, 'g2'], // first intentionally blank
                        style_version: '2.1.0'
                    }).toXML(this);
                },
                function checkXML0 (err, xml) {
                    if (err) { done(err); return; }

                    xml2js.parseString(xml, (err, xmlDoc) => {
                        if (err) { done(err); return; }

                        const layer0 = xpath.find(xmlDoc, '//Layer').find(l => l.$.name === 'layer0');
                        assert.ok(layer0);
                        assert.equal(layer0.Datasource.length, 1);
                        let geomField = layer0.Datasource[0].Parameter.find(param => param.$.name === 'geometry_field');
                        assert.equal(geomField._, 'the_geom_webmercator');

                        const layer1 = xpath.find(xmlDoc, '//Layer').find(l => l.$.name === 'layer1');
                        assert.ok(layer1);
                        assert.equal(layer1.$.name, 'layer1');

                        geomField = layer1.Datasource[0].Parameter.find(param => param.$.name === 'geometry_field');
                        assert.equal(geomField._, 'g2');

                        done();
                    });
                }
            );
        });

        [
            [
                { type: 'geometry', name: 'g' },
                { type: 'raster', name: 'r' }
            ],
            [
                'g',
                { type: 'raster', name: 'r' }
            ],
            [
                { name: 'g' },
                { type: 'raster', name: 'r' }
            ]
        ].forEach(function (gcols) {
            // See http://github.com/CartoDB/grainstore/issues/93
            it('accept types in gcols', function (done) {
                var mmlStore = new grainstore.MMLStore({ use_workers: useWorkers, mapnik_version: '2.1.0' });

                step(
                    function initBuilder () {
                        mmlStore.mml_builder({
                            dbname: 'my_database',
                            sql: ['SELECT ST_MakePoint(0,0) g',
                                'SELECT ST_AsRaster(ST_MakePoint(0,0),1.0,1.0) r'],
                            style: [DEFAULT_POINT_STYLE, DEFAULT_POINT_STYLE],
                            gcols: gcols,
                            style_version: '2.1.0'
                        }).toXML(this);
                    },
                    function checkXML0 (err, xml) {
                        if (err) { done(err); return; }
                        xml2js.parseString(xml, (err, xmlDoc) => {
                            if (err) { done(err); return; }

                            const layer0 = xpath.find(xmlDoc, '//Layer').find(l => l.$.name === 'layer0');
                            assert.ok(layer0);
                            assert.equal(layer0.Datasource.length, 1);
                            const geomField = layer0.Datasource[0].Parameter.find(param => param.$.name === 'geometry_field');
                            assert.equal(geomField._, 'g');

                            const layer1 = xpath.find(xmlDoc, '//Layer').find(l => l.$.name === 'layer1');
                            assert.ok(layer1);
                            assert.equal(layer1.Datasource.length, 1);

                            const rasterField = layer1.Datasource[0].Parameter.find(param => param.$.name === 'raster_field');
                            const type = layer1.Datasource[0].Parameter.find(param => param.$.name === 'type');
                            assert.equal(rasterField._, 'r');
                            assert.equal(type._, 'pgraster');

                            done();
                        });
                    }
                );
            });
        });

        // See http://github.com/CartoDB/grainstore/issues/93
        it('accept rcolbands and extra_ds_opts arrays', function (done) {
            var mmlStore = new grainstore.MMLStore({ use_workers: useWorkers, mapnik_version: '2.1.0' });

            step(
                function initBuilder () {
                    mmlStore.mml_builder({
                        dbname: 'my_database',
                        sql: ['SELECT ST_MakePoint(0,0) g',
                            'SELECT ST_AsRaster(ST_MakePoint(0,0),1.0,1.0) r',
                            'SELECT ST_AsRaster(ST_MakePoint(0,0),1.0,1.0) r2'],
                        style: [DEFAULT_POINT_STYLE, DEFAULT_POINT_STYLE, DEFAULT_POINT_STYLE],
                        gcols: [
                            { type: 'geometry', name: 'g' },
                            { type: 'raster', name: 'r' },
                            { type: 'raster', name: 'r2' }
                        ],
                        extra_ds_opts: [
                            { geometry_field: 'fake' }, // will not override
                            { use_overviews: 1, prescale_rasters: true },
                            { band: 1, clip_rasters: 1 }
                        ],
                        style_version: '2.1.0'
                    }).toXML(this);
                },
                function checkXML0 (err, xml) {
                    if (err) { done(err); return; }
                    xml2js.parseString(xml, (err, xmlDoc) => {
                        if (err) { done(err); return; }

                        const layer0 = xpath.find(xmlDoc, '//Layer').find(l => l.$.name === 'layer0');
                        assert.ok(layer0);
                        assert.equal(layer0.Datasource.length, 1);
                        const geomField = layer0.Datasource[0].Parameter.find(param => param.$.name === 'geometry_field');
                        assert.equal(geomField._, 'g');

                        const layer1 = xpath.find(xmlDoc, '//Layer').find(l => l.$.name === 'layer1');
                        assert.ok(layer1);
                        assert.equal(layer1.Datasource.length, 1);
                        let rasterField = layer1.Datasource[0].Parameter.find(param => param.$.name === 'raster_field');
                        let type = layer1.Datasource[0].Parameter.find(param => param.$.name === 'type');
                        let band = layer1.Datasource[0].Parameter.find(param => param.$.name === 'band');
                        let clipCasters = layer1.Datasource[0].Parameter.find(param => param.$.name === 'clip_rasters');
                        let useOverviews = layer1.Datasource[0].Parameter.find(param => param.$.name === 'use_overviews');
                        let prescaleRasters = layer1.Datasource[0].Parameter.find(param => param.$.name === 'prescale_rasters');
                        assert.equal(rasterField._, 'r');
                        assert.equal(type._, 'pgraster');
                        assert.equal(band, undefined);
                        assert.equal(clipCasters, undefined);
                        assert.equal(useOverviews._, '1');
                        assert.equal(prescaleRasters._, 'true');

                        const layer2 = xpath.find(xmlDoc, '//Layer').find(l => l.$.name === 'layer2');
                        assert.ok(layer2);
                        assert.equal(layer2.Datasource.length, 1);
                        rasterField = layer2.Datasource[0].Parameter.find(param => param.$.name === 'raster_field');
                        type = layer2.Datasource[0].Parameter.find(param => param.$.name === 'type');
                        band = layer2.Datasource[0].Parameter.find(param => param.$.name === 'band');
                        clipCasters = layer2.Datasource[0].Parameter.find(param => param.$.name === 'clip_rasters');
                        useOverviews = layer2.Datasource[0].Parameter.find(param => param.$.name === 'use_overviews');
                        prescaleRasters = layer2.Datasource[0].Parameter.find(param => param.$.name === 'prescale_rasters');
                        assert.equal(rasterField._, 'r2');
                        assert.equal(type._, 'pgraster');
                        assert.equal(band._, '1');
                        assert.equal(clipCasters._, '1');
                        assert.equal(useOverviews, undefined);
                        assert.equal(prescaleRasters, undefined);

                        done();
                    });
                }
            );
        });

        it('gcol with objects fails when name is not provided', function (done) {
            var mmlStore = new grainstore.MMLStore({ use_workers: useWorkers, mapnik_version: '2.1.0' });

            step(
                function initBuilder () {
                    mmlStore.mml_builder({
                        dbname: 'my_database',
                        sql: ['SELECT ST_MakePoint(0,0) g',
                            'SELECT ST_AsRaster(ST_MakePoint(0,0),1.0,1.0) r'],
                        style: [DEFAULT_POINT_STYLE, DEFAULT_POINT_STYLE],
                        gcols: [
                            { type: 'geometry' }
                        ],
                        style_version: '2.1.0'
                    }).toXML(this);
                },
                function getXML0 (err) {
                    assert.ok(!!err);
                    done();
                }
            );
        });

        it('datasource_extend option allows to have different datasources per layer', function (done) {
            var mmlStore = new grainstore.MMLStore({ use_workers: useWorkers, mapnik_version: '2.3.0' });

            var defaultUser = 'default_user';
            var defaultPass = 'default_pass';
            var wadusUser = 'wadus_user';
            var wadusPass = 'wadus_password';

            var datasourceExtend = {
                user: wadusUser,
                password: wadusPass
            };

            mmlStore.mml_builder({
                dbuser: defaultUser,
                dbpassword: defaultPass,
                dbname: 'my_database',
                sql: [queryMakeLine, queryMakePoint],
                datasource_extend: [null, datasourceExtend],
                style: [styleLine, stylePoint],
                style_version: '2.3.0'
            }).toXML((err, xml) => {
                if (err) { done(err); return; }

                xml2js.parseString(xml, (err, xmlDoc) => {
                    if (err) { done(err); return; }

                    const layer0 = xpath.find(xmlDoc, '//Layer').find(l => l.$.name === 'layer0');
                    assert.ok(layer0);
                    assert.equal(layer0.Datasource.length, 1);

                    const layer1 = xpath.find(xmlDoc, '//Layer').find(l => l.$.name === 'layer1');
                    assert.ok(layer1);
                    assert.equal(layer1.Datasource.length, 1);

                    let user = layer0.Datasource[0].Parameter.find(param => param.$.name === 'user');
                    let password = layer0.Datasource[0].Parameter.find(param => param.$.name === 'password');
                    assert.equal(user._, defaultUser);
                    assert.equal(password._, defaultPass);

                    user = layer1.Datasource[0].Parameter.find(param => param.$.name === 'user');
                    password = layer1.Datasource[0].Parameter.find(param => param.$.name === 'password');
                    assert.equal(user._, wadusUser);
                    assert.equal(password._, wadusPass);

                    return done();
                });
            });
        });

        it('error out on blank CartoCSS in a style array', function (done) {
            var style0 = '#layer0 { marker-width:3; }';
            var style1 = '';
            var mmlStore = new grainstore.MMLStore({ use_workers: useWorkers, mapnik_version: '2.1.0' });

            step(
                function initBuilder () {
                    mmlStore.mml_builder({
                        dbname: 'my_database',
                        sql: ['SELECT ST_MakePoint(0,0)', 'SELECT ST_MakeLine(ST_MakePoint(-10,-5),ST_MakePoint(10,-5))'],
                        style: [style0, style1],
                        style_version: '2.1.0'
                    }).toXML(this);
                },
                function checkError (err) {
                    assert(err);
                    assert.equal(err.message, 'style1: CartoCSS is empty');
                    return null;
                },
                function finish (err) {
                    done(err);
                }
            );
        });

        it('accept sql with style and style_version array', function (done) {
            var style0 = '#layer0 { marker-width:3; }';
            var style1 = '#layer1 { marker-width:4; }';
            var sql0 = 'SELECT ST_MakePoint(0,0)';
            var sql1 = 'SELECT ST_MakeLine(ST_MakePoint(-10,-5),ST_MakePoint(10,-5))';
            var styleVersion0 = '2.0.2';
            var styleVersion1 = '2.1.0';
            var mmlStore = new grainstore.MMLStore({ use_workers: useWorkers, mapnik_version: '2.1.0' });

            step(
                function initBuilder () {
                    mmlStore.mml_builder({
                        dbname: 'my_database',
                        sql: [sql0, sql1],
                        style: [style0, style1],
                        style_version: [styleVersion0, styleVersion1]
                    }).toXML(this);
                },
                function checkXML0 (err, xml) {
                    if (err) {
                        throw err;
                    }
                    xml2js.parseString(xml, (err, xmlDoc) => {
                        if (err) { done(err); return; }

                        const layer0 = xpath.find(xmlDoc, '//Layer').find(l => l.$.name === 'layer0');
                        assert.ok(layer0);
                        assert.equal(layer0.Datasource.length, 1);
                        const table0 = layer0.Datasource[0].Parameter.find(param => param.$.name === 'table');
                        assert.ok(
                            table0._.indexOf(sql0) !== -1,
                            'Cannot find sql [' + sql0 + '] in table datasource, got ' + table0._
                        );

                        const layer1 = xpath.find(xmlDoc, '//Layer').find(l => l.$.name === 'layer1');
                        assert.ok(layer1);
                        assert.equal(layer1.Datasource.length, 1);
                        const table1 = layer1.Datasource[0].Parameter.find(param => param.$.name === 'table');
                        assert.ok(
                            table1._.indexOf(sql1) !== -1,
                            'Cannot find sql [' + sql1 + '] in table datasource, got ' + table1._
                        );

                        const style0 = xpath.find(xmlDoc, '//Style').find(s => s.$.name === 'layer0');
                        const symb0 = style0.Rule.find(r => Object.prototype.hasOwnProperty.call(r, 'MarkersSymbolizer')).MarkersSymbolizer[0];
                        assert.equal(symb0.$.width, 6);

                        const style1 = xpath.find(xmlDoc, '//Style').find(s => s.$.name === 'layer1');
                        const symb1 = style1.Rule.find(r => Object.prototype.hasOwnProperty.call(r, 'MarkersSymbolizer')).MarkersSymbolizer[0];
                        assert.equal(symb1.$.width, 4);

                        return done();
                    });
                }
            );
        });

        it('layer name in style array is only a placeholder', function (done) {
            var style0 = '#layer { marker-width:3; }';
            var style1 = '#style { line-color:red; }';
            var mmlStore = new grainstore.MMLStore({ use_workers: useWorkers, mapnik_version: '2.1.0' });

            step(
                function initBuilder () {
                    mmlStore.mml_builder({
                        dbname: 'my_database',
                        sql: ['SELECT ST_MakePoint(0,0)', 'SELECT ST_MakeLine(ST_MakePoint(-10,-5),ST_MakePoint(10,-5))'],
                        style: [style0, style1],
                        style_version: '2.1.0'
                    }).toXML(this);
                },
                function checkXML0 (err, xml) {
                    if (err) { done(err); return; }
                    xml2js.parseString(xml, (err, xmlDoc) => {
                        if (err) { done(err); return; }

                        const layer0 = xpath.find(xmlDoc, '//Layer').find(l => l.$.name === 'layer0');
                        assert.ok(layer0);

                        const layer1 = xpath.find(xmlDoc, '//Layer').find(l => l.$.name === 'layer1');
                        assert.ok(layer1);

                        const style0 = xpath.find(xmlDoc, '//Style').find(s => s.$.name === 'layer0');
                        assert.ok(style0);

                        const style1 = xpath.find(xmlDoc, '//Style').find(s => s.$.name === 'layer1');
                        assert.ok(style1);

                        done();
                    });
                }
            );
        });

        it('layer name in single style is only a placeholder', function (done) {
            var style0 = '#layer { marker-width:3; } #layer[a=1] { marker-fill:#ff0000 }';
            var mmlStore = new grainstore.MMLStore({ use_workers: useWorkers, mapnik_version: '2.1.0' });

            step(
                function initBuilder () {
                    mmlStore.mml_builder({
                        dbname: 'my_database',
                        sql: ['SELECT ST_MakePoint(0,0)'],
                        style: [style0],
                        style_version: '2.1.0'
                    }).toXML(this);
                },
                function checkXML0 (err, xml) {
                    if (err) { done(err); return; }
                    xml2js.parseString(xml, (err, xmlDoc) => {
                        if (err) { done(err); return; }

                        const layer0 = xpath.find(xmlDoc, '//Layer').find(l => l.$.name === 'layer0');
                        assert.ok(layer0);

                        const style0 = xpath.find(xmlDoc, '//Style').find(s => s.$.name === 'layer0');
                        assert.ok(style0);

                        const symb0 = style0.Rule.find(r => Object.prototype.hasOwnProperty.call(r, 'MarkersSymbolizer')).MarkersSymbolizer[0];
                        assert.equal(symb0.$.fill, '#ff0000');
                        assert.equal(symb0.$.width, 3);

                        done();
                    });
                }
            );
        });

        it('accept sql array with single style string', function (done) {
            var style0 = '#layer0 { marker-width:3; }';
            var style1 = '#layer1 { line-color:red; }';
            var mmlStore = new grainstore.MMLStore({ use_workers: useWorkers, mapnik_version: '2.1.0' });

            step(
                function initBuilder () {
                    mmlStore.mml_builder({
                        dbname: 'my_database',
                        sql: ['SELECT ST_MakePoint(0,0)', 'SELECT ST_MakeLine(ST_MakePoint(-10,-5),ST_MakePoint(10,-5))'],
                        style: [style0, style1],
                        style_version: '2.1.0'
                    }).toXML(this);
                },
                function checkXML0 (err, xml) {
                    if (err) { done(err); return; }
                    xml2js.parseString(xml, (err, xmlDoc) => {
                        if (err) { done(err); return; }

                        const layer0 = xpath.find(xmlDoc, '//Layer').find(l => l.$.name === 'layer0');
                        assert.ok(layer0);

                        const layer1 = xpath.find(xmlDoc, '//Layer').find(l => l.$.name === 'layer1');
                        assert.ok(layer1);

                        const style0 = xpath.find(xmlDoc, '//Style').find(s => s.$.name === 'layer0');
                        assert.ok(style0);

                        const style1 = xpath.find(xmlDoc, '//Style').find(s => s.$.name === 'layer1');
                        assert.ok(style1);

                        done();
                    });
                }
            );
        });

        it('Error out on malformed interactivity', function (done) {
            var sql0 = 'SELECT 1 as a, 2 as b, ST_MakePoint(0,0)';
            var sql1 = 'SELECT 3 as a, 4 as b, ST_MakeLine(ST_MakePoint(-10,-5),ST_MakePoint(10,-5))';
            var style0 = '#layer0 { marker-width:3; }';
            var style1 = '#layer1 { line-color:red; }';
            var fullstyle = style0 + style1;
            var mmlStore = new grainstore.MMLStore({ use_workers: useWorkers, mapnik_version: '2.1.0' });
            var iact0;
            var iact1 = ['a', 'b'];

            step(
                function initBuilder () {
                    mmlStore.mml_builder({
                        dbname: 'my_database',
                        sql: [sql0, sql1],
                        interactivity: [iact0, iact1],
                        style: fullstyle,
                        style_version: '2.1.0'
                    }).toXML(this);
                },
                function checkError (err) {
                    assert.ok(err);
                    assert.equal(err.message, 'Invalid interactivity value type for layer 1: object');
                    done();
                }
            );
        });

        it('Error out on malformed layer', function (done) {
            var mmlStore = new grainstore.MMLStore({ use_workers: useWorkers, mapnik_version: '2.1.0' });

            step(
                function initBuilder () {
                    mmlStore.mml_builder({
                        dbname: 'my_database',
                        sql: 'select 1',
                        style: DEFAULT_POINT_STYLE,
                        layer: 'cipz'
                    }).toXML(this);
                },
                function checkError (err) {
                    assert.ok(err);
                    assert.equal(err.message, 'Invalid (non-integer) layer value type: cipz');
                    done();
                }
            );
        });

        it('undefined layer id uses old `layer{index}` notation for layer name', function (done) {
            var mmlStore = new grainstore.MMLStore({ use_workers: useWorkers });
            var mml = mmlStore.mml_builder({
                dbname: 'my_db',
                ids: ['layer-name-wadus', null, 'layer-name-top'],
                sql: ['select 1', 'select 2', 'select 3'],
                style: [DEFAULT_POINT_STYLE, DEFAULT_POINT_STYLE, DEFAULT_POINT_STYLE]
            });

            mml.toXML(function (err, data) {
                if (err) { done(err); return; }
                xml2js.parseString(data, (err, xmlDoc) => {
                    if (err) { done(err); return; }

                    const layer0 = xpath.find(xmlDoc, '//Layer').find(l => l.$.name === 'layer-name-wadus');
                    assert.ok(layer0);

                    const layer1 = xpath.find(xmlDoc, '//Layer').find(l => l.$.name === 'layer1');
                    assert.ok(layer1);

                    const layer2 = xpath.find(xmlDoc, '//Layer').find(l => l.$.name === 'layer-name-top');
                    assert.ok(layer2);

                    const style0 = xpath.find(xmlDoc, '//Style').find(s => s.$.name === 'layer-name-wadus');
                    assert.ok(style0);

                    const style1 = xpath.find(xmlDoc, '//Style').find(s => s.$.name === 'layer1');
                    assert.ok(style1);

                    const style2 = xpath.find(xmlDoc, '//Style').find(s => s.$.name === 'layer-name-top');
                    assert.ok(style2);

                    done();
                });
            });
        });

        it('Uses correct layer name for interactivity layer', function (done) {
            var sql0 = 'SELECT 1 as a, 2 as b, ST_MakePoint(0,0)';
            var sql1 = 'SELECT 3 as a, 4 as b, ST_MakeLine(ST_MakePoint(-10,-5),ST_MakePoint(10,-5))';
            var style0 = '#layer0 { marker-width:3; }';
            var style1 = '#layer1 { line-color:red; }';
            var fullstyle = style0 + style1;
            var mmlStore = new grainstore.MMLStore({ use_workers: useWorkers, mapnik_version: '2.1.0' });
            var iact0 = 'a,b';
            var iact1 = 'c,d';

            var mml = mmlStore.mml_builder({
                dbname: 'my_database',
                ids: ['layer-wadus-0', 'layer-wadus-1'],
                layer: 1,
                sql: [sql0, sql1],
                interactivity: [iact0, iact1],
                style: fullstyle,
                style_version: '2.1.0'
            });

            mml.toXML(function (err, data) {
                if (err) { done(err); return; }
                xml2js.parseString(data, (err, xmlDoc) => {
                    if (err) { done(err); return; }
                    var x = xpath.find(xmlDoc, "//Parameter[@name='interactivity_layer']")[0];
                    assert.ok(x);
                    assert.equal(x._, 'layer-wadus-1');
                    done();
                });
            });
        });

        it('Allows specifying per-layer SRID', function (done) {
            var style0 = '#layer0 { marker-width:3; }';
            var style1 = '#layer1 { marker-width:4; }';
            var sql0 = 'SELECT ST_MakePoint(0,0)';
            var sql1 = 'SELECT ST_MakePoint(1,1)';
            var styleVersion0 = '2.0.2';
            var styleVersion1 = '2.1.0';
            var mmlStore = new grainstore.MMLStore({ use_workers: useWorkers, mapnik_version: '2.1.0' });

            step(
                function initBuilder () {
                    mmlStore.mml_builder({
                        dbname: 'my_database',
                        sql: [sql0, sql1],
                        style: [style0, style1],
                        style_version: [styleVersion0, styleVersion1],
                        datasource_extend: [{ srid: 1001 }, { srid: 1002 }]
                    }).toXML(this);
                },
                function checkXML0 (err, xml) {
                    if (err) {
                        throw err;
                    }
                    xml2js.parseString(xml, (err, xmlDoc) => {
                        if (err) { done(err); return; }

                        const layer0 = xpath.find(xmlDoc, '//Layer').find(l => l.$.name === 'layer0');
                        assert.ok(layer0);
                        assert.equal(layer0.Datasource.length, 1);
                        const srid0 = layer0.Datasource[0].Parameter.find(param => param.$.name === 'srid');
                        assert.equal(srid0._, '1001');

                        const layer1 = xpath.find(xmlDoc, '//Layer').find(l => l.$.name === 'layer1');
                        assert.ok(layer1);
                        assert.equal(layer1.Datasource.length, 1);
                        const srid1 = layer1.Datasource[0].Parameter.find(param => param.$.name === 'srid');
                        assert.equal(srid1._, '1002');

                        return done();
                    });
                }
            );
        });
    });
});
