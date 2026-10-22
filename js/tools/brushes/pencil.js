/**
 * Pencil — hard, aliased pixels (no anti-aliasing). Draws integer-aligned
 * squares along a Bresenham line, so 1px lines stay perfectly crisp.
 */
(function (App2) {
  'use strict';

  const U = App2.brushes.util;

  App2.brushes.register({
    id: 'pencil',
    name: 'Pencil',
    icon: 'pencil',
    shortcut: 'n',
    group: 'paint',
    order: 20,
    description: 'Hard aliased pencil — crisp 1px lines.',
    buffered: true,
    noHardness: true,
    maxSize: 32,
    defaults: { size: 1, opacity: 1, smoothing: 0, pressureSize: false },
    segment(s, a, b) {
      const w = Math.max(1, Math.round(s.radiusFor(b.pressure) * 2));
      const half = Math.floor(w / 2);
      const x0 = Math.floor(a.x), y0 = Math.floor(a.y), x1 = Math.floor(b.x), y1 = Math.floor(b.y);
      const rect = {
        x: Math.min(x0, x1) - half - 1,
        y: Math.min(y0, y1) - half - 1,
        w: Math.abs(x1 - x0) + w + 2,
        h: Math.abs(y1 - y0) + w + 2,
      };
      s.paint(rect, (ctx) => {
        ctx.globalAlpha = s.alphaFor(b.pressure);
        ctx.fillStyle = s.hex;
        U.bresenham(x0, y0, x1, y1, (x, y) => ctx.fillRect(x - half, y - half, w, w));
      });
    },
  });
})(window.App2);
