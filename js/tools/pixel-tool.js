/**
 * Pixel tool — pixel-art painting snapped to the pixel grid
 * (state.pixel.size world px per art-pixel). Cells are filled with hard
 * rectangles (no anti-aliasing). Right mouse button erases. Activating the
 * tool turns on pixel mode (nearest-neighbour display + grid overlay).
 */
(function (App2) {
  'use strict';

  const { Tool } = App2.tools;
  const { Symmetry } = App2.canvas;
  const { math: M } = App2.core;
  const U = App2.brushes.util;

  class PixelTool extends Tool {
    constructor(app, def) {
      super(app, def);
      this.altPicks = true;
      this.rightButton = true; // right-click erases
      this.stroke = null;
      this.hoverCell = null;
    }

    getOptions() {
      const st = this.app.state;
      return [
        {
          key: 'pixelSize',
          label: 'Pixel size',
          type: 'range',
          min: 1,
          max: 64,
          step: 1,
          format: 'px',
          get: () => st.pixel.size,
          set: (v) => st.update('pixel', { size: v | 0 }),
        },
        { key: 'brush', label: 'Brush (cells)', type: 'range', min: 1, max: 8, step: 1 },
        { key: 'opacity', label: 'Opacity', type: 'range', min: 0.05, max: 1, step: 0.01, format: 'pct' },
        { key: 'mode', label: 'Mode', type: 'select', choices: [['draw', 'Draw'], ['erase', 'Erase']] },
        { key: 'grid', label: 'Show grid', type: 'toggle', get: () => st.pixel.grid, set: (v) => st.update('pixel', { grid: !!v }) },
        {
          key: 'enabled',
          label: 'Pixel mode (crisp display)',
          type: 'toggle',
          get: () => st.pixel.enabled,
          set: (v) => st.update('pixel', { enabled: !!v }),
        },
      ];
    }

    onActivate() {
      if (!this.app.state.pixel.enabled) this.app.state.update('pixel', { enabled: true });
    }

    cursorRadius() {
      return 0;
    }

    _cell(e) {
      const ps = this.app.state.pixel.size;
      return { cx: Math.floor(e.x / ps), cy: Math.floor(e.y / ps) };
    }

    onPointerDown(e) {
      const layer = this.paintableLayer();
      if (!layer) return;
      this.app.history.begin(layer);
      const erase = e.button === 2 || this.settings.mode === 'erase';
      this.stroke = { layer, erase, done: new Set(), last: this._cell(e), mats: Symmetry.matrices(this.app.state.symmetry) };
      this._plot(this.stroke.last.cx, this.stroke.last.cy);
      this.app.renderer.requestRender();
    }

    onPointerMove(e) {
      this.hoverCell = this._cell(e);
      if (!this.stroke) return;
      const c = this.hoverCell;
      const l = this.stroke.last;
      if (c.cx === l.cx && c.cy === l.cy) return;
      U.bresenham(l.cx, l.cy, c.cx, c.cy, (x, y) => this._plot(x, y));
      this.stroke.last = c;
      this.app.renderer.requestRender();
    }

    onHover(e) {
      this.hoverCell = this._cell(e);
      this.app.renderer.requestRender();
    }

    onPointerUp() {
      if (!this.stroke) return;
      const erase = this.stroke.erase;
      this.stroke = null;
      this.app.history.end(erase ? 'Pixel erase' : 'Pixel paint');
      if (!erase) this.app.state.addRecent(this.app.state.primary);
      this.app.doc.changed();
    }

    cancel() {
      if (!this.stroke) return;
      this.stroke = null;
      this.app.history.abort();
      this.app.doc.changed();
    }

    /** Fill (or clear) the brush footprint at cell (cx, cy), mirrored by symmetry. */
    _plot(cx, cy) {
      const s = this.stroke;
      const ps = this.app.state.pixel.size;
      const b = Math.max(1, this.settings.brush | 0);
      const off = Math.floor((b - 1) / 2);
      for (const m of s.mats) {
        // Map the cell center through the symmetry matrix, then re-snap.
        const c = M.matApply(m, (cx + 0.5) * ps, (cy + 0.5) * ps);
        const mx = Math.floor(c.x / ps) - off, my = Math.floor(c.y / ps) - off;
        for (let j = 0; j < b; j++)
          for (let i = 0; i < b; i++) {
            const key = mx + i + ',' + (my + j);
            if (s.done.has(key)) continue;
            s.done.add(key);
            const rect = { x: (mx + i) * ps, y: (my + j) * ps, w: ps, h: ps };
            if (s.erase) {
              s.layer.paint(rect, (ctx) => ctx.clearRect(rect.x, rect.y, rect.w, rect.h), { noCreate: true });
            } else {
              const hex = this.app.state.primary;
              const alpha = this.settings.opacity;
              s.layer.paint(rect, (ctx) => {
                ctx.globalAlpha = alpha;
                ctx.fillStyle = hex;
                ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
              });
            }
          }
      }
    }

    drawOverlay(ctx, view) {
      if (!this.hoverCell || !this.app.renderer.hover) return;
      const ps = this.app.state.pixel.size;
      const b = Math.max(1, this.settings.brush | 0);
      const off = Math.floor((b - 1) / 2);
      const a = view.worldToScreen((this.hoverCell.cx - off) * ps, (this.hoverCell.cy - off) * ps);
      const w = b * ps * view.zoom;
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.strokeRect(Math.round(a.x) + 0.5, Math.round(a.y) + 0.5, Math.round(w), Math.round(w));
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.strokeRect(Math.round(a.x) - 0.5, Math.round(a.y) - 0.5, Math.round(w) + 2, Math.round(w) + 2);
    }
  }

  App2.tools.PixelTool = PixelTool;
  App2.tools.register({
    id: 'pixel',
    name: 'Pixel Art',
    icon: 'pixel',
    shortcut: 'p',
    group: 'paint',
    order: 50,
    description: 'Grid-snapped, aliased pixel painting. Right-click erases.',
    defaults: { brush: 1, opacity: 1, mode: 'draw' },
    create: (app, def) => new PixelTool(app, def),
  });
})(window.App2);
