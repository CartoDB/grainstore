var RedisPool  = require('./redis_pool')
  , MMLBuilder = require('./mml_builder');

var MMLStore = function(redis_opts){  

  var redis_pool = new RedisPool(redis_opts),  
      me = {};
 
  // Creation of core MML builder interface
  // opts must have:
  // `db_name` - name of database
  // `table_name` - name of table with geospatial data
  // 
  // opts may optionally have:
  // `sql` - sql to constrain the map by
  //
  // In addition to opts, you may pass in a second argument to override
  // the grainstore defaults. The default grainstore settings are:
  //
  // {
  //   db_host: 'localhost',
  //   db_user: 'postgres',
  //   db_geometry_field: 'the_geom_webmercator',
  //   map_extent: '-20005048.4188,-9039211.13765,19907487.2779,17096598.5401',
  //   map_srid: 3857,
  //   map_srs: '+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +no_defs',
  //   map_max_size: 1
  // }
  me.mml_builder = function(opts){
    return new MMLBuilder(redis_pool, opts, arguments[1]);    
  }
  
  return me;  
};

module.exports = MMLStore;