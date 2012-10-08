module.exports = function() {
}

var o = module.exports.prototype;

// @param style CartoCSS 
// @param from source CartoCSS/Mapnik version
// @param to target CartoCSS/Mapnik version
o.transform = function(style, from, to) {

  if ( from != to ) {

    // From 2.0.0 to 2.0.2 or 2.0.3 nothing changes
    if ( ( from == '2.0.0' || from == '2.0.2' ) && ( to == '2.0.2' || to == '2.0.3' ) ) { }

    // From 2.0.0 or 2.0.2 or 2.0.3 to 2.1.x we double marker-width and marker-height
    else if ( ( from == '2.0.0' || from == '2.0.2' || from == '2.0.3' ) && to == '2.1.0' ) {

      // TODO: protect from "marker-width" put in text literal !
      var re = RegExp('marker-(width|height)[\t\n ]*:[\t\n ]*(["\']?)([^\'";]*)["\']?\\b', 'g');
      style = style.replace(re, function(m, l, q, v) {
        return 'marker-' + l + ':' + q + (v*2);
      });
      
    }

    else throw new Error('No CartoCSS transform path from '
                         + from + ' to ' + to);

  }

  return style;
};

delete o;

