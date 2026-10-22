/**
 * Generative Ribbon — a twisting, hue-cycling ribbon that follows the
 * stroke. Its width oscillates (and flips sides) with a sine + noise
 * function, so the ribbon appears to turn in 3D. Optional "fibers" add
 * thin threads along the ribbon's surface.
 */
(function (App2) {
  'use strict';

  const { Color } = App2.core;

  App2.brushes.register({
    id: 'ribbon',
    name: 'Generative Ribbon',
    icon: 'ribbon',
    shortcut: 'y',
    group: 'gen',
    order: 220,
    description: 'Generative: twisting, color-cycling ribbon.',
    buffered: false,
    noHardness: true,
    defaults: { size: 40, opacity: 0.7, spacing: 0.12, smoothing: 0.6, twist: 0.03, hueCycle: 0.4, fibers: 5, pressureSize: true },
    options: [
      { key: 'twist', label: 'Twist', type: 'range', min: 0, max: 0.12, step: 0.002 },
      { key: 'hueCycle', label: 'Hue cycling', type: 'range', min: 0, max: 3, step: 0.05 },
      { key: 'fibers', label: 'Fibers', type: 'range', min: 0, max: 16, step: 1 },
    ],

    begin(s) {
      s.state.prevL = null;
      s.state.prevR = null;
      s.state.angle = null;
      s.state.phase = s.rng() * Math.PI * 2;
    },

    dab(s, p) {
      const st = s.settings;
      const S = s.state;
      // Smooth the direction so the ribbon does not kink on jittery input.
      if (S.angle === null) S.angle = p.angle;
      else {
        let d = p.angle - S.angle;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        S.angle += d * 0.35;
      }
      const t = p.dist;
      const n = s.noise.perlin2(t * 0.01, S.phase);
      const w = p.radius * Math.sin(t * st.twist + S.phase + n * 1.5);
      const nx = -Math.sin(S.angle), ny = Math.cos(S.angle);
      const L = { x: p.x + nx * w, y: p.y + ny * w };
      const R = { x: p.x - nx * w, y: p.y - ny * w };
      if (S.prevL) {
        const pl = S.prevL, pr = S.prevR;
        const hsl = Color.rgbToHsl(s.rgb.r, s.rgb.g, s.rgb.b);
        const hue = hsl.h + t * st.hueCycle;
        // Shade by |width| so the "turning" edge looks darker.
        const facing = Math.abs(w) / Math.max(1, p.radius);
        const fill = Color.hslToRgb(hue, Math.max(0.35, hsl.s), Math.min(0.85, Math.max(0.15, hsl.l * (0.65 + 0.5 * facing))));
        const edge = Color.shadeRgb(fill, -0.35);
        const fibers = [];
        for (let i = 1; i <= st.fibers; i++) {
          const k = i / (st.fibers + 1);
          fibers.push([pl.x + (pr.x - pl.x) * k, pl.y + (pr.y - pl.y) * k, L.x + (R.x - L.x) * k, L.y + (R.y - L.y) * k]);
        }
        const xs = [pl.x, pr.x, L.x, R.x], ys = [pl.y, pr.y, L.y, R.y];
        const x0 = Math.min.apply(null, xs) - 3, y0 = Math.min.apply(null, ys) - 3;
        const rect = { x: x0, y: y0, w: Math.max.apply(null, xs) - x0 + 6, h: Math.max.apply(null, ys) - y0 + 6 };
        s.paint(rect, (ctx) => {
          ctx.globalAlpha = p.alpha * 0.55;
          ctx.fillStyle = Color.rgba(fill, 1);
          ctx.beginPath();
          ctx.moveTo(pl.x, pl.y);
          ctx.lineTo(L.x, L.y);
          ctx.lineTo(R.x, R.y);
          ctx.lineTo(pr.x, pr.y);
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = p.alpha * 0.9;
          ctx.strokeStyle = Color.rgba(edge, 1);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(pl.x, pl.y);
          ctx.lineTo(L.x, L.y);
          ctx.moveTo(pr.x, pr.y);
          ctx.lineTo(R.x, R.y);
          ctx.stroke();
          if (fibers.length) {
            ctx.globalAlpha = p.alpha * 0.3;
            ctx.lineWidth = 0.6;
            ctx.strokeStyle = Color.rgba(Color.shadeRgb(fill, 0.4), 1);
            ctx.beginPath();
            for (const f of fibers) {
              ctx.moveTo(f[0], f[1]);
              ctx.lineTo(f[2], f[3]);
            }
            ctx.stroke();
          }
        });
      }
      S.prevL = L;
      S.prevR = R;
    },
  });
})(window.App2);
