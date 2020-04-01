'use strict';

var _ = require('underscore');
var semver = require('semver');

module.exports = function convert20To21 (style, from, to) {
    // strip comments from styles
    // NOTE: these regexp will make a mess when comment-looking strings are put
    //       in quoted strings. We take the risk, assuming it'd be very uncommon
    //       to find literal in styles anyway...
    // console.log("X: " + style);
    style = style.replace(new RegExp('(/\\*[^\*]*\\*/)|(//.*\n)', 'g'), ''); // eslint-disable-line
    // console.log("Y: " + style);

    var globalMarkerDirectives = [];
    var globalHasMarkerDirectives = false;
    var re = new RegExp('([^{]*){([^}]*)}', 'g');
    var newstyle = style.replace(re, function (mtc, cond, stl) {
        // trim blank spaces (but not newlines) on both sides
        stl = stl.replace(/^[ \t]*/, '').replace(/[\t ]*$/, '');
        // add ending newline, if missing
        if (/[^\s]/.exec(stl) && !/;\s*$/.exec(stl)) stl += ';';
        var append = '';

        var isGlobalBlock = !/]\s*$/.exec(cond);
        var hasMarkerDirectives = globalHasMarkerDirectives;
        var re = new RegExp('(marker-[^\s:]*):\s*([^;}]*)', 'ig'); // eslint-disable-line
        var markerDirectives = isGlobalBlock ? globalMarkerDirectives : _.defaults([], globalMarkerDirectives);
        stl = stl.replace(re, function (m, l, v) {
            l = l.toLowerCase();
            if (!Object.prototype.hasOwnProperty.call(markerDirectives, l)) {
                markerDirectives[l] = v;
            }
            hasMarkerDirectives = true;
            if (isGlobalBlock) {
                globalHasMarkerDirectives = true;
            }

            // In mapnik-2.0.x, marker-opacity only set opacity of the marker
            // fill (but not stroke). This is equivalent to the mapnik-2.1.x
            // directive ``marker-fill-opacity``. We want to translate the
            // directive name beause ``marker-opacity`` also sets stroke
            // opacity with mapnik-2.1.x.
            //
            // See https://github.com/Vizzuality/grainstore/issues/40
            //
            m = m.replace(new RegExp('marker-opacity', 'i'), 'marker-fill-opacity');

            return m;
        });

        // Double marker-width and marker-height but not if source is '2.0.1'
        // TODO: put within hasMarkerDirectives
        if (from !== '2.0.1') {
            var reDouble = new RegExp('marker-(width|height)[\t\n ]*:[\t\n ]*(["\']?)([^\'";}]*)["\']?\\b', 'g'); // eslint-disable-line
            stl = stl.replace(reDouble, function (m, l, q, v) {
                return 'marker-' + l + ':' + q + (v * 2);
            });
        }

        // console.log("Has marker directives: " + hasMarkerDirectives );

        // Set marker-related defaults but only if any
        // "marker-xxx" directive is given
        if (hasMarkerDirectives) {
            // For points, set:
            //  marker-placement:point (in 2.1.0 marker-placement:line doesn't work with points)
            //  marker-type:ellipse (in 2.0.0 marker-type:arrow didn't work with points)
            append += ' ["mapnik::geometry_type"=1] { marker-placement:point; marker-type:ellipse; }';

            var linePolyOverride = ' ["mapnik::geometry_type">1] { ';

            // Set marker-placement:line for lines and polys
            // but only if a marker-placement isn't already present
            if (!markerDirectives['marker-placement']) {
                linePolyOverride += 'marker-placement:line; ';
            }

            var hasArrowMarker = (markerDirectives.marker_type === 'arrow');

            // Set to marker-type:arrow for lines and polys
            // but only if a marker-type isn't already present and
            // the marker-placement directive requests a point (didn't work in 2.0)
            if (!markerDirectives['marker-type'] && markerDirectives['marker-placement'] !== 'point') {
                linePolyOverride += 'marker-type:arrow; ';
                hasArrowMarker = true;
            }

            // See https://github.com/mapnik/mapnik/issues/1591#issuecomment-10740221
            if (hasArrowMarker) {
                linePolyOverride += 'marker-transform:scale(.5, .5); ';
            }

            // If the marker-placement directive requested a point we'll use ellipse marker-type
            // as 2.0 didn't work with arrows and points..
            if (markerDirectives['marker-placement'] === 'point') {
                linePolyOverride += 'marker-type:ellipse; ';
            }

            // 2.0.0 did not clip geometries before sending
            // to style renderer
            linePolyOverride += 'marker-clip:false; ';

            linePolyOverride += '}';

            append += linePolyOverride;

            if (semver.satisfies(to, '~2.1.1')) {
                // See https://github.com/Vizzuality/grainstore/issues/36
                append += ' marker-multi-policy:whole;';
            }
        }

        // console.log("STYLE: [" + style + "]");
        // console.log("  STL: [" + stl + "]");

        var newblock = cond + '{ ' + stl + append + ' }';

        return newblock;
    });

    // console.log("PRE:"); console.log(style);
    style = newstyle;
    // console.log("POS:"); console.log(style);

    return style;
};
