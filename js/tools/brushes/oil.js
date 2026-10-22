/**
 * Oil — a bristle brush. Each bristle leaves its own streak with a slightly
 * different shade; the brush "carries" paint that mixes with whatever is
 * already on the canvas (color pickup / smudge) and slowly reloads toward
 * the chosen color.
 */
(function (App2) {
  'use strict';

  const { Color } = App2.core;

  App2.brushes.register({
    id: 'oil',
    name: 'Oil Paint',
    icon: 'oil',
    shortcut: 'o',
    group: 'art',
    order: 120,
    description: 'Bristle streaks that pick up and smear colors already on the canvas.',
    buffered: false,
    noHardness: true,
    defaults: { size: 28, opacity: 0.95, spacing: 0.06, smoothing: 0.45, bristles: 16, pickup: 0.5, streak: 0.5 },
    options: [
      { key: 'bristles', label: 'Bristles', type: 'range', min: 3, max: 48, step: 1 },
      { key: 'pickup', label: 'Color pickup', type: 'range', min: 0, max: 1, step: 0.01, format: 'pct' },
      { key: 'streak', label: 'Streakiness', type: 'range', min: 0, max: 1, step: 0.01, format: 'pct' },
    ],

    begin(s) {
      const n = Math.max(3, s.settings.bristles | 0);
      const S = s.state;
      S.paint = { r: s.rgb.r, g: s.rgb.g, b: s.rgb.b };
      S.bristles = [];
      for (let i = 0; i < n; i++) {
        S.bristles.push({
          off: (i / (n - 1)) * 2 - 1 + (s.rng() - 0.5) * 0.12,
          shade: (s.rng() - 0.5) * 0.3,
          w: 0.6 + s.rng() * 0.9,
          dry: s.rng(), // how readily this bristle skips (dry-brush effect)
          prev: null,
        });
      }
    },

    dab(s, p) {
      const st = s.settings;
      const S = s.state;
      const rng = s.rng;
      const r = p.radius;

      // Pick up color from the canvas, then slowly reload the brush color.
      const smp = s.sample(p.x, p.y, Math.max(2, r * 0.6));
      if (smp.a > 0.03) S.paint = Color.mixRgb(S.paint, smp, st.pickup * smp.a * 0.3);
      S.paint = Color.mixRgb(S.paint, s.rgb, 0.03 * (1 - st.pickup) + 0.005);

      const nx = -Math.sin(p.angle), ny = Math.cos(p.angle);
      const lw = Math.max(0.8, ((r * 2) / S.bristles.length) * 1.5);

      // Build the streak segments first (random decisions must be identical
      // for every tile the dab touches).
      const segs = [];
      for (const b of S.bristles) {
        const bx = p.x + nx * b.off * r, by = p.y + ny * b.off * r;
        if (b.prev && rng() >= st.streak * 0.35 * b.dry) {
          const c = Color.shadeRgb(S.paint, b.shade * (0.4 + st.streak));
          segs.push({ x0: b.prev.x, y0: b.prev.y, x1: bx, y1: by, color: Color.rgba(c, 1), alpha: Math.min(1, p.alpha * (0.6 + 0.4 * rng())), w: lw * b.w });
        }
        b.prev = { x: bx, y: by };
      }
      if (!segs.length) return;

      s.paintAt(p.x, p.y, r * 1.6 + lw * 2 + 8, (ctx) => {
        ctx.lineCap = 'round';
        for (const g of segs) {
          ctx.globalAlpha = g.alpha;
          ctx.strokeStyle = g.color;
          ctx.lineWidth = g.w;
          ctx.beginPath();
          ctx.moveTo(g.x0, g.y0);
          ctx.lineTo(g.x1, g.y1);
          ctx.stroke();
        }
      });
    },
  });
})(window.App2);
