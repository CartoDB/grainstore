Grainstore
===========

[![Build Status](http://travis-ci.org/CartoDB/grainstore.png)]
(http://travis-ci.org/CartoDB/grainstore)

Need to simply generate a Mapnik map from a dynamic PostGIS table?

Grainstore is an opinionated [Carto](https://github.com/mapbox/carto)
MML style store for PostGIS tables, views or sql queries that outputs
Mapnik XML stylesheets.

Map styles can be defined in the [Carto](https://github.com/mapbox/carto)
map styling language or use default styles. The Carto styles are persisted
and Mapnik XML output cached in Redis, making it a good choice for use
in map tile servers.

The generated Mapnik XML stylesheet plugs directly into Mapnik or Mapnik
based tile server to render a map and interactivity layer.

Grainstore is braindead simple:

 1 db + 1 table/query + 1 style =  1 Mapnik XML stylesheet.

or

 1 db + N queries + N styles =  1 Mapnik XML stylesheet.


Typical use
-----------
For using multiple layers use an array type for the 'sql' parameter and
for the 'style' parameter. Each resulting layer will be named 'layerN'
with N starting from 0 (needed to  properly reference the layers from
the 'style' values).


Install
--------
npm install


Dependencies
------------
* node.js (tested from 0.8.x to 0.10.x)
* npm


Additional test dependencies
-----------------------------
* libxml2 
* libxml2-devel


Examples
---------

```javascript

var grainstore = require('grainstore');

var params = {
  dbname: 'my_database',
  sql:'select * from my_table',
  style: '#my_table { polygon-fill: #fff; }'
}

// fully default.
var mmls = new grainstore.MMLStore();
var mmlb = mmls.mml_builder(params);
mmlb.toXML(function(err, data){
    console.log(data); // => Mapnik XML for your database with default styles
});


// custom pg settings.
var mmls = new GrainStore.MMLStore();

// see mml_store.js for more customisation detail 
var options = {
  Map: {srid: 4326},
  Datasource: {
    user: "postgres",
    geometry_field: "my_geom"
  }   
}

mmlb = mmls.mml_builder(params, options);
mmlb.toXML(function(err, data){
    console.log(data); // => Mapnik XML of custom database with default style
});


// custom styles.
var mmls = new GrainStore.MMLStore();
var mmlb = mmls.mml_builder(params);
mmlb.toMML(function(err, data){
    console.log(data) // => Carto ready MML
});

mmlb.toXML(function(err, data){
    console.log(data); // => Mapnik XML of database with custom style
});
```

For more examples, see the tests.


Tests
-----
To run the tests, from the project root:

```
npm test
```


Release
-------

```
npm publish
```

Contributing
------------

See [CONTRIBUTING.md](CONTRIBUTING.md).
