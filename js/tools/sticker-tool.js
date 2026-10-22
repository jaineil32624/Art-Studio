/**
 * Sticker / Place tool — places an image (sticker, generated texture,
 * imported picture) as a floating, transformable object:
 *   drag inside  → move
 *   corner handle → scale (uniform)
 *   top handle   → rotate (Shift snaps to 15°)
 * Enter / "Apply" commits onto the layer, Esc cancels, clicking outside the
 * box commits. Switching tools also commits.
 */
(function (App2) {
  'use strict';

  const { Tool } = App2.tools;
  const { math: M } = App2.core;
  const HANDLE = 9; // screen px

  class StickerTool extends Tool {
    constructor(app, def) {
      super(app, def);
      this.cursor = 'default';
      this.pending = null;
      this.drag = null;
      this.stickerId = 'emoji-star';
    }

    getOptions() {
      const p = () => this.pending;
      const opts = [
        {
          key: 'scale',
          label: 'Scale',
          type: 'range',
          min: 0.05,
          max: 6,
          step: 0.01,
          format: 'pct',
          get: () => (p() ? p().scale : this.settings.scale),
          set: (v) => {
            this.settings.scale = v;
            if (p()) p().scale = v;
            this.app.renderer.requestRender();
          },
        },
        {
          key: 'rotation',
          label: 'Rotation',
          type: 'range',
          min: -180,
          max: 180,
          step: 1,
          format: 'deg',
          get: () => (p() ? Math.round(M.radToDeg(p().rotation)) : 0),
          set: (v) => {
            if (p()) p().rotation = M.degToRad(v);
            this.app.renderer.requestRender();
          },
        },
        {
          key: 'flip',
          label: 'Flip horizontally',
          type: 'toggle',
          get: () => (p() ? p().flip : false),
          set: (v) => {
            if (p()) p().flip = !!v;
            this.app.renderer.requestRender();
          },
        },
        { key: 'opacity', label: 'Opacity', type: 'range', min: 0.05, max: 1, step: 0.01, format: 'pct' },
        { key: 'tint', label: 'Tint vector stickers with primary color', type: 'toggle' },
        { key: 'newLayer', label: 'Place on a new layer', type: 'toggle' },
      ];
      if (this.pending) {
        opts.push({ label: 'Apply (Enter)', type: 'button', primary: true, action: () => this.commit() });
        opts.push({ label: 'Cancel (Esc)', type: 'button', action: () => this.cancelPlacement() });
      }
      return opts;
    }

    buildExtraUI(container) {
      if (!App2.ui.buildStickerGrid) return;
      const title = document.createElement('div');
      title.className = 'subhead';
      title.textContent = 'Stickers — click one, then click the canvas';
      container.appendChild(title);
      App2.ui.buildStickerGrid(this.app, container, { compact: true });
    }

    selectSticker(id) {
      this.stickerId = id;
      this.app.bus.emit('sticker:selected', id);
    }

    /**
     * Start placing an image source (canvas/image) at world (x, y).
     * opts: { name, newLayer, scale }
     */
    place(source, opts) {
      opts = opts || {};
      if (this.pending) this.commit();
      const view = this.app.view;
      const c = opts.x != null ? { x: opts.x, y: opts.y } : view.screenToWorld(view.width / 2, view.height / 2);
      const w = source.width, h = source.height;
      // Default size: ~200 screen px for the longest side.
      const scale = opts.scale || Math.min(4, 200 / view.zoom / Math.max(w, h));
      this.pending = {
        src: source,
        w,
        h,
        x: c.x,
        y: c.y,
        scale,
        rotation: 0,
        flip: false,
        name: opts.name || 'Sticker',
        newLayer: opts.newLayer != null ? opts.newLayer : !!this.settings.newLayer,
      };
      this.app.bus.emit('tool:setting', { tool: this, key: 'pending', source: 'code' });
      this.app.renderer.requestRender();
    }

    /** Matrix mapping image-local coords (centered) to world. */
    _matrix(p) {
      let m = M.matTranslate(p.x, p.y);
      m = M.matMultiply(m, M.matRotate(p.rotation));
      m = M.matMultiply(m, M.matScale(p.scale * (p.flip ? -1 : 1), p.scale));
      return m;
    }

    _corners(p) {
      const m = this._matrix(p);
      const hw = p.w / 2, hh = p.h / 2;
      return [M.matApply(m, -hw, -hh), M.matApply(m, hw, -hh), M.matApply(m, hw, hh), M.matApply(m, -hw, hh)];
    }

    _screenHandles(p) {
      const v = this.app.view;
      const cs = this._corners(p).map((c) => v.worldToScreen(c.x, c.y));
      const topMid = { x: (cs[0].x + cs[1].x) / 2, y: (cs[0].y + cs[1].y) / 2 };
      const center = v.worldToScreen(p.x, p.y);
      const dx = topMid.x - center.x, dy = topMid.y - center.y;
      const len = Math.hypot(dx, dy) || 1;
      const rot = { x: topMid.x + (dx / len) * 28, y: topMid.y + (dy / len) * 28 };
      return { corners: cs, topMid, rot, center };
    }

    _hit(e) {
      const p = this.pending;
      if (!p) return null;
      const h = this._screenHandles(p);
      if (Math.hypot(e.sx - h.rot.x, e.sy - h.rot.y) <= HANDLE + 4) return 'rotate';
      for (const c of h.corners) if (Math.hypot(e.sx - c.x, e.sy - c.y) <= HANDLE + 4) return 'scale';
      // Inside test in image-local space.
      const m = this._matrix(p);
      const det = m[0] * m[3] - m[1] * m[2];
      const dx = e.x - m[4], dy = e.y - m[5];
      const lx = (m[3] * dx - m[2] * dy) / det, ly = (-m[1] * dx + m[0] * dy) / det;
      if (Math.abs(lx) <= p.w / 2 && Math.abs(ly) <= p.h / 2) return 'move';
      return null;
    }

    onPointerDown(e) {
      const p = this.pending;
      if (p) {
        const hit = this._hit(e);
        if (!hit) {
          this.commit();
          return;
        }
        this.drag = {
          mode: hit,
          start: { x: e.x, y: e.y },
          orig: { x: p.x, y: p.y, scale: p.scale, rotation: p.rotation },
          startDist: Math.max(1e-3, Math.hypot(e.x - p.x, e.y - p.y)),
          startAng: Math.atan2(e.y - p.y, e.x - p.x),
        };
        return;
      }
      // Nothing pending: drop the selected sticker here.
      const src = App2.creative.stickers.render(this.stickerId, { tint: this.settings.tint ? this.app.state.primary : null });
      if (!src) return;
      this.place(src, { x: e.x, y: e.y, name: App2.creative.stickers.name(this.stickerId) });
    }

    onPointerMove(e) {
      const p = this.pending, d = this.drag;
      if (!p || !d) return;
      if (d.mode === 'move') {
        p.x = d.orig.x + (e.x - d.start.x);
        p.y = d.orig.y + (e.y - d.start.y);
      } else if (d.mode === 'scale') {
        p.scale = M.clamp((d.orig.scale * Math.hypot(e.x - p.x, e.y - p.y)) / d.startDist, 0.02, 40);
      } else if (d.mode === 'rotate') {
        let r = d.orig.rotation + Math.atan2(e.y - p.y, e.x - p.x) - d.startAng;
        if (e.shiftKey) r = M.snapAngle(r, Math.PI / 12);
        p.rotation = r;
      }
      this.app.renderer.requestRender();
    }

    onPointerUp() {
      if (this.drag) {
        this.drag = null;
        this.app.bus.emit('tool:setting', { tool: this, key: 'transform', source: 'code' });
      }
    }

    onHover(e) {
      const hit = this._hit(e);
      const cur = hit === 'move' ? 'move' : hit === 'scale' ? 'nwse-resize' : hit === 'rotate' ? 'grab' : this.pending ? 'default' : 'copy';
      this.app.input.setCursor(cur);
    }

    onKeyDown(e) {
      if (!this.pending) return false;
      if (e.key === 'Enter') {
        this.commit();
        return true;
      }
      if (e.key === 'Escape' || e.key === 'Delete' || e.key === 'Backspace') {
        this.cancelPlacement();
        return true;
      }
      return false;
    }

    cancel() {
      this.drag = null;
    }

    cancelPlacement() {
      this.pending = null;
      this.drag = null;
      this.app.bus.emit('tool:setting', { tool: this, key: 'pending', source: 'code' });
      this.app.renderer.requestRender();
    }

    onDeactivate() {
      if (this.pending) this.commit();
    }

    commit() {
      const p = this.pending;
      if (!p) return;
      this.pending = null;
      this.drag = null;
      const app = this.app;
      const History = App2.canvas.History;
      let addEntry = null;
      let layer;
      if (p.newLayer) {
        const res = app.commands.addLayer({ name: p.name, push: false });
        layer = res.layer;
        addEntry = res.entry;
      } else {
        layer = this.paintableLayer();
        if (!layer) {
          app.bus.emit('tool:setting', { tool: this, key: 'pending', source: 'code' });
          return;
        }
      }
      const m = this._matrix(p);
      const bounds = M.rectInflate(M.rectFromPointList(this._corners(p)), 2);
      const opacity = this.settings.opacity;
      app.history.begin(layer);
      layer.paint(bounds, (ctx) => {
        ctx.globalAlpha = opacity;
        ctx.imageSmoothingQuality = 'high';
        ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
        ctx.drawImage(p.src, -p.w / 2, -p.h / 2);
      });
      const pixels = app.history.end('Place ' + p.name, { push: false });
      if (addEntry || pixels) app.history.push(History.group('Place ' + p.name, [addEntry, pixels]));
      app.bus.emit('tool:setting', { tool: this, key: 'pending', source: 'code' });
      app.doc.changed();
    }

    drawOverlay(ctx, view, renderer) {
      const p = this.pending;
      if (!p) return;
      const m = this._matrix(p);
      renderer.applyWorldTransform(ctx);
      ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
      ctx.globalAlpha = this.settings.opacity;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(p.src, -p.w / 2, -p.h / 2);
      renderer.applyScreenTransform(ctx);
      ctx.globalAlpha = 1;
      const h = this._screenHandles(p);
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#4cc2ff';
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      h.corners.forEach((c, i) => (i ? ctx.lineTo(c.x, c.y) : ctx.moveTo(c.x, c.y)));
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(h.topMid.x, h.topMid.y);
      ctx.lineTo(h.rot.x, h.rot.y);
      ctx.stroke();
      ctx.fillStyle = '#fff';
      for (const c of h.corners) {
        ctx.beginPath();
        ctx.rect(c.x - HANDLE / 2, c.y - HANDLE / 2, HANDLE, HANDLE);
        ctx.fill();
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(h.rot.x, h.rot.y, HANDLE / 2 + 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  App2.tools.StickerTool = StickerTool;
  App2.tools.register({
    id: 'sticker',
    name: 'Stickers & Place',
    icon: 'sticker',
    shortcut: 's',
    group: 'util',
    order: 420,
    description: 'Place stickers or images; move, scale and rotate before applying.',
    defaults: { scale: 1, opacity: 1, tint: false, newLayer: false },
    create: (app, def) => new StickerTool(app, def),
  });
})(window.App2);
