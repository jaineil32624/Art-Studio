/**
 * Renderer — draws the visible part of the document onto the on-screen
 * canvas, then overlays (pixel grid, symmetry guides, selection, tool
 * previews, brush cursor). Rendering is batched with requestAnimationFrame.
 *
 * "Live" stroke buffers: buffered brushes (brush, marker, eraser, …) paint
 * into a temporary TiledLayer; while the stroke is in progress the renderer
 * composites [layer + buffer] into a scratch canvas so blend modes and the
 * layer opacity are previewed exactly as they will be committed.
 */
(function (App2) {
  'use strict';

  const TILE = App2.canvas.TILE;
  const Symmetry = App2.canvas.Symmetry;

  class Renderer {
    constructor(app, canvas) {
      this.app = app;
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.scratch = document.createElement('canvas');
      this.sctx = this.scratch.getContext('2d');
      this.dpr = 1;
      /** { layer, buffer, alpha, composite } while a buffered stroke is active. */
      this.live = null;
      /** Last hover position in screen px, or null when the pointer left. */
      this.hover = null;
      this._raf = 0;
      this._checker = null;
      this._antsOffset = 0;
    }

    resize() {
      const parent = this.canvas.parentElement;
      const r = parent.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      this.dpr = dpr;
      const w = Math.max(1, Math.round(r.width * dpr));
      const h = Math.max(1, Math.round(r.height * dpr));
      if (this.canvas.width !== w || this.canvas.height !== h) {
        this.canvas.width = w;
        this.canvas.height = h;
        this.scratch.width = w;
        this.scratch.height = h;
      }
      this.canvas.style.width = r.width + 'px';
      this.canvas.style.height = r.height + 'px';
      this.app.view.resize(r.width, r.height);
      this.requestRender();
    }

    requestRender() {
      if (this._raf) return;
      this._raf = requestAnimationFrame(() => {
        this._raf = 0;
        this.render();
      });
    }

    /** Make ctx draw in world coordinates (for tool previews). */
    applyWorldTransform(ctx) {
      const v = this.app.view, k = this.dpr * v.zoom;
      ctx.setTransform(k, 0, 0, k, -v.x * k, -v.y * k);
    }
    /** Make ctx draw in screen CSS pixels. */
    applyScreenTransform(ctx) {
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }

    _checkerPattern(ctx) {
      if (!this._checker) {
        const c = document.createElement('canvas');
        c.width = c.height = 16;
        const g = c.getContext('2d');
        g.fillStyle = '#d9dbe1';
        g.fillRect(0, 0, 16, 16);
        g.fillStyle = '#f4f5f8';
        g.fillRect(0, 0, 8, 8);
        g.fillRect(8, 8, 8, 8);
        this._checker = c;
      }
      return ctx.createPattern(this._checker, 'repeat');
    }

    /** Draw the tiles of `layer` intersecting the view, in device pixels. */
    _drawTiles(ctx, layer, vis, view) {
      const k = view.zoom * this.dpr;
      const tx0 = Math.floor(vis.x / TILE), ty0 = Math.floor(vis.y / TILE);
      const tx1 = Math.floor((vis.x + vis.w) / TILE), ty1 = Math.floor((vis.y + vis.h) / TILE);
      const draw = (tile, tx, ty) => {
        // Round both edges so neighbouring tiles share an edge (no seams).
        const x0 = Math.round((tx * TILE - view.x) * k), x1 = Math.round(((tx + 1) * TILE - view.x) * k);
        const y0 = Math.round((ty * TILE - view.y) * k), y1 = Math.round(((ty + 1) * TILE - view.y) * k);
        ctx.drawImage(tile, x0, y0, x1 - x0, y1 - y0);
      };
      const range = (tx1 - tx0 + 1) * (ty1 - ty0 + 1);
      if (layer.tiles.size < range) {
        layer.forEachTile((tile, tx, ty) => {
          if (tx >= tx0 && tx <= tx1 && ty >= ty0 && ty <= ty1) draw(tile, tx, ty);
        });
      } else {
        for (let ty = ty0; ty <= ty1; ty++)
          for (let tx = tx0; tx <= tx1; tx++) {
            const t = layer.getTile(tx, ty);
            if (t) draw(t, tx, ty);
          }
      }
    }

    render() {
      const app = this.app;
      const { doc, view, state } = app;
      const ctx = this.ctx;
      const W = this.canvas.width, H = this.canvas.height;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      if (doc.background) {
        ctx.fillStyle = doc.background;
      } else {
        ctx.fillStyle = this._checkerPattern(ctx);
      }
      ctx.fillRect(0, 0, W, H);

      // Nearest-neighbour when zoomed in (crisp pixels) or in pixel-art mode.
      const smooth = !(state.pixel.enabled || view.zoom >= 2);
      const vis = view.visibleRect();

      for (const layer of doc.layers) {
        if (!layer.visible) continue;
        const live = this.live && this.live.layer === layer ? this.live : null;
        if (live) {
          const s = this.sctx;
          s.setTransform(1, 0, 0, 1, 0, 0);
          s.globalAlpha = 1;
          s.globalCompositeOperation = 'source-over';
          s.clearRect(0, 0, W, H);
          s.imageSmoothingEnabled = smooth;
          this._drawTiles(s, layer, vis, view);
          s.globalAlpha = live.alpha;
          s.globalCompositeOperation = live.composite || 'source-over';
          this._drawTiles(s, live.buffer, vis, view);
          s.globalAlpha = 1;
          s.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = layer.opacity;
          ctx.globalCompositeOperation = layer.blend;
          ctx.drawImage(this.scratch, 0, 0);
        } else {
          ctx.globalAlpha = layer.opacity;
          ctx.globalCompositeOperation = layer.blend;
          ctx.imageSmoothingEnabled = smooth;
          this._drawTiles(ctx, layer, vis, view);
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.imageSmoothingEnabled = true;

      // ---- overlays (screen space, CSS px) ----
      this.applyScreenTransform(ctx);
      if (state.pixel.enabled && state.pixel.grid) this._drawPixelGrid(ctx, view, vis, state.pixel.size);
      if (state.symmetry.mode !== 'off' && state.symmetry.guides) Symmetry.drawGuides(ctx, view, state.symmetry);
      if (state.selection) this._drawSelection(ctx, view, state.selection);

      const tool = app.tools && app.tools.active;
      if (tool) {
        ctx.save();
        try {
          tool.drawOverlay(ctx, view, this);
        } catch (err) {
          console.error(err);
        }
        ctx.restore();
        this.applyScreenTransform(ctx);
        if (this.hover && !(app.input && app.input.panning)) {
          const r = tool.cursorRadius() * view.zoom;
          if (r > 1.5) {
            ctx.lineWidth = 1;
            ctx.strokeStyle = 'rgba(0,0,0,0.65)';
            ctx.beginPath();
            ctx.arc(this.hover.x, this.hover.y, r, 0, Math.PI * 2);
            ctx.stroke();
            ctx.strokeStyle = 'rgba(255,255,255,0.85)';
            ctx.beginPath();
            ctx.arc(this.hover.x, this.hover.y, r + 1, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }
    }

    _drawPixelGrid(ctx, view, vis, size) {
      const step = size * view.zoom;
      if (step < 6) return;
      const x0 = Math.floor(vis.x / size) * size, y0 = Math.floor(vis.y / size) * size;
      ctx.save();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(120,128,140,0.35)';
      ctx.beginPath();
      for (let x = x0; x <= vis.x + vis.w; x += size) {
        const sx = Math.round((x - view.x) * view.zoom) + 0.5;
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, view.height);
      }
      for (let y = y0; y <= vis.y + vis.h; y += size) {
        const sy = Math.round((y - view.y) * view.zoom) + 0.5;
        ctx.moveTo(0, sy);
        ctx.lineTo(view.width, sy);
      }
      ctx.stroke();
      ctx.restore();
    }

    _drawSelection(ctx, view, sel) {
      const a = view.worldToScreen(sel.x, sel.y);
      const w = sel.w * view.zoom, h = sel.h * view.zoom;
      ctx.save();
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#000';
      ctx.strokeRect(Math.round(a.x) + 0.5, Math.round(a.y) + 0.5, Math.round(w), Math.round(h));
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(Math.round(a.x) + 0.5, Math.round(a.y) + 0.5, Math.round(w), Math.round(h));
      ctx.restore();
    }
  }

  App2.canvas.Renderer = Renderer;
})(window.App2);
