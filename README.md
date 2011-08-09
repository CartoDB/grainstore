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

