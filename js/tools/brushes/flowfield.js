/**
 * Flow Field — an "AI-inspired" generative brush (100% procedural, no
 * network). Every dab releases a handful of particles that travel along a
 * Perlin-noise vector field, leaving thin, hue-shifted trails — like hair,
 * wind or flowing water.
 */
(function (App2) {
  'use strict';

  const { Color } = App2.core;

  App2.brushes.register({
    id: 'flowfield',
    name: 'Flow Field',
    icon: 'flow',
    shortcut: 'f',
    group: 'gen',
    order: 210,
    description: 'Generative: particles follow a noise flow field.',
    buffered: false,
    noHardness: true,
    defaults: { size: 50, opacity: 0.55, spacing: 0.35, smoothing: 0.4, particles: 8, length: 40, scale: 0.006, hueShift: 25, lineWidth: 1.2 },
    options: [
      { key: 'particles', label: 'Particles / dab', type: 'range', min: 1, max: 40, step: 1 },
      { key: 'length', label: 'Trail length', type: 'range', min: 4, max: 140, step: 1 },
      { key: 'scale', label: 'Field scale', type: 'range', min: 0.001, max: 0.03, step: 0.0005 },
      { key: 'hueShift', label: 'Hue variation', type: 'range', min: 0, max: 120, step: 1, format: 'deg' },
      { key: 'lineWidth', label: 'Line width', type: 'range', min: 0.3, max: 8, step: 0.1, format: 'px' },
    ],

    dab(s, p) {
      const st = s.settings;
      const rng = s.rng, N = s.noise;
      const r = p.radius;
      const steps = st.length | 0;
      const stepLen = 2;
      const trails = [];
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let k = 0; k < st.particles; k++) {
        const ang0 = rng() * Math.PI * 2;
        const d0 = Math.sqrt(rng()) * r;
        let x = p.x + Math.cos(ang0) * d0, y = p.y + Math.sin(ang0) * d0;
        const pts = [x, y];
        for (let i = 0; i < steps; i++) {
          const a = N.perlin2(x * st.scale, y * st.scale) * Math.PI * 4;
          x += Math.cos(a) * stepLen;
          y += Math.sin(a) * stepLen;
          pts.push(x, y);
        }
        for (let i = 0; i < pts.length; i += 2) {
          if (pts[i] < minX) minX = pts[i];
          if (pts[i] > maxX) maxX = pts[i];
          if (pts[i + 1] < minY) minY = pts[i + 1];
          if (pts[i + 1] > maxY) maxY = pts[i + 1];
        }
        const c = Color.hueShiftRgb(s.rgb, (rng() - 0.5) * 2 * st.hueShift);
        trails.push({ pts, color: Color.rgba(Color.shadeRgb(c, (rng() - 0.5) * 0.3), 1), alpha: p.alpha * (0.4 + 0.6 * rng()) });
      }
      const lw = st.lineWidth * (0.5 + 0.5 * p.pressure);
      const pad = lw + 2;
      s.paint({ x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 }, (ctx) => {
        ctx.lineWidth = lw;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (const t of trails) {
          ctx.globalAlpha = t.alpha;
          ctx.strokeStyle = t.color;
          ctx.beginPath();
          ctx.moveTo(t.pts[0], t.pts[1]);
          for (let i = 2; i < t.pts.length; i += 2) ctx.lineTo(t.pts[i], t.pts[i + 1]);
          ctx.stroke();
        }
      });
    },
  });
})(window.App2);
