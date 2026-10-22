/**
 * Marker — flat, semi-transparent ink. Buffered: everything drawn inside one
 * stroke is merged at a single opacity, so crossing your own stroke does not
 * darken it (just like a real felt marker within one pass). Separate strokes
 * still layer on top of each other.
 */
(function (App2) {
  'use strict';

  App2.brushes.register({
    id: 'marker',
    name: 'Marker',
    icon: 'marker',
    shortcut: 'm',
    group: 'paint',
    order: 30,
    description: 'Flat semi-transparent marker — no build-up within a stroke.',
    buffered: true,
    defaults: { size: 22, opacity: 0.55, hardness: 0.92, spacing: 0.05, pressureSize: false },
    options: [{ key: 'tip', label: 'Tip', type: 'select', choices: [['round', 'Round'], ['chisel', 'Chisel']] }],
    dab(s, p) {
      if (s.settings.tip === 'chisel') {
        const r = p.radius;
        s.paintAt(p.x, p.y, r, (ctx) => {
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = s.hex;
          ctx.translate(p.x, p.y);
          ctx.rotate(-Math.PI / 4);
          ctx.beginPath();
          ctx.ellipse(0, 0, r, r * 0.3, 0, 0, Math.PI * 2);
          ctx.fill();
        });
      } else {
        s.dab(p.x, p.y, p.radius, p.alpha, s.settings.hardness);
      }
    },
  });
})(window.App2);
