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
1. initialise grainstore with PostGIS DB and table name
2. generate Mapnik XML for table with default styles
3. set custom style with carto 
4. get carto errors returned if present, else store style
5. generate Mapnik XML with custom style
6. initialise with PostGIS DB, table name and sql query
7. generate Mapnik XML with stored style for table name and sql query

For using multiple layers use an array type for the 'sql' parameter and
for the 'style' parameter. Each resulting layer will be named 'layerN'
with N starting from 0 (needed to  properly reference the layers from
the 'style' values).

Install
--------
npm install


Dependencies
------------
* node.js (tested from 0.4.x to 0.8.x)
* npm
* Redis
* libosr (or libgdal)


Additional test dependencies
-----------------------------
* libxml2 
* libxml2-devel


Examples
---------

```javascript

var GrainStore = require('grainstore');


// fully default.
var mmls = new GrainStore.MMLStore();
var mmlb = mmls.mml_builder({dbname: 'my_database', table:'my_table'}, function(err, payload) {
	mmlb.toXML(function(err, data){
	  console.log(data); // => Mapnik XML for your database with default styles
	}); 
});


// custom redis and pg settings.
var mmls = new GrainStore.MMLStore({host:'10.0.0.1'}); 

var render_target = {
  dbname: 'my_db', 
  table:'my_tb', 
  sql:'select * from my_tb where age < 100'
}

// see mml_store.js for more customisation detail 
var mapnik_config = {
  Map: {srid: 4326},
  Datasource: {
    user: "postgres",
    geometry_field: "my_geom"
  }   
}

mmlb = mmls.mml_builder(render_target, mapnik_config, function(err, payload) {
	mmlb.toXML(function(err, data){
	  console.log(data); // => Mapnik XML of custom database with default style
	}); 
});



// custom styles.
var mmls = new GrainStore.MMLStore();
var mmlb = mmls.mml_builder({dbname: 'my_database', table:'my_table'},
function(err, payload)
{
	var my_style = "#my_table{marker-fill: #FF6600;}"

	mmlb.setStyle(my_style, function(err, data){
	  if err throw err; // any Carto Compile errors
	  
	  mmlb.toMML(function(err, data){
	    console.log(data) // => Carto ready MML
	  }); 
	  
	  mmlb.toXML(function(err, data){
	    console.log(data); // => Mapnik XML of database with custom style
	  }); 
	  
	  mmlb.getStyle(function(err, data){
	    console.log(data); // => "#my_table{marker-fill: #FF6600;}"
	  });
	});
});

```

For more examples, see the tests.


Tests
-----
To run the tests, from the project root:

```
npm test
```


TODO
-----
* make storage pluggable

to release: npm publish
