/**
 * ArtDocument — the ordered stack of layers (index 0 = bottom) plus
 * document-level properties such as the paper/background color.
 *
 * The document only manages structure; undoable operations live in
 * actions.js (Commands), which call into these primitives.
 */
(function (App2) {
  'use strict';

  const TiledLayer = App2.canvas.TiledLayer;
  const M = App2.core.math;

  const BLEND_MODES = [
    ['source-over', 'Normal'],
    ['multiply', 'Multiply'],
    ['screen', 'Screen'],
    ['overlay', 'Overlay'],
    ['darken', 'Darken'],
    ['lighten', 'Lighten'],
    ['color-dodge', 'Color Dodge'],
    ['color-burn', 'Color Burn'],
    ['hard-light', 'Hard Light'],
    ['soft-light', 'Soft Light'],
    ['difference', 'Difference'],
    ['exclusion', 'Exclusion'],
    ['hue', 'Hue'],
    ['saturation', 'Saturation'],
    ['color', 'Color'],
    ['luminosity', 'Luminosity'],
  ];

  class ArtDocument {
    constructor(bus) {
      this.bus = bus;
      this.layers = [];
      this.activeId = null;
      this.name = 'Untitled';
      /** Paper color, or null for a transparent (checkerboard) background. */
      this.background = '#ffffff';
      this.created = new Date().toISOString();
      this._layerCounter = 0;
      this._sampleCanvas = null;
    }

    static get BLEND_MODES() {
      return BLEND_MODES;
    }

    get activeLayer() {
      return this.getLayer(this.activeId) || this.layers[this.layers.length - 1] || null;
    }
    get activeIndex() {
      return this.layers.indexOf(this.activeLayer);
    }

    createLayer(name) {
      this._layerCounter++;
      return new TiledLayer({ name: name || 'Layer ' + this._layerCounter });
    }

    getLayer(id) {
      return this.layers.find((l) => l.id === id) || null;
    }
    indexOf(layer) {
      return this.layers.indexOf(layer);
    }

    insertLayer(layer, index) {
      const i = index == null ? this.layers.length : M.clamp(index, 0, this.layers.length);
      this.layers.splice(i, 0, layer);
      this.layersChanged();
      return i;
    }

    removeLayer(layer) {
      const i = this.layers.indexOf(layer);
      if (i < 0) return -1;
      this.layers.splice(i, 1);
      if (this.activeId === layer.id) {
        const next = this.layers[Math.min(i, this.layers.length - 1)] || this.layers[i - 1];
        this.activeId = next ? next.id : null;
      }
      this.layersChanged();
      this.changed();
      return i;
    }

    moveLayer(layer, newIndex) {
      const i = this.layers.indexOf(layer);
      if (i < 0) return;
      const j = M.clamp(newIndex, 0, this.layers.length - 1);
      if (i === j) return;
      this.layers.splice(i, 1);
      this.layers.splice(j, 0, layer);
      this.layersChanged();
      this.changed();
    }

    setActive(id) {
      if (this.activeId === id) return;
      this.activeId = id;
      this.layersChanged();
    }

    /** Replace all layers (used when loading a project). */
    replaceLayers(layers, activeIndex) {
      this.layers = layers.slice();
      this._layerCounter = layers.length;
      const a = this.layers[M.clamp(activeIndex == null ? layers.length - 1 : activeIndex, 0, layers.length - 1)];
      this.activeId = a ? a.id : null;
      this.layersChanged();
      this.changed();
    }

    setBackground(color) {
      this.background = color;
      this.changed();
      this.bus.emit('background:changed', color);
    }

    layersChanged() {
      this.bus.emit('layers:changed');
    }
    changed() {
      this.bus.emit('doc:changed');
    }

    /**
     * Composite visible layers of world `rect` onto ctx at (0,0) with `scale`.
     * opts.background – color to fill first (or null)
     * opts.layers     – subset of layers to draw (default: all)
     * opts.ignoreLayerProps – draw at full opacity / normal blend
     */
    composite(ctx, rect, opts) {
      opts = opts || {};
      const scale = opts.scale || 1;
      ctx.save();
      if (opts.background) {
        ctx.fillStyle = opts.background;
        ctx.fillRect(0, 0, rect.w * scale, rect.h * scale);
      }
      for (const layer of opts.layers || this.layers) {
        if (!layer.visible) continue;
        if (opts.ignoreLayerProps) {
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = 'source-over';
        } else {
          if (layer.opacity <= 0) continue;
          ctx.globalAlpha = layer.opacity;
          ctx.globalCompositeOperation = layer.blend;
        }
        layer.renderRegion(ctx, rect, scale);
      }
      ctx.restore();
    }

    /** Exact bounds of all visible content, or null if the document is empty. */
    contentBounds() {
      let box = null;
      for (const l of this.layers) if (l.visible) box = M.rectUnion(box, l.tightBounds());
      return box;
    }

    /** Coarse (tile-level) bounds of all visible layers. */
    tileBounds() {
      let box = null;
      for (const l of this.layers) if (l.visible) box = M.rectUnion(box, l.tileBounds());
      return box;
    }

    /**
     * Sample the color at a world point. Returns [r,g,b,a] (0..255).
     * opts.layer — sample only this layer; opts.background — include paper.
     */
    sampleColor(x, y, opts) {
      opts = opts || {};
      if (!this._sampleCanvas) {
        this._sampleCanvas = document.createElement('canvas');
        this._sampleCanvas.width = this._sampleCanvas.height = 1;
      }
      const g = this._sampleCanvas.getContext('2d', { willReadFrequently: true });
      g.clearRect(0, 0, 1, 1);
      const rect = { x: Math.floor(x), y: Math.floor(y), w: 1, h: 1 };
      this.composite(g, rect, {
        background: opts.background === false ? null : this.background,
        layers: opts.layer ? [opts.layer] : null,
        ignoreLayerProps: !!opts.layer,
      });
      const d = g.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2], d[3]];
    }

    reset() {
      this.layers = [];
      this.activeId = null;
      this._layerCounter = 0;
      this.name = 'Untitled';
      this.background = '#ffffff';
      this.created = new Date().toISOString();
    }
  }

  App2.canvas.ArtDocument = ArtDocument;
})(window.App2);
