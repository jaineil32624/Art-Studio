/**
 * Commands — undoable document operations (layer management etc.).
 * UI code calls these instead of mutating the document directly so that
 * everything ends up on the history stack.
 */
(function (App2) {
  'use strict';

  const History = App2.canvas.History;
  const TILE = App2.canvas.TILE;

  class Commands {
    constructor(app) {
      this.app = app;
    }

    get doc() {
      return this.app.doc;
    }
    get history() {
      return this.app.history;
    }

    /**
     * Add a layer (new or provided) above the active layer.
     * opts: { name, layer, index, push }
     * Returns { layer, entry }.
     */
    addLayer(opts) {
      opts = opts || {};
      const doc = this.doc;
      const layer = opts.layer || doc.createLayer(opts.name);
      const index = opts.index != null ? opts.index : doc.activeIndex + 1;
      const prevActive = doc.activeId;
      doc.insertLayer(layer, index);
      doc.setActive(layer.id);
      doc.changed();
      const entry = History.action(
        'Add layer',
        () => {
          doc.removeLayer(layer);
          doc.setActive(prevActive);
        },
        () => {
          doc.insertLayer(layer, index);
          doc.setActive(layer.id);
        },
        layer.byteSize
      );
      if (opts.push !== false) this.history.push(entry);
      return { layer, entry };
    }

    deleteLayer(layer) {
      const doc = this.doc;
      layer = layer || doc.activeLayer;
      if (!layer) return;
      if (doc.layers.length <= 1) {
        this.app.toast('A document needs at least one layer — use "Clear layer" instead.', 'warn');
        return;
      }
      const index = doc.indexOf(layer);
      doc.removeLayer(layer);
      this.history.push(
        History.action(
          'Delete layer',
          () => {
            doc.insertLayer(layer, index);
            doc.setActive(layer.id);
          },
          () => doc.removeLayer(layer),
          layer.byteSize
        )
      );
    }

    duplicateLayer(layer) {
      layer = layer || this.doc.activeLayer;
      if (!layer) return;
      const copy = layer.clone(layer.name + ' copy');
      this.addLayer({ layer: copy, index: this.doc.indexOf(layer) + 1 });
    }

    moveLayer(layer, newIndex) {
      const doc = this.doc;
      const from = doc.indexOf(layer);
      if (from < 0) return;
      const to = Math.max(0, Math.min(doc.layers.length - 1, newIndex));
      if (from === to) return;
      doc.moveLayer(layer, to);
      this.history.push(
        History.action(
          'Reorder layer',
          () => doc.moveLayer(layer, from),
          () => doc.moveLayer(layer, to)
        )
      );
    }

    /** Merge the given layer into the one below it. */
    mergeDown(layer) {
      const doc = this.doc;
      layer = layer || doc.activeLayer;
      const i = doc.indexOf(layer);
      if (i <= 0) {
        this.app.toast('There is no layer below to merge into.', 'warn');
        return;
      }
      const below = doc.layers[i - 1];
      this.history.begin(below);
      if (layer.visible) layer.drawOnto(below, layer.opacity, layer.blend === 'source-over' ? 'source-over' : layer.blend);
      const pixels = this.history.end('Merge down', { push: false });
      doc.removeLayer(layer);
      doc.setActive(below.id);
      const structural = History.action(
        'Merge down',
        () => {
          doc.insertLayer(layer, i);
          doc.setActive(layer.id);
        },
        () => {
          doc.removeLayer(layer);
          doc.setActive(below.id);
        },
        layer.byteSize
      );
      this.history.push(History.group('Merge down', [pixels, structural]));
      doc.changed();
    }

    clearLayer(layer) {
      layer = layer || this.doc.activeLayer;
      if (!layer || layer.isEmpty) return;
      this.history.begin(layer);
      layer.forEachTile((tile, tx, ty) => {
        const r = { x: tx * TILE, y: ty * TILE, w: TILE, h: TILE };
        layer.paint(r, (ctx) => ctx.clearRect(r.x, r.y, r.w, r.h), { noCreate: true });
      });
      this.history.end('Clear layer');
      this.doc.changed();
    }

    /** Clear a world rectangle on the active layer (e.g. the selection). */
    clearRect(rect, layer) {
      layer = layer || this.doc.activeLayer;
      if (!layer || !rect) return;
      this.history.begin(layer);
      layer.clearRect(rect);
      this.history.end('Clear selection');
      this.doc.changed();
    }

    /** Change a layer property (name, opacity, blend, visible) undoably. */
    setLayerProp(layer, prop, value, oldValue) {
      const doc = this.doc;
      const old = oldValue !== undefined ? oldValue : layer[prop];
      layer[prop] = value;
      doc.layersChanged();
      doc.changed();
      if (old === value) return;
      const labels = { name: 'Rename layer', opacity: 'Layer opacity', blend: 'Blend mode', visible: 'Layer visibility' };
      this.history.push(
        History.action(
          labels[prop] || 'Layer property',
          () => {
            layer[prop] = old;
          },
          () => {
            layer[prop] = value;
          }
        )
      );
    }
  }

  App2.canvas.Commands = Commands;
})(window.App2);
