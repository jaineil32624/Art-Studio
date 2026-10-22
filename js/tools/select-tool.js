/**
 * Rectangle select — drag to select a world rectangle (snapped to whole
 * pixels, or to the pixel grid in pixel mode). The selection is used to
 * create pattern tiles, copy to a new layer, or clear an area. A click
 * without dragging deselects.
 */
(function (App2) {
  'use strict';

  const { Tool } = App2.tools;
  const { math: M } = App2.core;

  class SelectTool extends Tool {
    constructor(app, def) {
      super(app, def);
      this.drag = null;
    }

    getOptions() {
      const app = this.app;
      const has = () => !!app.state.selection;
      return [
        { label: 'Make pattern from selection', type: 'button', primary: true, disabled: !has(), action: () => App2.creative.patterns.fromSelection(app) },
        { label: 'Copy to new layer', type: 'button', disabled: !has(), action: () => this.copyToNewLayer() },
        { label: 'Clear selected area (Del)', type: 'button', disabled: !has(), action: () => app.commands.clearRect(app.state.selection) },
        { label: 'Deselect (Esc)', type: 'button', disabled: !has(), action: () => this.deselect() },
      ];
    }

    _snap(v) {
      const px = this.app.state.pixel;
      const s = px.enabled ? px.size : 1;
      return Math.round(v / s) * s;
    }

    onPointerDown(e) {
      this.drag = { ax: this._snap(e.x), ay: this._snap(e.y), moved: false };
    }

    onPointerMove(e) {
      if (!this.drag) return;
      const bx = this._snap(e.x), by = this._snap(e.y);
      const r = M.rectFromPoints(this.drag.ax, this.drag.ay, bx, by);
      if (r.w > 0 && r.h > 0) {
        this.drag.moved = true;
        this.app.state.selection = r;
        this.app.renderer.requestRender();
      }
    }

    onPointerUp() {
      if (!this.drag) return;
      const moved = this.drag.moved;
      this.drag = null;
      if (!moved) this.app.state.selection = null;
      this.app.state.update('selection', this.app.state.selection);
      this.app.renderer.requestRender();
    }

    onKeyDown(e) {
      if (!this.app.state.selection) return false;
      if (e.key === 'Escape') {
        this.deselect();
        return true;
      }
      return false;
    }

    deselect() {
      this.app.state.update('selection', null);
      this.app.renderer.requestRender();
    }

    copyToNewLayer() {
      const app = this.app;
      const sel = app.state.selection;
      const src = app.doc.activeLayer;
      if (!sel || !src) return;
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(sel.w));
      c.height = Math.max(1, Math.round(sel.h));
      src.renderRegion(c.getContext('2d'), sel, 1);
      const { layer, entry } = app.commands.addLayer({ name: src.name + ' (selection)', push: false });
      app.history.begin(layer);
      layer.paint(sel, (ctx) => ctx.drawImage(c, sel.x, sel.y));
      const pixels = app.history.end('Copy selection', { push: false });
      app.history.push(App2.canvas.History.group('Copy selection to layer', [entry, pixels]));
      app.doc.changed();
      app.toast('Selection copied to a new layer.');
    }
  }

  App2.tools.register({
    id: 'select',
    name: 'Select',
    icon: 'select',
    shortcut: 'r',
    group: 'nav',
    order: 2,
    description: 'Rectangle selection — make patterns, copy or clear areas.',
    create: (app, def) => new SelectTool(app, def),
  });
})(window.App2);
