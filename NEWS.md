Version 0.3.1
2012-MM-DD

 - Loosen carto dependency to include the 0.8 series
 - Drop 'srs' dependency, use "+init=epsg:xxx" in map XML to 
   allow mapnik do special handling of wgs84->webmercator reprojection

Version 0.3.0
2012-07-12

 API changes:
   - Add optional callback parameter to MMLBuilder constructors
   - Allow overriding db authentication with mml_builder options
   - Include database username in redis style cache key

Version 0.2.4
2012-07-11

 - Improve testsuite to automatically start redis (#14)
 - Clarify licensing terms (#15)
 - Loosen undescrore requirements to 1.1 - 1.3
 - Require mocha 1.2.1 as 1.2.2 doesn't work with node-0.4
   ( https://github.com/visionmedia/mocha/issues/489 )
 - Require hiredis 0.1.14 for OSX 10.7 support
   ( https://github.com/Vizzuality/Windshaft-cartodb/issues/14 )

Version 0.2.3
2012-07-03

 - Tests ported to mocha (#11)
 - Require libxmljs-0.5.x and redis-0.7.2 (for node-0.8.x compatibility)

Version 0.2.2 
2012-06-26

 - Require leaks free 'carto' 0.7.0 and 'srs' 0.2.14 (#12)
 - Testsuite improvements:
   - Add support for make check 
   - Fix invalid syntax used in tests for mml_builder (#13)
   - Print unexpected error message in mml_buider test


Version 0.2.1 
2012-06-06

Version 0.2.0
2011-12-08

Version 0.0.12
2011-11-30

Version 0.0.11
2011-11-25

Version 0.0.10
2011-10-07

Version 0.0.9
2011-09-20

Version 0.0.8
2011-09-20

Version 0.0.7
2011-09-14

Version 0.0.6
2011-09-06

Version 0.0.5
2011-09-04

Version 0.0.4
2011-08-15

Version 0.0.3
2011-08-15

Version 0.0.2
2011-08-11

Version 0.0.1
2011-08-11
