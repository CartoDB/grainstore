var semver = require('semver');

module.exports = function() {}

var o = module.exports.prototype;

// @param style CartoCSS 
// @param from source CartoCSS/Mapnik version
// @param to target CartoCSS/Mapnik version
o.transform = function(style, from, to) {

  if ( from != to ) {

    // From 2.0.0 to 2.0.2 or 2.0.3 nothing changes
    if ( ( from == '2.0.0' || from == '2.0.2' ) && ( to == '2.0.2' || to == '2.0.3' ) ) { }

    // From 2.0.x to 2.1.x
    // See https://github.com/mapnik/mapnik/wiki/API-changes-between-v2.0-and-v2.1
    else if ( semver.satisfies(from, '~2.0.0') && semver.satisfies(to, '~2.1.0') )
    {

      // Double marker-width and marker-height but not if source is '2.0.1'
      if ( from != '2.0.1' ) {
        var re = RegExp('marker-(width|height)[\t\n ]*:[\t\n ]*(["\']?)([^\'";]*)["\']?\\b', 'g');
        style = style.replace(re, function(m, l, q, v) {
          return 'marker-' + l + ':' + q + (v*2);
        });
      }

      // Set default marker-placement to line
      var re = RegExp('([^\t\n ])[\t\n ]*}', 'g');
      style = style.replace(re, function(m, s) {
        // Only add a semicolon if not already there AND
        // not in an empty block
        return ( ( s == ';' || s == '{' ) ? s : s + ';' ) + ' marker-placement:line; }';
      });
    }

    else throw new Error('No CartoCSS transform path from '
                         + from + ' to ' + to);

  }

  return style;
};

delete o;

