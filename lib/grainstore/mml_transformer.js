// @param default_version Version of CartoCSS when unspecified in the styles
// @param target_version Version of Mapnik we want to convert to
var MMLTransformer = function(default_version, target_version) {
  this.default_version = default_version;
  this.target_version = target_version;
};

var o = MMLTransformer.prototype;

o.transform = function(style) {
  // TODO: allow version to be anywhere,
  // as long as outside {} blocks and comments and strings
  var re_ver = RegExp('^[ \n\t]*version[ \n\t]*:[ \n\t]*[\'"]([^\']*)[\'"]');
  var got_version = re_ver.exec(style);
  var version = got_version ? got_version[1] : this.default_version;

  if ( version != this.target_version ) {

    // From 2.0.x to 2.1.x we double marker-width and marker-height
    if ( version == '2.0.2' && this.target_version == '2.1.0' ) {

      // TODO: protect from "marker-width" put in text literal !
      var re = RegExp('marker-(width|height): *["\']?([^\'";]*)["\']?;', 'g');
      style = style.replace(re, function(m, l, v) {
        return 'marker-' + l + ':' + (v*2) + ';';
      });
      
    }

    else throw new Error('No CartoCSS transform path from '
                         + version + ' to ' + this.target_version);

  }

  // Add or update version string, if needed
  if ( got_version ) {
    if ( version != this.target_version ) {
      style = style.replace(re_ver, "version: '" + this.target_version + "'");
    }
  }
  else style = "version: '" + this.target_version + "'; " + style;

  //console.log('processed: ' + style);

  return style;
};

delete o;

module.exports = MMLTransformer;
