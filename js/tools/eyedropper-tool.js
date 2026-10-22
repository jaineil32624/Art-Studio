/**
 * Eyedropper — click or drag to pick a color from the canvas.
 * Left button sets the primary color, right button the secondary.
 * (Holding Alt with any painting tool does the same temporarily.)
 */
(function (App2) {
  'use strict';

  const { Tool } = App2.tools;
  const { Color } = App2.core;

  class EyedropperTool extends Tool {
    constructor(app, def) {
      super(app, def);
      this.picking = null;
      this.lastColor = null;
      this.rightButton = true; // right-click picks the secondary color
    }

    getOptions() {
      return [{ key: 'source', label: 'Sample from', type: 'select', choices: [['all', 'All visible layers'], ['layer', 'Active layer only']] }];
    }

    /** Pick the color at a world point. Returns the hex or null (transparent). */
    static pick(app, x, y, which, layerOnly) {
      const layer = layerOnly ? app.doc.activeLayer : null;
      const c = app.doc.sampleColor(x, y, { layer, background: !layerOnly });
      if (c[3] === 0) return null;
      const hex = Color.rgbToHex(c[0], c[1], c[2]);
      app.state.setColor(hex, which);
      return hex;
    }

    _pick(e) {
      const which = this.picking === 2 ? 'secondary' : 'primary';
      this.lastColor = EyedropperTool.pick(this.app, e.x, e.y, which, this.settings.source === 'layer');
      this.lastPos = { sx: e.sx, sy: e.sy };
      this.app.renderer.requestRender();
    }

    onPointerDown(e) {
      this.picking = e.button === 2 ? 2 : 1;
      this._pick(e);
    }
    onPointerMove(e) {
      if (this.picking) this._pick(e);
    }
    onPointerUp() {
      this.picking = null;
      if (this.lastColor) this.app.state.addRecent(this.lastColor);
      this.app.renderer.requestRender();
    }
    cancel() {
      this.picking = null;
    }

    drawOverlay(ctx) {
      if (!this.picking || !this.lastPos) return;
      const { sx, sy } = this.lastPos;
      ctx.lineWidth = 8;
      ctx.strokeStyle = this.lastColor || 'rgba(0,0,0,0)';
      ctx.beginPath();
      ctx.arc(sx, sy, 26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(sx, sy, 31, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.beginPath();
      ctx.arc(sx, sy, 21, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  App2.tools.EyedropperTool = EyedropperTool;
  App2.tools.register({
    id: 'eyedropper',
    name: 'Eyedropper',
    icon: 'eyedropper',
    shortcut: 'i',
    group: 'util',
    order: 410,
    description: 'Pick a color from the canvas (right-click: secondary). Tip: hold Alt while painting.',
    defaults: { source: 'all' },
    create: (app, def) => new EyedropperTool(app, def),
  });
})(window.App2);
