var _ = require('underscore');

// can optionally pass mapnik default settings in here too 
var MMLBuilder = function(redis, opts){    

  // core variables
  var opts = opts || {};  
  var opt_keys = _.keys(opts);
    
  if (!_.include(opt_keys,'db_name') || !_.include(opt_keys, 'table_name'))
    throw new Error("Options must include db_name and table_name");
    
  // configure grainstore defaults
  var grainstore_opts = arguments[2] || {}  
  var grainstore_defaults = {
  	db_host  : 'localhost',
    db_user:   'postgres',
    db_geometry_field: "the_geom_webmercator",
    map_extent: "-20005048.4188,-9039211.13765,19907487.2779,17096598.5401",
    map_srid: 3857,
    map_srs: "+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +no_defs",
    map_max_size: 1  
  };    
  var grainstore_options = _.defaults(grainstore_opts, grainstore_defaults);
  
  
  // key generator functions maybe here. see how we go.
  
  
  // MML Builder definition
  var me = {};  
    
  me.setStyle = function(style, callback){
    
  };
  
  me.getStyle = function(callback){
    
  };
  
  me.toXML = function(callback){
    
  };
  
  me.toMML = function(callback){
    
  };  
    
    
  return me;  
};

module.exports = MMLBuilder;



// this.
// this.Datasource = { //globals go here
//   type: "postgis",
//  host  : global.settings.db_host,
//  dbname: global.settings.db_base_name,
//   user: global.settings.db_user,
//   table: null,
//   geometry_field: "the_geom_webmercator",
//   extent: "-20005048.4188,-9039211.13765,19907487.2779,17096598.5401",
//   srid: 3857,
//   max_size: 1
// }
