Version 1.1.0
2015-10-21

 - Add options param in MMLStore to create MMLBuilder with extra options

Version 1.0.0
2015-07-05

 - **IMPORTANT**: backwards incompatible release: to keep using previous API/behaviour stick to 0.x series
 - Simpler API with just allow to get XML from params
 - No more style storing in Redis


Version 0.23.0
2015-02-10

 - Allow specifying/modifying datasource per layer

Version 0.22.1
2014-12-02

 - Freezes millstone version to 0.6.14 to support node.js v0.8.x

Version 0.22.0
2014-09-23

 - Adds transformation path to from 2.2.0 to 2.3.0

Version 0.21.0
2014-09-16

 - Removes unused base64
 - Upgrades dependencies
    - semver
    - millstone
 - Removes mapnik-reference dependency
 - Allow specifying a extra datasource options for each layer
 - Allow specifying a column type for each layer (#93)

Version 0.20.0
2014-08-13

 - Upgrades dependencies:
    - underscore
    - redis-mpool
 - Specifies name in the redis pool

Version 0.19.0
2014-08-07

 - Allow specifying a column name for each layer (#92)
 - Allow specifying different formats for tile via optional args

Version 0.18.2
2014-07-02

 - Allows specifiying search_path when building the MML
 - How to release documentation
 - License update

Version 0.18.1
2014-03-04

 - Stop using WATCH (#89)
 - Require redis-mpool ~0.0.4

Version 0.18.0
2014-02-13

 - Augment verbosity of localized resource purges
 - Drop support for configuration options "gc_prob" and "ttl"
 - Stop storing table-less configs in redis (#86)
 - Drop support for constructing MMLBuilder by token
 - Drop MMLStore.gc() method
 - Drop MMLBuilder.touch() method
 - Tested to work with node-0.10.26 (#87)

Version 0.17.1
2014-02-11

 - Stop scanning "related keys" on setStyle and delStyle (#84)

Version 0.17.0
2014-01-24

 - Use a single cache of localized resources, purge after
   1 day of no access (#82)
 - Allow setting TTL=0 to skip storage of table-less tokens (#81)
 - Allow passing own RedisPooler to MMLStore ctor (#76)

Version 0.16.0
2014-01-14

 - Stop caching XML in redis (#79, #80)
 - Do not include XML in MMLBuilder.getStyle return (#25)
 - Use external module for redis pooling (#75)
 - Install carto dependency via http (#77)

Version 0.15.2
2013-12-05

 - Allow constructing MMLBuilder against bogus redis layergroup (#73)
 - Fix MMLBuilder construction by token after mapnik version change (#73)

Version 0.15.1
2013-11-28

 - Fix carto renderer configuration pollution between calls

Version 0.15.0
2013-11-28

 - Accept carto renderer configuration, allowing (among other things)
   providing a list of font names for validation (#72)
 - Allow overriding db host and port in MMLBuilder constructor (#70)

Version 0.14.3
2013-11-26

 - Allow constructing MMLBuilder against bogus redis css (#71)

Version 0.14.2
2013-11-07

 - Fix support for exponential notation in filter values (#69)
 - Fix expiration time logging unit (#68)

Version 0.14.1
2013-10-31

 - Inherit default PostgreSQL connection parameters from libpq

Version 0.14.0
2013-10-29

 - Add support for Mapnik-2.2.0 (#67)

Version 0.13.12
2013-10-10

 - Restore support for node-0.8.9, relaxing millstone dep (#64)
   (requires deployers to use srs-0.3.2)

Version 0.13.11
2013-10-03

 - Fix support for apostrophes in CartoCSS filters (#63)
 - Back to tracking mainstream millstone (~0.6.5)

Version 0.13.10
2013-09-12

 - Fix error message for invalid content in non-selfclosing tags (#62)

Version 0.13.9
2013-09-09

 - Fix support for use of space-prefixed "zoom" in CartoCSS (#61)

Version 0.13.8
2013-09-04

 - Fix race condition in external resource localization (#60)

Version 0.13.7
2013-08-13

 - Change 'layer#' to 'style#' in blank CartoCSS error (#59)

Version 0.13.6
2013-07-16

 - Error out on blank CartoCSS array element (#59)

Version 0.13.5
2013-06-28

 - Fix support for CartoCSS attachments (#57)
 - Expose a knownByRedis property to MMLBuilder instances

Version 0.13.4
2013-06-12

 - Upgrade redis to 0.8.3
 - Fix deadlock during GC (#55)

Version 0.13.3
2013-06-06

 - More fixes to code replacing layer name (#54)

Version 0.13.2
2013-05-29

 - Do not confuse colors with layer names (#53)

Version 0.13.1
2013-05-29

 - Fix handling of multiple style sections (#53)

Version 0.13.0
2013-04-04

WARNING: this version changes expected format for "interactivity"
         option introduced in 0.12.0

 - Upgrade generic-pool requirement to ~2.0.3
 - Add support for per-layer "interactivity" option (array)

Version 0.12.0
2013-03-29

 - Add support for "interactivity" option (#51)

Version 0.11.2
2013-03-22

 - Fix use of ampersend characters in CartoCSS (#50)
 - Fix async error on invalid .touch() call

Version 0.11.1
2013-02-25

 - Cleanly handle redis key disappearance on MMLBuilder.getStyle
 - Fix MMLBuilder construction error handling in GC

Version 0.11.0 - Multilayer
2013-02-14

 - Tracking upstream mapnik-reference ~5.0.4
 - MMLBuilder constructor callback is now mandatory
 - Redis keys for extended styles use md5 hash now
 - Check redis connection at pool creation time
 - Multilayer support:
    - Support arrays for "sql", "style" and "style_version" parameters (#48)
    - New getToken() API method
    - New touch() API method 
    - Probabilistic based garbage collection for table-less styles

Version 0.10.9 - "EOW"
2012-12-21

 - Reduce default extent to allow for consistent proj4
   round-tripping (#42)
 - Revert marker-multi-policy to 'whole' now that
   centroid computation for multi was fixed in mapnik-2.1.x
 - Do not force line-clip and polygon-clip to false (#46)

Version 0.10.8
2012-11-28

 - Use marker-multi-policy:largest as a workaround for
   mapnik bug in centroid computation (#44)

Version 0.10.7
2012-11-28

 - Fix comments stripping during CartoCSS transform (#41)
 - Fix default extent to be full webmercator extent (#42)
 - Enhance 2.0 -> 2.1 style transform
   - Convert marker-opacity to marker-fill-opacity (#40)

Version 0.10.6
2012-11-28

 - Enhance 2.0 -> 2.1 style transform
   - Consider directives in blocks with no conditions as applying
     to all blocks. Fixes issue #39

Version 0.10.5
2012-11-27

 - For mapnik-2.1.0+, set default style version to target version
 - Scale arrow markers by 50% in 2.0.x -> 2.1.0 transform

Version 0.10.4
2012-11-23

 - Fix enforcement of line symbolizer with marker-line-* (#37)
 - Add support CartoCSS transform from mapnik 2.0.x to 2.1.1:
   - marker-multi-policy:whole forced (#36)

Version 0.10.3
2012-11-20

 - Fix eating of lines after one-line comments (#35)
 - Strip comments from styles before performing transformations

Version 0.10.2
2012-11-20

 - Set line-clip:false and polygon-clip:false when transforming styles
   from 2.0 to 2.1 (#34)

Version 0.10.1
2012-11-15

 - Fix transform of styles using markers conditionally (#33)

Version 0.10.0
2012-11-14

 - Add optional "convert" parameter to MMLBuilder.getStyle() method (#32)

Version 0.9.7
2012-11-13

 - Gracefully handle unsupported geometry types
 - Make default style good for any geometry type (#22)

Version 0.9.6
2012-11-09

 - Set marker-clip:false when transforming styles from 2.0 to 2.1

Version 0.9.5
2012-11-06

 - Fix transformation of styles with missing semicolon (#30)

Version 0.9.4
2012-11-02

 - Add support for using "mapnik-geometry-type" in filters
 - Enhanced 2.0 to 2.1 style transform:
   - Set default marker-placement to line for lines and polygons
   - Set marker-type to 'ellipse' when marker-pacement is 'point'

Version 0.9.3
2012-10-30

 - Fix race condition resulting in effects of setStyle occasionally
   overridden by existing styl repairing code at read time (#27)
 - Fix "make check" return status

Version 0.9.2
2012-10-19

 - Fix mml_builder constructor to accept a style_version parameter

Version 0.9.1
2012-10-09

 - Add xml_version to rendered style caches
 - Regenerate XML cache on xml_version missing or mismatch

Version 0.9.0
2012-10-09

 - Add grainstore.version() API method

Version 0.8.1
2012-10-08

 - Add support for 2.0.3 in style transformer

Version 0.8.0
2012-10-08

 - Support requesting conversion with .setStyle and .resetStyle
 - Add --convert switch to tools/reset_styles for batch-conversion

Version 0.7.0
2012-09-28

 - Style versioning
   - Allow specifying style version in .setStyle 
   - Return style version from .getStyle
   - Include style version in store
   - Allow specifying target mapnik version
   - Transform CartoCSS to target mapnik version on rendering
 - Only store CartoCSS in the base redis key (#23)
 - Back to tracking mainstream millstone (~0.5.9)
 - Back to tracking mainstream carto (~0.9.2)
 - Many more tests for custom style storage in redis
 - Add tools/reset_styles script to reset all styles

Version 0.6.4
2012-09-20

 - Target a branch of millstone that fixes support for urls
   containing regexp control chars in them (most notably '+')

Version 0.6.3
2012-09-20

 - Fix MMBuilder.resetStyle (and add proper testcase)

Version 0.6.2
2012-09-19

 NOTE: when upgrading from 0.6.0 you will need to rename any existing
       localized resources directories or force re-rendering of the
       XML styles.

 - Add MMBuilder.resetStyle method to re-render an XML style
 - Reconstruct the XML when lost in redis
 - Change localized resources path from <dbname>-<tablename>
   to <dbname>/<tablename>. 

Version 0.6.1
2012-09-18

 - Fix support for node-0.4

Version 0.6.0
2012-09-14

 API changes (backward compatible):
   - Automatically localise external resources in CartoCSS (#4)

Version 0.5.0
2012-09-03

 API changes:
   - Exclude database username in redis style cache key (introduced in 0.3)

Version 0.4.0
2012-08-13

 API changes (backward compatible):
   - Add a mapnik_version option in MMLBuilder constructor
 Other changes:
   - Add more CartoCSS parsing and conversion tests
 Bug fixes:
   - Accept 'point-transform' without 'point-file' (#20)

Version 0.3.1
2012-07-25

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
