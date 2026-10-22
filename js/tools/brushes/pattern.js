/**
 * Pattern Brush — paints with the active pattern tile (see
 * creative/patterns.js). The pattern is anchored to world coordinates, so
 * separate strokes line up seamlessly. Buffered, so opacity is uniform.
 */
(function (App2) {
  'use strict';

  App2.brushes.register({
    id: 'patternbrush',
    name: 'Pattern Brush',
    icon: 'pattern',
    shortcut: 'q',
    group: 'gen',
    order: 250,
    description: 'Paint with the active pattern (choose one in Creative → Patterns).',
    buffered: true,
    usesColor: false,
    noHardness: true,
    defaults: { size: 48, opacity: 1, spacing: 0.08, patternScale: 1 },
    options: [{ key: 'patternScale', label: 'Pattern scale', type: 'range', min: 0.25, max: 4, step: 0.05 }],

    begin(s) {
      s.state.tile = App2.creative.patterns.activeTile();
      s.state.cache = new WeakMap();
    },

    /** One CanvasPattern per tile context, scaled as requested. */
    _pattern(s, ctx) {
      let pat = s.state.cache.get(ctx);
      if (!pat) {
        pat = ctx.createPattern(s.state.tile, 'repeat');
        const k = s.settings.patternScale || 1;
        if (k !== 1 && pat.setTransform && typeof DOMMatrix !== 'undefined') pat.setTransform(new DOMMatrix([k, 0, 0, k, 0, 0]));
        s.state.cache.set(ctx, pat);
      }
      return pat;
    },

    dab(s, p) {
      if (!s.state.tile) return;
      const engine = this;
      s.paintAt(p.x, p.y, p.radius, (ctx) => {
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = engine._pattern(s, ctx);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      });
    },
  });
})(window.App2);
