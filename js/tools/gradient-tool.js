/**
 * Gradient tool — drag to define a linear or radial gradient using the
 * multi-stop gradient from state.gradient (edited in the tool options panel).
 * The gradient covers the visible area plus existing layer content; with
 * "Clip to layer content" it only recolors existing pixels.
 */
(function (App2) {
  'use strict';

  const { Tool } = App2.tools;
  const { math: M } = App2.core;
  const MAX_SIDE = 8192;

  class GradientTool extends Tool {
    constructor(app, def) {
      super(app, def);
      this.drag = null;
    }

    getOptions() {
      const st = this.app.state;
      return [
        {
          key: 'type',
          label: 'Type',
          type: 'select',
          choices: [['linear', 'Linear'], ['radial', 'Radial']],
          get: () => st.gradient.type,
          set: (v) => st.update('gradient', { type: v }),
        },
        { key: 'opacity', label: 'Opacity', type: 'range', min: 0.01, max: 1, step: 0.01, format: 'pct' },
        { key: 'clip', label: 'Clip to layer content', type: 'toggle' },
      ];
    }

    buildExtraUI(container) {
      if (App2.ui.GradientEditor) new App2.ui.GradientEditor(this.app, container);
    }

    /** Create a CanvasGradient for ctx from a → b. */
    makeGradient(ctx, a, b) {
      const gs = this.app.state.gradient;
      const len = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
      const g = gs.type === 'radial' ? ctx.createRadialGradient(a.x, a.y, 0, a.x, a.y, len) : ctx.createLinearGradient(a.x, a.y, b.x, b.y);
      const stops = gs.stops.slice().sort((p, q) => p.pos - q.pos);
      for (const s of stops) g.addColorStop(M.clamp(s.pos, 0, 1), s.color);
      return g;
    }

    _constrain(e) {
      if (!e.shiftKey || !this.drag) return { x: e.x, y: e.y };
      const a = this.drag.a;
      const ang = M.snapAngle(Math.atan2(e.y - a.y, e.x - a.x), Math.PI / 12);
      const d = Math.hypot(e.x - a.x, e.y - a.y);
      return { x: a.x + Math.cos(ang) * d, y: a.y + Math.sin(ang) * d };
    }

    onPointerDown(e) {
      if (!this.paintableLayer()) return;
      this.drag = { a: { x: e.x, y: e.y }, b: { x: e.x, y: e.y } };
      this.app.renderer.requestRender();
    }

    onPointerMove(e) {
      if (!this.drag) return;
      this.drag.b = this._constrain(e);
      this.app.renderer.requestRender();
    }

    onPointerUp(e) {
      if (!this.drag) return;
      this.drag.b = this._constrain(e);
      const { a, b } = this.drag;
      this.drag = null;
      if (Math.hypot(b.x - a.x, b.y - a.y) * this.app.view.zoom < 3) {
        this.app.renderer.requestRender();
        return;
      }
      this.apply(a, b);
    }

    cancel() {
      this.drag = null;
    }

    apply(a, b) {
      const app = this.app;
      const layer = this.paintableLayer();
      if (!layer) return;
      const clip = !!this.settings.clip;
      // Cover the visible area plus a margin (so small pans don't reveal an
      // edge) and any existing content on the layer.
      const vis = app.view.visibleRect();
      const around = M.rectRoundOut(M.rectInflate(vis, Math.max(vis.w, vis.h) * 0.5));
      let region = clip ? layer.tileBounds() : M.rectUnion(around, layer.tileBounds());
      if (!region) return;
      if (region.w > MAX_SIDE || region.h > MAX_SIDE) {
        const c = app.view.screenToWorld(app.view.width / 2, app.view.height / 2);
        region = M.rectIntersect(region, { x: c.x - MAX_SIDE / 2, y: c.y - MAX_SIDE / 2, w: MAX_SIDE, h: MAX_SIDE });
        if (!region) return;
      }
      const opacity = this.settings.opacity;
      app.history.begin(layer);
      layer.paint(
        region,
        (ctx) => {
          ctx.globalAlpha = opacity;
          if (clip) ctx.globalCompositeOperation = 'source-atop';
          ctx.fillStyle = this.makeGradient(ctx, a, b);
          ctx.fillRect(region.x, region.y, region.w, region.h);
        },
        { noCreate: clip }
      );
      app.history.end('Gradient');
      app.doc.changed();
    }

    drawOverlay(ctx, view, renderer) {
      if (!this.drag) return;
      const { a, b } = this.drag;
      // Live preview of the gradient over the visible area.
      renderer.applyWorldTransform(ctx);
      ctx.globalAlpha = this.settings.opacity * 0.85;
      ctx.fillStyle = this.makeGradient(ctx, a, b);
      const v = view.visibleRect();
      ctx.fillRect(v.x, v.y, v.w, v.h);
      // Handles in screen space.
      renderer.applyScreenTransform(ctx);
      ctx.globalAlpha = 1;
      const sa = view.worldToScreen(a.x, a.y), sb = view.worldToScreen(b.x, b.y);
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath();
      ctx.moveTo(sa.x, sa.y);
      ctx.lineTo(sb.x, sb.y);
      ctx.stroke();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
      for (const p of [sa, sb]) {
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#000';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  App2.tools.register({
    id: 'gradient',
    name: 'Gradient',
    icon: 'gradient',
    shortcut: 'd',
    group: 'fill',
    order: 320,
    description: 'Drag to apply a linear or radial multi-stop gradient. Shift snaps the angle.',
    defaults: { opacity: 1, clip: false },
    create: (app, def) => new GradientTool(app, def),
  });
})(window.App2);
