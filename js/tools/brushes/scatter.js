/**
 * Scatter — stamps procedurally drawn leaves, stars, petals, hearts,
 * sparkles or confetti along the stroke, with random rotation, size and
 * hue jitter. Every shape is drawn with canvas paths (no image assets).
 */
(function (App2) {
  'use strict';

  const { Color } = App2.core;

  /** Shape painters: draw centered at (0,0) with "radius" s. */
  const SHAPES = {
    leaves(ctx, s, col) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.bezierCurveTo(s * 0.7, -s * 0.45, s * 0.6, s * 0.55, 0, s);
      ctx.bezierCurveTo(-s * 0.6, s * 0.55, -s * 0.7, -s * 0.45, 0, -s);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = Math.max(0.5, s * 0.06);
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.85);
      ctx.lineTo(0, s * 1.15);
      for (let i = -2; i <= 2; i++) {
        const y = i * s * 0.25;
        ctx.moveTo(0, y);
        ctx.lineTo(s * 0.35, y - s * 0.22);
        ctx.moveTo(0, y);
        ctx.lineTo(-s * 0.35, y - s * 0.22);
      }
      ctx.stroke();
    },
    stars(ctx, s, col) {
      ctx.fillStyle = col;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? s * 0.42 : s;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
    },
    petals(ctx, s, col) {
      ctx.fillStyle = col;
      for (let i = 0; i < 5; i++) {
        ctx.save();
        ctx.rotate((i * Math.PI * 2) / 5);
        ctx.beginPath();
        ctx.ellipse(0, -s * 0.5, s * 0.28, s * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = 'rgba(255,220,90,0.95)';
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.2, 0, Math.PI * 2);
      ctx.fill();
    },
    hearts(ctx, s, col) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, s * 0.85);
      ctx.bezierCurveTo(-s * 1.1, s * 0.1, -s * 0.7, -s * 0.9, 0, -s * 0.35);
      ctx.bezierCurveTo(s * 0.7, -s * 0.9, s * 1.1, s * 0.1, 0, s * 0.85);
      ctx.fill();
    },
    sparkles(ctx, s, col) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.quadraticCurveTo(0, 0, s, 0);
      ctx.quadraticCurveTo(0, 0, 0, s);
      ctx.quadraticCurveTo(0, 0, -s, 0);
      ctx.quadraticCurveTo(0, 0, 0, -s);
      ctx.fill();
    },
    confetti(ctx, s, col) {
      ctx.fillStyle = col;
      ctx.fillRect(-s * 0.5, -s * 0.2, s, s * 0.4);
    },
  };

  App2.brushes.SCATTER_SHAPES = SHAPES;

  App2.brushes.register({
    id: 'scatter',
    name: 'Scatter Shapes',
    icon: 'leaf',
    shortcut: 'c',
    group: 'gen',
    order: 230,
    description: 'Generative: scatter procedural leaves, stars, petals and more.',
    buffered: false,
    noHardness: true,
    defaults: { size: 44, opacity: 1, spacing: 0.7, smoothing: 0.3, shape: 'leaves', count: 2, scatter: 0.8, sizeJitter: 0.5, rotJitter: 1, hueJitter: 25 },
    options: [
      {
        key: 'shape',
        label: 'Shape',
        type: 'select',
        choices: [['leaves', 'Leaves'], ['stars', 'Stars'], ['petals', 'Flowers'], ['hearts', 'Hearts'], ['sparkles', 'Sparkles'], ['confetti', 'Confetti']],
      },
      { key: 'count', label: 'Count / dab', type: 'range', min: 1, max: 8, step: 1 },
      { key: 'scatter', label: 'Scatter', type: 'range', min: 0, max: 3, step: 0.05 },
      { key: 'sizeJitter', label: 'Size jitter', type: 'range', min: 0, max: 1, step: 0.01, format: 'pct' },
      { key: 'rotJitter', label: 'Rotation jitter', type: 'range', min: 0, max: 1, step: 0.01, format: 'pct' },
      { key: 'hueJitter', label: 'Hue jitter', type: 'range', min: 0, max: 180, step: 1, format: 'deg' },
    ],

    dab(s, p) {
      const st = s.settings;
      const rng = s.rng;
      const draw = SHAPES[st.shape] || SHAPES.leaves;
      const items = [];
      let reach = 0;
      for (let i = 0; i < st.count; i++) {
        const ang = rng() * Math.PI * 2;
        const d = rng() * p.radius * st.scatter;
        const size = p.radius * 0.6 * (1 - st.sizeJitter * rng());
        const rot = p.angle + Math.PI / 2 + (rng() - 0.5) * Math.PI * 2 * st.rotJitter;
        const c = Color.shadeRgb(Color.hueShiftRgb(s.rgb, (rng() - 0.5) * 2 * st.hueJitter), (rng() - 0.5) * 0.3);
        items.push({ x: p.x + Math.cos(ang) * d, y: p.y + Math.sin(ang) * d, size, rot, col: Color.rgba(c, 1) });
        reach = Math.max(reach, d + size * 1.3);
      }
      s.paintAt(p.x, p.y, reach + 2, (ctx) => {
        ctx.globalAlpha = p.alpha;
        for (const it of items) {
          ctx.save();
          ctx.translate(it.x, it.y);
          ctx.rotate(it.rot);
          if (s.mirrored) ctx.scale(-1, 1);
          draw(ctx, Math.max(0.5, it.size), it.col);
          ctx.restore();
        }
      });
    },
  });
})(window.App2);
