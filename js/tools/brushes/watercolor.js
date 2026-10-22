/**
 * Watercolor — soft, translucent washes painted directly onto the layer so
 * pigment builds up where strokes overlap. Each dab is a noise-deformed blob
 * filled with a radial gradient that is denser at the rim ("wet edge"),
 * plus faint satellite blobs (bleed) and fine granulation specks.
 *
 * Note: all randomness is generated *before* painting, because paint()
 * invokes the draw callback once per touched tile and every tile must draw
 * identical geometry (otherwise seams would appear at tile borders).
 */
(function (App2) {
  'use strict';

  const { Color } = App2.core;

  App2.brushes.register({
    id: 'watercolor',
    name: 'Watercolor',
    icon: 'drop',
    shortcut: 'w',
    group: 'art',
    order: 110,
    description: 'Soft washes with wet edges, bleed and pigment build-up.',
    buffered: false,
    defaults: { size: 48, opacity: 0.5, hardness: 0.3, spacing: 0.22, smoothing: 0.5, wetness: 0.6, bleed: 0.45, granulation: 0.3 },
    options: [
      { key: 'wetness', label: 'Wet edges', type: 'range', min: 0, max: 1, step: 0.01, format: 'pct' },
      { key: 'bleed', label: 'Bleed', type: 'range', min: 0, max: 1, step: 0.01, format: 'pct' },
      { key: 'granulation', label: 'Granulation', type: 'range', min: 0, max: 1, step: 0.01, format: 'pct' },
    ],

    dab(s, p) {
      const st = s.settings;
      const rng = s.rng, N = s.noise;
      const r = p.radius;
      const wet = st.wetness, bleed = st.bleed, gran = st.granulation;
      // Low per-dab alpha → gradual pigment build-up.
      const a = Math.min(1, p.alpha * 0.16 * (0.6 + 0.4 * (1 - st.hardness)));
      const rgb = s.rgb;
      const seed = rng() * 1000;

      // 1) Irregular, noise-deformed blob outline.
      const outline = [];
      const pts = 28;
      for (let i = 0; i < pts; i++) {
        const ang = (i / pts) * Math.PI * 2;
        const n = N.perlin2(Math.cos(ang) * 1.4 + seed, Math.sin(ang) * 1.4 + p.dist * 0.004);
        const rr = r * (0.82 + 0.38 * n + bleed * 0.12 * rng());
        outline.push(p.x + Math.cos(ang) * rr, p.y + Math.sin(ang) * rr);
      }

      // 2) Bleed: faint pigment drifting outward.
      let blob = null;
      if (bleed > 0 && rng() < bleed * 0.6) {
        const ang = rng() * Math.PI * 2;
        const d = r * (0.5 + rng() * 0.5);
        blob = { x: p.x + Math.cos(ang) * d, y: p.y + Math.sin(ang) * d, r: r * (0.25 + rng() * 0.35) };
      }

      // 3) Granulation: pigment settling into the paper texture.
      const specks = [];
      const count = Math.floor(gran * r * 0.8);
      for (let i = 0; i < count; i++) {
        const ang = rng() * Math.PI * 2;
        const d = Math.sqrt(rng()) * r * 0.95;
        specks.push(p.x + Math.cos(ang) * d, p.y + Math.sin(ang) * d, 0.6 + rng() * 1.2);
      }

      s.paintAt(p.x, p.y, r * 1.6 + 2, (ctx) => {
        ctx.beginPath();
        ctx.moveTo(outline[0], outline[1]);
        for (let i = 2; i < outline.length; i += 2) ctx.lineTo(outline[i], outline[i + 1]);
        ctx.closePath();
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 1.15);
        g.addColorStop(0, Color.rgba(rgb, a * (1 - wet * 0.55)));
        g.addColorStop(0.65, Color.rgba(rgb, a * (1 - wet * 0.3)));
        g.addColorStop(0.9, Color.rgba(rgb, Math.min(1, a * (1 + wet * 1.1))));
        g.addColorStop(1, Color.rgba(rgb, a * 0.25));
        ctx.fillStyle = g;
        ctx.fill();

        if (blob) {
          const bg = ctx.createRadialGradient(blob.x, blob.y, 0, blob.x, blob.y, blob.r);
          bg.addColorStop(0, Color.rgba(rgb, a * 0.6));
          bg.addColorStop(1, Color.rgba(rgb, 0));
          ctx.fillStyle = bg;
          ctx.beginPath();
          ctx.arc(blob.x, blob.y, blob.r, 0, Math.PI * 2);
          ctx.fill();
        }

        if (specks.length) {
          ctx.fillStyle = Color.rgba(Color.shadeRgb(rgb, -0.15), Math.min(1, a * 2.2));
          for (let i = 0; i < specks.length; i += 3) ctx.fillRect(specks[i], specks[i + 1], specks[i + 2], specks[i + 2]);
        }
      });
    },
  });
})(window.App2);
