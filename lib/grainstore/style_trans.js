var semver = require('semver');
var _ = require('underscore');

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
      // strip comments from styles
      // NOTE: these regexp will make a mess when comment-looking strings are put
      //       in quoted strings. We take the risk, assuming it'd be very uncommon
      //       to find literal in styles anyway...
//console.log("X: " + style);
      style = style.replace(RegExp('(/\\*[^\*]*\\*/)|(//.*\n)', 'g'), '');
//console.log("Y: " + style);

      var global_marker_directives = [];
      var global_has_marker_directives = false;
      var re = RegExp('([^{]*){([^}]*)}', 'g');
      var newstyle = style.replace(re, function(mtc, cond, stl) {
        // trim blank spaces (but not newlines) on both sides
        stl = stl.replace(/^[ \t]*/, '').replace(/[\t ]*$/, '');
        // add ending newline, if missing
        if ( /[^\s]/.exec(stl) && ! /;\s*$/.exec(stl) ) stl += ';';
        var append = '';

        var is_global_block = ! /]\s*$/.exec(cond);
        var has_marker_directives = global_has_marker_directives;
        var re = RegExp('(marker-[^\s:]*):\s*([^;}]*)', "ig");
        var marker_directives = is_global_block ? global_marker_directives : _.defaults([], global_marker_directives);
        var stl = stl.replace(re, function(m, l, v) {
          l = l.toLowerCase();
          if ( ! marker_directives.hasOwnProperty(l) ) {
            marker_directives[l] = v;
          }
          has_marker_directives = true;
          if ( is_global_block ) global_has_marker_directives = true;

          // In mapnik-2.0.x, marker-opacity only set opacity of the marker
          // fill (but not stroke). This is equivalent to the mapnik-2.1.x
          // directive ``marker-fill-opacity``. We want to translate the
          // directive name beause ``marker-opacity`` also sets stroke
          // opacity with mapnik-2.1.x.
          //
          // See https://github.com/Vizzuality/grainstore/issues/40
          //
          m = m.replace(RegExp('marker-opacity', 'i'), 'marker-fill-opacity');

          return m;
        });

        // We want to match "line-anything" but not "-line-anything"
        // See https://github.com/Vizzuality/grainstore/issues/37
        var has_line_directives = /[\s{;]line-[^\s:]*\s*:/.exec(' '+stl);
        var has_poly_directives = /[\s{;]polygon-[^\s:]*\s*/.exec(' '+stl);

        // Double marker-width and marker-height but not if source is '2.0.1'
        // TODO: put within has_marker_directives
        if ( from != '2.0.1' ) {
          var re = RegExp('marker-(width|height)[\t\n ]*:[\t\n ]*(["\']?)([^\'";}]*)["\']?\\b', 'g');
          stl = stl.replace(re, function(m, l, q, v) {
            return 'marker-' + l + ':' + q + (v*2);
          });
        }

        //console.log("Has marker directives: " + has_marker_directives );

        // Set marker-related defaults but only if any
        // "marker-xxx" directive is given
        if ( has_marker_directives ) {

          // For points, set:
          //  marker-placement:point (in 2.1.0 marker-placement:line doesn't work with points)
          //  marker-type:ellipse (in 2.0.0 marker-type:arrow didn't work with points)
          append += ' [mapnik-geometry-type=1] { marker-placement:point; marker-type:ellipse; }';

          var line_poly_override = ' [mapnik-geometry-type>1] { '

          // Set marker-placement:line for lines and polys
          // but only if a marker-placement isn't already present
          if ( ! marker_directives['marker-placement'] ) {
            line_poly_override += 'marker-placement:line; ';
          }

          var has_arrow_marker = ( marker_directives['marker_type'] == 'arrow' );

          // Set to marker-type:arrow for lines and polys
          // but only if a marker-type isn't already present and
          // the marker-placement directive requests a point (didn't work in 2.0)
          if ( ! marker_directives['marker-type'] && marker_directives['marker-placement'] != 'point' ) {
            line_poly_override += 'marker-type:arrow; ';
            has_arrow_marker = true;
          }

          // See https://github.com/mapnik/mapnik/issues/1591#issuecomment-10740221
          if ( has_arrow_marker ) {
            line_poly_override += 'marker-transform:scale(.5, .5); ';
          }

          // If the marker-placement directive requested a point we'll use ellipse marker-type
          // as 2.0 didn't work with arrows and points..
          if ( marker_directives['marker-placement'] == 'point' ) {
            line_poly_override += 'marker-type:ellipse; ';
          }

          // 2.0.0 did not clip geometries before sending 
          // to style renderer
          line_poly_override += 'marker-clip:false; ';

          line_poly_override += '}';

          append += line_poly_override;

          if ( semver.satisfies(to, "~2.1.1") ) {
            // See https://github.com/Vizzuality/grainstore/issues/36
            append += ' marker-multi-policy:whole;';
          }
        }

//console.log("STYLE: [" + style + "]");
//console.log("  STL: [" + stl + "]");

        var newblock = cond + '{ ' + stl + append + ' }';

        return newblock;
      });

      //console.log("PRE:"); console.log(style);
      style = newstyle;
      //console.log("POS:"); console.log(style);


    }

    else if ( semver.satisfies(from, '2.1.0') && semver.satisfies(to, '~2.1.1') )
    {
      // nothing to do here (hopefully)
    }


    else throw new Error('No CartoCSS transform path from '
                         + from + ' to ' + to);

  }

  //console.log("Transformed style: " + style);

  return style;
};

delete o;

