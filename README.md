Grainstore
===========

Have you ever wanted to just generate a map from a single PostGIS table? If so, this is for you.

At it's core, Grainstore is an opinionated MML builder for _single_ PostGIS tables that outputs Mapnik XML stylesheets. 

Map styles can be defined in Carto, but Grainstore also comes with some default styles to get you up and running.

The output of this library is a Mapnik XML stylesheet that you can plug directly into Mapnik to render a map.


Concept
-------

Braindead simple: 1db + 1 table + 1 style =  1 Mapnik XML stylesheet (with 1 layer).

It's only concession to complexity is the ability to include a sql argument to constrain the data to be rendered.

Use
----

```javascript

var GrainStore = require('grainstore');


// fully default.
var mmls = new GrainStore.MMLStore();
var mmlb = mmls.mml_builder({db_name: 'my_database', table_name:'my_table'});
mmlb.toXML(); // => Mapnik XML for your database with default styles



// custom redis and pg settings.
var mmls = new GrainStore.MMLStore({host:'10.0.0.1'}); 

var db_config = {
  db_name: 'my_db', 
  table_name:'my_tb', 
  sql:'select * from my_tb where age < 100
}

// see mml_store.js for all settings
var mapnik_config = {
  db_user: 'my_pg_user',
  db_geometry_field: 'my_geom',
}

mmlb = mmls.mml_builder(db_config, mapnik_config);
mmlb.toXML(function(err, data){
  console.log(data); // => Mapnik XML of custom database with default style
}); 



// custom styles.
var mmls = new GrainStore.MMLStore();
var mmlb = mmls.mml_builder({db_name: 'my_database', table_name:'my_table'});

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
```