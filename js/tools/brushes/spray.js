/**
 * Spray paint — an airbrush that keeps spraying while the pointer is held
 * still. Droplets are denser in the center and build up over time.
 */
(function (App2) {
  'use strict';

  const { Color } = App2.core;

  App2.brushes.register({
    id: 'spray',
    name: 'Spray Paint',
    icon: 'spray',
    shortcut: 'a',
    group: 'art',
    order: 130,
    description: 'Airbrush spray — hold still to build up paint.',
    buffered: false,
    airbrush: true,
    noHardness: true,
    defaults: { size: 70, opacity: 0.8, spacing: 0.25, smoothing: 0.2, density: 60, dotSize: 1.2 },
    options: [
      { key: 'density', label: 'Density', type: 'range', min: 5, max: 400, step: 1 },
      { key: 'dotSize', label: 'Droplet size', type: 'range', min: 0.5, max: 6, step: 0.1, format: 'px' },
    ],
    dab(s, p) {
      const st = s.settings;
      const rng = s.rng;
      const r = p.radius;
      const count = Math.max(1, Math.round(st.density * (0.4 + 0.6 * p.pressure)));
      // Pre-generate droplets so every tile touched by paintAt draws the same ones.
      const drops = [];
      for (let i = 0; i < count; i++) {
        const ang = rng() * Math.PI * 2;
        const d = r * Math.pow(rng(), 0.75) * Math.sqrt(rng()); // center-weighted
        const sz = st.dotSize * (0.5 + rng());
        drops.push(p.x + Math.cos(ang) * d - sz / 2, p.y + Math.sin(ang) * d - sz / 2, sz, p.alpha * (0.35 + 0.65 * rng()));
      }
      s.paintAt(p.x, p.y, r + st.dotSize + 1, (ctx) => {
        ctx.fillStyle = Color.rgba(s.rgb, 1);
        for (let i = 0; i < drops.length; i += 4) {
          ctx.globalAlpha = drops[i + 3];
          ctx.fillRect(drops[i], drops[i + 1], drops[i + 2], drops[i + 2]);
        }
      });
    },
  });
})(window.App2);
