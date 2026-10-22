/**
 * Shape tool — line, rectangle, ellipse, polygon and star, drawn as stroke,
 * fill or both, with a live preview. Modifiers while dragging:
 *   Shift – constrain (square / circle / 15° angles)
 *   Alt   – draw rectangles and ellipses from the center
 * Shapes respect symmetry (each symmetry matrix is applied via ctx.transform).
 */
(function (App2) {
  'use strict';

  const { Tool } = App2.tools;
  const { Symmetry } = App2.canvas;
  const { math: M } = App2.core;

  class ShapeTool extends Tool {
    constructor(app, def) {
      super(app, def);
      this.drag = null;
    }

    getOptions() {
      return [
        {
          key: 'shape',
          label: 'Shape',
          type: 'select',
          choices: [['line', 'Line'], ['rect', 'Rectangle'], ['ellipse', 'Ellipse'], ['polygon', 'Polygon'], ['star', 'Star']],
        },
        { key: 'mode', label: 'Style', type: 'select', choices: [['stroke', 'Stroke'], ['fill', 'Fill'], ['both', 'Fill + stroke (secondary fill)']] },
        { key: 'fillWith', label: 'Fill source', type: 'select', choices: [['color', 'Color'], ['pattern', 'Active pattern']] },
        { key: 'size', label: 'Stroke width', type: 'range', min: 1, max: 100, step: 1, format: 'px' },
        { key: 'opacity', label: 'Opacity', type: 'range', min: 0.01, max: 1, step: 0.01, format: 'pct' },
        { key: 'sides', label: 'Sides / points', type: 'range', min: 3, max: 16, step: 1 },
        { key: 'inner', label: 'Star inner radius', type: 'range', min: 0.1, max: 0.95, step: 0.01, format: 'pct' },
        { key: 'cornerRadius', label: 'Rect corner radius', type: 'range', min: 0, max: 200, step: 1, format: 'px' },
      ];
    }

    /** Shape geometry from the drag (world coords). */
    geometry(a, b, mods) {
      const st = this.settings;
      const shape = st.shape;
      if (shape === 'line') {
        let x2 = b.x, y2 = b.y;
        if (mods.shiftKey) {
          const ang = M.snapAngle(Math.atan2(b.y - a.y, b.x - a.x), Math.PI / 12);
          const d = Math.hypot(b.x - a.x, b.y - a.y);
          x2 = a.x + Math.cos(ang) * d;
          y2 = a.y + Math.sin(ang) * d;
        }
        return { shape, x1: a.x, y1: a.y, x2, y2 };
      }
      if (shape === 'rect' || shape === 'ellipse') {
        let w = b.x - a.x, h = b.y - a.y;
        if (mods.shiftKey) {
          const s = Math.max(Math.abs(w), Math.abs(h));
          w = (w < 0 ? -1 : 1) * s;
          h = (h < 0 ? -1 : 1) * s;
        }
        let x = a.x, y = a.y;
        if (mods.altKey) {
          x = a.x - w;
          y = a.y - h;
          w *= 2;
          h *= 2;
        }
        const r = M.rectFromPoints(x, y, x + w, y + h);
        return { shape, x: r.x, y: r.y, w: r.w, h: r.h };
      }
      // polygon / star: center = a, radius & rotation from b
      let rot = Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2;
      if (mods.shiftKey) rot = M.snapAngle(rot, Math.PI / 12);
      return { shape, cx: a.x, cy: a.y, r: Math.hypot(b.x - a.x, b.y - a.y), rot };
    }

    tracePath(ctx, g) {
      const st = this.settings;
      ctx.beginPath();
      switch (g.shape) {
        case 'line':
          ctx.moveTo(g.x1, g.y1);
          ctx.lineTo(g.x2, g.y2);
          break;
        case 'rect': {
          const r = Math.min(st.cornerRadius || 0, g.w / 2, g.h / 2);
          if (r > 0) {
            ctx.moveTo(g.x + r, g.y);
            ctx.arcTo(g.x + g.w, g.y, g.x + g.w, g.y + g.h, r);
            ctx.arcTo(g.x + g.w, g.y + g.h, g.x, g.y + g.h, r);
            ctx.arcTo(g.x, g.y + g.h, g.x, g.y, r);
            ctx.arcTo(g.x, g.y, g.x + g.w, g.y, r);
            ctx.closePath();
          } else ctx.rect(g.x, g.y, g.w, g.h);
          break;
        }
        case 'ellipse':
          ctx.ellipse(g.x + g.w / 2, g.y + g.h / 2, Math.max(0.1, g.w / 2), Math.max(0.1, g.h / 2), 0, 0, Math.PI * 2);
          break;
        case 'polygon':
        case 'star': {
          const n = Math.max(3, st.sides | 0);
          const star = g.shape === 'star';
          const count = star ? n * 2 : n;
          for (let i = 0; i < count; i++) {
            const rr = star && i % 2 ? g.r * st.inner : g.r;
            const ang = g.rot - Math.PI / 2 + (i * Math.PI * 2) / count;
            const x = g.cx + Math.cos(ang) * rr, y = g.cy + Math.sin(ang) * rr;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          break;
        }
      }
    }

    bounds(g) {
      const pad = this.settings.size + 2;
      let r;
      if (g.shape === 'line') r = M.rectFromPoints(g.x1, g.y1, g.x2, g.y2);
      else if (g.shape === 'rect' || g.shape === 'ellipse') r = { x: g.x, y: g.y, w: g.w, h: g.h };
      else r = { x: g.cx - g.r, y: g.cy - g.r, w: g.r * 2, h: g.r * 2 };
      // Miter joins on sharp star points can extend past the stroke width.
      return M.rectInflate(r, pad * (g.shape === 'star' ? 3 : 1));
    }

    draw(ctx, g) {
      const st = this.settings;
      const state = this.app.state;
      ctx.lineJoin = g.shape === 'star' || g.shape === 'polygon' ? 'miter' : 'round';
      ctx.lineCap = 'round';
      this.tracePath(ctx, g);
      const isLine = g.shape === 'line';
      const doFill = !isLine && (st.mode === 'fill' || st.mode === 'both');
      const doStroke = isLine || st.mode === 'stroke' || st.mode === 'both';
      if (doFill) {
        let fill = st.mode === 'both' ? state.secondary : state.primary;
        if (st.fillWith === 'pattern') {
          const tile = App2.creative.patterns.activeTile();
          if (tile) fill = ctx.createPattern(tile, 'repeat');
        }
        ctx.fillStyle = fill;
        ctx.fill();
      }
      if (doStroke) {
        ctx.lineWidth = st.size;
        ctx.strokeStyle = state.primary;
        ctx.stroke();
      }
    }

    onPointerDown(e) {
      if (!this.paintableLayer()) return;
      this.drag = { a: { x: e.x, y: e.y }, b: { x: e.x, y: e.y }, mods: e };
      this.app.renderer.requestRender();
    }

    onPointerMove(e) {
      if (!this.drag) return;
      this.drag.b = { x: e.x, y: e.y };
      this.drag.mods = e;
      this.app.renderer.requestRender();
    }

    onPointerUp(e) {
      if (!this.drag) return;
      this.drag.b = { x: e.x, y: e.y };
      const g = this.geometry(this.drag.a, this.drag.b, e);
      this.drag = null;
      const tooSmall = g.shape === 'line' ? Math.hypot(g.x2 - g.x1, g.y2 - g.y1) < 1 : g.shape === 'rect' || g.shape === 'ellipse' ? g.w < 1 && g.h < 1 : g.r < 1;
      if (tooSmall) {
        this.app.renderer.requestRender();
        return;
      }
      this.commit(g);
    }

    cancel() {
      this.drag = null;
    }

    commit(g) {
      const app = this.app;
      const layer = this.paintableLayer();
      if (!layer) return;
      const opacity = this.settings.opacity;
      const bounds = this.bounds(g);
      app.history.begin(layer);
      for (const m of Symmetry.matrices(app.state.symmetry)) {
        layer.paint(M.matTransformRect(m, bounds), (ctx) => {
          ctx.globalAlpha = opacity;
          ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
          this.draw(ctx, g);
        });
      }
      app.history.end('Shape');
      app.state.addRecent(app.state.primary);
      app.doc.changed();
    }

    drawOverlay(ctx, view, renderer) {
      if (!this.drag) return;
      const g = this.geometry(this.drag.a, this.drag.b, this.drag.mods);
      for (const m of Symmetry.matrices(this.app.state.symmetry)) {
        renderer.applyWorldTransform(ctx);
        ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
        ctx.globalAlpha = this.settings.opacity;
        this.draw(ctx, g);
      }
    }
  }

  App2.tools.register({
    id: 'shape',
    name: 'Shapes',
    icon: 'shapes',
    shortcut: 'u',
    group: 'fill',
    order: 330,
    description: 'Line, rectangle, ellipse, polygon and star. Shift constrains, Alt draws from center.',
    defaults: { shape: 'rect', mode: 'stroke', fillWith: 'color', size: 4, opacity: 1, sides: 5, inner: 0.45, cornerRadius: 0 },
    create: (app, def) => new ShapeTool(app, def),
  });
})(window.App2);
