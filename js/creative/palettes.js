/**
 * Color palette generator based on color-wheel harmonies (HSL space).
 *   App2.creative.palettes.generate(baseHex, mode, seed?) → [hex, …]
 */
(function (App2) {
  'use strict';

  const { Color, math: M, mulberry32 } = App2.core;

  const MODES = [
    ['complementary', 'Complementary'],
    ['analogous', 'Analogous'],
    ['triadic', 'Triadic'],
    ['split', 'Split-compl.'],
    ['tetradic', 'Tetradic'],
    ['monochrome', 'Monochrome'],
    ['random', 'Random harmony'],
  ];

  function hsl(h, s, l) {
    return Color.hslToHex(((h % 360) + 360) % 360, M.clamp(s, 0, 1), M.clamp(l, 0.04, 0.96));
  }

  function generate(baseHex, mode, seed) {
    const b = Color.hexToHsl(baseHex);
    // Give grays some saturation so harmonies are visible.
    const s = b.s < 0.08 ? 0.55 : b.s;
    const l = b.l < 0.08 || b.l > 0.92 ? 0.5 : b.l;
    const h = b.h;
    switch (mode) {
      case 'complementary':
        return [hsl(h, s, l - 0.2), hsl(h, s, l), hsl(h, s * 0.6, l + 0.25), hsl(h + 180, s, l), hsl(h + 180, s, l - 0.2)];
      case 'analogous':
        return [hsl(h - 40, s, l), hsl(h - 20, s, l), hsl(h, s, l), hsl(h + 20, s, l), hsl(h + 40, s, l)];
      case 'triadic':
        return [hsl(h, s, l), hsl(h + 120, s, l), hsl(h + 240, s, l), hsl(h + 120, s * 0.7, l + 0.2), hsl(h + 240, s * 0.7, l - 0.18)];
      case 'split':
        return [hsl(h, s, l), hsl(h + 150, s, l), hsl(h + 210, s, l), hsl(h, s * 0.5, l + 0.25), hsl(h + 180, s * 0.4, l - 0.2)];
      case 'tetradic':
        return [hsl(h, s, l), hsl(h + 90, s, l), hsl(h + 180, s, l), hsl(h + 270, s, l), hsl(h, s * 0.4, l + 0.3)];
      case 'monochrome':
        return [hsl(h, s, 0.18), hsl(h, s, 0.34), hsl(h, s, 0.5), hsl(h, s * 0.85, 0.68), hsl(h, s * 0.7, 0.85)];
      case 'random':
      default: {
        // Golden-angle hue steps with a shared saturation/lightness "mood".
        const rng = mulberry32(seed == null ? (Math.random() * 1e9) | 0 : seed);
        const baseH = rng() * 360;
        const sat = 0.45 + rng() * 0.4;
        const lig = 0.42 + rng() * 0.2;
        const out = [];
        for (let i = 0; i < 5; i++) {
          out.push(hsl(baseH + i * 137.508 * (0.3 + rng() * 0.25), sat + (rng() - 0.5) * 0.2, lig + (i - 2) * 0.09 + (rng() - 0.5) * 0.08));
        }
        return out;
      }
    }
  }

  App2.creative.palettes = { MODES, generate };
})(window.App2);
