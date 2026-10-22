/**
 * Color conversion utilities.
 *   - RGB components are 0..255
 *   - HSV / HSL: h in degrees 0..360, s/v/l in 0..1
 *   - Hex strings are normalised to lowercase "#rrggbb"
 */
(function (App2) {
  'use strict';

  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const hex2 = (n) => {
    const s = Math.round(clamp(n, 0, 255)).toString(16);
    return s.length === 1 ? '0' + s : s;
  };

  const Color = {
    /** Accepts "#rgb", "rgb", "#rrggbb", "rrggbb", "#rrggbbaa". Returns "#rrggbb" or null. */
    normalizeHex(str) {
      if (typeof str !== 'string') return null;
      let s = str.trim().replace(/^#/, '').toLowerCase();
      if (/^[0-9a-f]{3}$/.test(s)) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
      if (/^[0-9a-f]{8}$/.test(s)) s = s.slice(0, 6);
      if (!/^[0-9a-f]{6}$/.test(s)) return null;
      return '#' + s;
    },

    hexToRgb(hex) {
      const h = Color.normalizeHex(hex) || '#000000';
      const n = parseInt(h.slice(1), 16);
      return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    },

    rgbToHex(r, g, b) {
      if (typeof r === 'object') return Color.rgbToHex(r.r, r.g, r.b);
      return '#' + hex2(r) + hex2(g) + hex2(b);
    },

    rgbToHsv(r, g, b) {
      r /= 255; g /= 255; b /= 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const d = max - min;
      let h = 0;
      if (d !== 0) {
        if (max === r) h = ((g - b) / d) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h *= 60;
        if (h < 0) h += 360;
      }
      return { h, s: max === 0 ? 0 : d / max, v: max };
    },

    hsvToRgb(h, s, v) {
      h = ((h % 360) + 360) % 360;
      const c = v * s;
      const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
      const m = v - c;
      let r = 0, g = 0, b = 0;
      if (h < 60) { r = c; g = x; }
      else if (h < 120) { r = x; g = c; }
      else if (h < 180) { g = c; b = x; }
      else if (h < 240) { g = x; b = c; }
      else if (h < 300) { r = x; b = c; }
      else { r = c; b = x; }
      return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
    },

    rgbToHsl(r, g, b) {
      r /= 255; g /= 255; b /= 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const l = (max + min) / 2;
      const d = max - min;
      let h = 0, s = 0;
      if (d !== 0) {
        s = d / (1 - Math.abs(2 * l - 1));
        if (max === r) h = ((g - b) / d) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h *= 60;
        if (h < 0) h += 360;
      }
      return { h, s, l };
    },

    hslToRgb(h, s, l) {
      h = ((h % 360) + 360) % 360;
      const c = (1 - Math.abs(2 * l - 1)) * s;
      const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
      const m = l - c / 2;
      let r = 0, g = 0, b = 0;
      if (h < 60) { r = c; g = x; }
      else if (h < 120) { r = x; g = c; }
      else if (h < 180) { g = c; b = x; }
      else if (h < 240) { g = x; b = c; }
      else if (h < 300) { r = x; b = c; }
      else { r = c; b = x; }
      return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
    },

    hexToHsv(hex) {
      const c = Color.hexToRgb(hex);
      return Color.rgbToHsv(c.r, c.g, c.b);
    },
    hsvToHex(h, s, v) {
      return Color.rgbToHex(Color.hsvToRgb(h, s, v));
    },
    hexToHsl(hex) {
      const c = Color.hexToRgb(hex);
      return Color.rgbToHsl(c.r, c.g, c.b);
    },
    hslToHex(h, s, l) {
      return Color.rgbToHex(Color.hslToRgb(h, clamp(s, 0, 1), clamp(l, 0, 1)));
    },

    /** Linear blend between two {r,g,b} colors. */
    mixRgb(a, b, t) {
      return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t };
    },

    /** Lighten (k > 0) towards white or darken (k < 0) towards black. */
    shadeRgb(c, k) {
      return k >= 0 ? Color.mixRgb(c, { r: 255, g: 255, b: 255 }, k) : Color.mixRgb(c, { r: 0, g: 0, b: 0 }, -k);
    },

    /** Shift hue of an {r,g,b} color by `deg` degrees. */
    hueShiftRgb(c, deg) {
      const hsl = Color.rgbToHsl(c.r, c.g, c.b);
      return Color.hslToRgb(hsl.h + deg, hsl.s, hsl.l);
    },

    /** CSS rgba() string from {r,g,b} and alpha 0..1. */
    rgba(c, a) {
      return 'rgba(' + Math.round(c.r) + ',' + Math.round(c.g) + ',' + Math.round(c.b) + ',' + clamp(a, 0, 1).toFixed(4) + ')';
    },

    /** Black or white, whichever reads better on top of `hex`. */
    contrastText(hex) {
      const c = Color.hexToRgb(hex);
      const lum = (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255;
      return lum > 0.6 ? '#000000' : '#ffffff';
    },
  };

  App2.core.Color = Color;
})(window.App2);
