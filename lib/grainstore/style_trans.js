'use strict';

var debug = require('debug')('grainstore:style-trans');

var semver = require('semver');
var _ = require('underscore');

var convert_20_to_21 = require('./paths/from20To21');
var convert_23_to_30 = require('./paths/from23To30');


function StyleTrans() {}

module.exports = StyleTrans;

var re_MapnikGeometryType = new RegExp(/\bmapnik-geometry-type\b/g);
function convert_MapnikGeometryType(style) {
  return style.replace(re_MapnikGeometryType, '"mapnik::geometry_type"');
}

function noop(style) { return style; }

var tp = {};
tp['2.0.0'] = {
 // NOTE: 2.0.1 intentionally left blank, no path to go there
 '2.0.2': noop,
 '2.0.3': noop,
 '2.0.4': noop,
 '2.1.0': convert_20_to_21,
 '2.1.1': convert_20_to_21
};
tp['2.0.2'] = tp['2.0.3'] = tp['2.0.4'] = tp['2.0.0'];

tp['2.0.1'] = {
  // NOTE: not allowing path from 2.0.1 to ~2.0.2 as it would
  //       require to half marker-width and marker-height
  '2.1.0': convert_20_to_21
};

tp['2.1.0'] = {
 '2.1.1': noop,
 '2.2.0': noop
};
tp['2.1.1'] = tp['2.1.0'];

tp['2.2.0'] = {
  '2.3.0': noop
};

tp['2.3.0'] = {
  '3.0.12': convert_23_to_30
};

tp['3.0.12'] = {
  '3.0.13': noop
};



StyleTrans.prototype.setLayerName = function(css, layername) {
  var ret = css.replace(/#[^\s[{;:]+\s*([:\[{])/g, '#' + layername + ' $1');
  //console.log("PRE:"); console.log(css);
  //console.log("POS:"); console.log(ret);
  return ret;
};

// @param style CartoCSS
// @param from source CartoCSS/Mapnik version
// @param to target CartoCSS/Mapnik version
StyleTrans.prototype.transform = function(style, from, to) {

  // For backward compatibility
  if ( semver.satisfies(from, '<2.2.0') ) {
    style = convert_MapnikGeometryType(style);
  }

  while ( from !== to ) {
    var converter = null;
    var nextTarget = null;
    // 1. Find entry for 'from'
    if ( tp.hasOwnProperty(from) ) {
      var ct = _.keys(tp[from]).sort(semver.compare);
      for (var i = ct.length; i; i--) {
        var t = ct[i-1];

        if ( semver.satisfies(t, '>'+to) ) {
          continue;
        }

        converter = tp[from][t];
        nextTarget = t;
        break;
      }
    }
    if ( ! converter ) {
      throw new Error('No CartoCSS transform path from ' + from + ' to ' + to);
    }

    try {
        style = converter(style, from, nextTarget);
    } catch (err) {
        debug('Error parsing style from %s to %s: %s', from, to, err);
    }

    from = nextTarget;
  }

  return style;
};
