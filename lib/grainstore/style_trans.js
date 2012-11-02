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

      // TODO: drop comments from styles
      // TODO2: consider each selector in isolation
      var has_marker_directives = false;
      var re = RegExp('(marker-[^\s:]*):\s*([^;}]*)', "ig");
      var marker_directives = [];
      var nstyle = style.replace(re, function(m, l, v) {
        l = l.toLowerCase();
        if ( ! marker_directives.hasOwnProperty(l) ) {
          marker_directives[l] = v;
        }
        has_marker_directives = true;
        return m;
      });

      //console.log("style in: " + style);
      //console.log("style ou: " + nstyle);

      // Double marker-width and marker-height but not if source is '2.0.1'
      if ( from != '2.0.1' ) {
        var re = RegExp('marker-(width|height)[\t\n ]*:[\t\n ]*(["\']?)([^\'";]*)["\']?\\b', 'g');
        style = style.replace(re, function(m, l, q, v) {
          return 'marker-' + l + ':' + q + (v*2);
        });
      }

      var matches = RegExp('#([^ \t\n\r[{]*)').exec(style);
      var tabname = matches[1]; // TODO: take as arg instead ?

      //console.log("Has marker directives: " + has_marker_directives );

      // Set marker-related defaults but only if any
      // "marker-xxx" directive is given
      // TODO: this should be done per each block, possibly
      if ( has_marker_directives ) {

        // For points, set:
        //  marker-placement:point (in 2.1.0 marker-placement:line doesn't work with points)
        //  marker-type:ellipse (in 2.0.0 marker-type:arrow didn't work with points)
        style += ' #'+tabname+'[mapnik-geometry-type=1] { marker-placement:point; marker-type:ellipse; }';

        var line_poly_override = ' #'+tabname+'[mapnik-geometry-type>1] { '

        // Set marker-placement:line for lines and polys
        // but only if a marker-placement isn't already present
        if ( ! marker_directives['marker-placement'] ) {
          line_poly_override += 'marker-placement:line; ';
        }

        // Set to marker-type:arrow for lines and polys
        // but only if a marker-type isn't already present and
        // the marker-placement directive requests a point (didn't work in 2.0)
        if ( ! marker_directives['marker-type'] && marker_directives['marker-placement'] != 'point' ) {
          line_poly_override += 'marker-type:arrow; ';
        }

        // If the marker-placement directive requested a point we'll use ellipse marker-type
        // as 2.0 didn't work with arrows and points..
        if ( marker_directives['marker-placement'] == 'point' ) {
          line_poly_override += 'marker-type:ellipse; ';
        }

        line_poly_override += '}';

        style += line_poly_override;
      }

    }

    else throw new Error('No CartoCSS transform path from '
                         + from + ' to ' + to);

  }

  //console.log("Transformed style: " + style);

  return style;
};

delete o;

