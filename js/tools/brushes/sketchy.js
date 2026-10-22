/**
 * Sketchy Web — a generative "neighbour web" brush. Along with the main
 * line it connects the current point to nearby earlier points of the same
 * stroke with faint hairlines, producing a hand-sketched shading effect.
 */
(function (App2) {
  'use strict';

  const { Color } = App2.core;

  App2.brushes.register({
    id: 'sketchy',
    name: 'Sketchy Web',
    icon: 'sketchy',
    shortcut: 'k',
    group: 'gen',
    order: 240,
    description: 'Generative: connects nearby points with sketchy hairlines.',
    buffered: false,
    noHardness: true,
    defaults: { size: 60, opacity: 0.6, spacing: 0.06, smoothing: 0.2, density: 0.5, lineWidth: 1, pressureSize: false },
    options: [
      { key: 'density', label: 'Web density', type: 'range', min: 0.05, max: 1, step: 0.01, format: 'pct' },
      { key: 'lineWidth', label: 'Line width', type: 'range', min: 0.3, max: 4, step: 0.1, format: 'px' },
    ],

    begin(s) {
      s.state.points = [];
      s.state.prev = null;
    },

    dab(s, p) {
      const st = s.settings;
      const S = s.state;
      const reach = p.radius * 2; // "size" acts as the neighbour reach
      const reach2 = reach * reach;
      const lines = [];
      if (S.prev) lines.push([S.prev.x, S.prev.y, p.x, p.y, 1]);
      const pts = S.points;
      const start = Math.max(0, pts.length - 800);
      for (let i = start; i < pts.length; i++) {
        const q = pts[i];
        const dx = q.x - p.x, dy = q.y - p.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < reach2 && s.rng() < st.density * (1 - d2 / reach2)) {
          lines.push([p.x + dx * 0.25, p.y + dy * 0.25, q.x - dx * 0.25, q.y - dy * 0.25, 0.22]);
        }
      }
      pts.push({ x: p.x, y: p.y });
      S.prev = { x: p.x, y: p.y };
      if (!lines.length) return;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const l of lines) {
        x0 = Math.min(x0, l[0], l[2]);
        y0 = Math.min(y0, l[1], l[3]);
        x1 = Math.max(x1, l[0], l[2]);
        y1 = Math.max(y1, l[1], l[3]);
      }
      const pad = st.lineWidth + 2;
      s.paint({ x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2 }, (ctx) => {
        ctx.strokeStyle = Color.rgba(s.rgb, 1);
        ctx.lineWidth = st.lineWidth;
        ctx.lineCap = 'round';
        for (const l of lines) {
          ctx.globalAlpha = p.alpha * l[4];
          ctx.beginPath();
          ctx.moveTo(l[0], l[1]);
          ctx.lineTo(l[2], l[3]);
          ctx.stroke();
        }
      });
    },
  });
})(window.App2);
