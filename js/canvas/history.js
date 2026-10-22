/**
 * Undo / redo.
 *
 * Pixel edits are recorded as *per-tile snapshot diffs*:
 *   1. `history.begin(layer)` attaches a TileRecorder to the layer.
 *   2. Before a tile is first modified, the recorder copies it (or notes that
 *      it did not exist) and accumulates the dirty rectangle inside the tile.
 *   3. `history.end(label)` crops "before" and "after" ImageData to each
 *      tile's dirty rectangle and stores only that — so a small dab on a huge
 *      canvas costs a few KB, not megabytes.
 *
 * The stack is bounded both by entry count and by total bytes; the oldest
 * entries are dropped first.
 *
 * Non-pixel operations (layer add/delete/reorder/props) are pushed as generic
 * entries created with History.action(label, undoFn, redoFn, bytes).
 */
(function (App2) {
  'use strict';

  const TiledLayer = App2.canvas.TiledLayer;
  const TILE = App2.canvas.TILE;
  const M = App2.core.math;

  function allTransparent(data) {
    for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) return false;
    return true;
  }

  /** Captures pre-modification tile state while a change is in progress. */
  class TileRecorder {
    constructor() {
      this.records = new Map();
      this.layers = new Set();
    }

    attach(layer) {
      layer.recorder = this;
      this.layers.add(layer);
    }

    detach() {
      for (const l of this.layers) if (l.recorder === this) l.recorder = null;
      this.layers.clear();
    }

    /** Called by TiledLayer.paint() before modifying tile (tx, ty). */
    capture(layer, tx, ty, dirty) {
      const k = layer.id + '|' + tx + ',' + ty;
      let rec = this.records.get(k);
      if (!rec) {
        const tile = layer.getTile(tx, ty);
        let before = null;
        if (tile) {
          before = TiledLayer.createTileCanvas();
          before.getContext('2d').drawImage(tile, 0, 0);
        }
        rec = { layer, tx, ty, before, dirty: null };
        this.records.set(k, rec);
      }
      const clipped = M.rectIntersect(dirty, { x: 0, y: 0, w: TILE, h: TILE });
      if (clipped) rec.dirty = M.rectUnion(rec.dirty, clipped);
    }
  }

  /** A recorded pixel change: list of cropped before/after tile regions. */
  class TileEntry {
    constructor(label, changes, bytes) {
      this.label = label;
      this.changes = changes;
      this.bytes = bytes;
    }
    _apply(which) {
      for (const c of this.changes) {
        const data = which === 'before' ? c.before : c.after;
        if (!data) {
          c.layer.deleteTile(c.tx, c.ty);
        } else {
          const tile = c.layer.ensureTile(c.tx, c.ty);
          tile.getContext('2d').putImageData(data, c.rect.x, c.rect.y);
          c.layer.version++;
        }
      }
    }
    undo() {
      this._apply('before');
    }
    redo() {
      this._apply('after');
    }
  }

  class History {
    constructor(opts) {
      opts = opts || {};
      this.undoStack = [];
      this.redoStack = [];
      this.bytes = 0;
      this.maxBytes = opts.maxBytes || 192 * 1024 * 1024;
      this.maxEntries = opts.maxEntries || 100;
      this.recorder = null;
      this.onChange = opts.onChange || function () {};
      this.onApply = opts.onApply || function () {};
    }

    /** A generic undoable action. */
    static action(label, undo, redo, bytes) {
      return { label, undo, redo, bytes: bytes || 0 };
    }

    /** Combine several entries into one undo step. */
    static group(label, entries) {
      const list = entries.filter(Boolean);
      return {
        label,
        bytes: list.reduce((s, e) => s + (e.bytes || 0), 0),
        undo() {
          for (let i = list.length - 1; i >= 0; i--) list[i].undo();
        },
        redo() {
          for (const e of list) e.redo();
        },
      };
    }

    get busy() {
      return !!this.recorder;
    }
    get canUndo() {
      return this.undoStack.length > 0 && !this.recorder;
    }
    get canRedo() {
      return this.redoStack.length > 0 && !this.recorder;
    }

    /** Start recording pixel changes on one or more layers. */
    begin(layers) {
      if (this.recorder) this.abort();
      const r = new TileRecorder();
      [].concat(layers).forEach((l) => r.attach(l));
      this.recorder = r;
      return r;
    }

    /**
     * Finish recording. Returns the entry (or null if nothing changed).
     * opts.push === false returns the entry without pushing it.
     */
    end(label, opts) {
      const r = this.recorder;
      if (!r) return null;
      this.recorder = null;
      r.detach();
      const changes = [];
      let bytes = 0;
      for (const rec of r.records.values()) {
        if (!rec.dirty) continue;
        const d = M.rectIntersect(M.rectRoundOut(rec.dirty), { x: 0, y: 0, w: TILE, h: TILE });
        if (!d) continue;
        const tile = rec.layer.getTile(rec.tx, rec.ty);
        let after = null;
        if (tile) {
          after = tile.getContext('2d').getImageData(d.x, d.y, d.w, d.h);
          // Drop tiles that became completely empty (keeps memory bounded).
          if (allTransparent(after.data) && TiledLayer.isTileEmpty(tile)) {
            rec.layer.deleteTile(rec.tx, rec.ty);
            after = null;
          }
        }
        const before = rec.before ? rec.before.getContext('2d').getImageData(d.x, d.y, d.w, d.h) : null;
        if (!before && !after) continue;
        changes.push({ layer: rec.layer, tx: rec.tx, ty: rec.ty, rect: d, before, after });
        bytes += (before ? before.data.length : 0) + (after ? after.data.length : 0) + 96;
      }
      r.records.clear();
      if (!changes.length) {
        this.onChange();
        return null;
      }
      const entry = new TileEntry(label || 'Edit', changes, bytes);
      if (!opts || opts.push !== false) this.push(entry);
      return entry;
    }

    /** Cancel the in-progress recording and restore every touched tile. */
    abort() {
      const r = this.recorder;
      if (!r) return;
      this.recorder = null;
      r.detach();
      for (const rec of r.records.values()) {
        if (!rec.before) {
          rec.layer.deleteTile(rec.tx, rec.ty);
        } else {
          const tile = rec.layer.ensureTile(rec.tx, rec.ty);
          const ctx = tile.getContext('2d');
          ctx.clearRect(0, 0, TILE, TILE);
          ctx.drawImage(rec.before, 0, 0);
          rec.layer.version++;
        }
      }
      r.records.clear();
      this.onChange();
    }

    push(entry) {
      if (!entry) return;
      this.undoStack.push(entry);
      this.bytes += entry.bytes || 0;
      for (const e of this.redoStack) this.bytes -= e.bytes || 0;
      this.redoStack = [];
      this._trim();
      this.onChange();
    }

    _trim() {
      while ((this.bytes > this.maxBytes || this.undoStack.length > this.maxEntries) && this.undoStack.length > 1) {
        const e = this.undoStack.shift();
        this.bytes -= e.bytes || 0;
      }
    }

    undo() {
      if (!this.canUndo) return null;
      const e = this.undoStack.pop();
      e.undo();
      this.redoStack.push(e);
      this.onApply(e, 'undo');
      this.onChange();
      return e;
    }

    redo() {
      if (!this.canRedo) return null;
      const e = this.redoStack.pop();
      e.redo();
      this.undoStack.push(e);
      this.onApply(e, 'redo');
      this.onChange();
      return e;
    }

    clear() {
      if (this.recorder) {
        this.recorder.detach();
        this.recorder = null;
      }
      this.undoStack = [];
      this.redoStack = [];
      this.bytes = 0;
      this.onChange();
    }
  }

  App2.canvas.History = History;
  App2.canvas.TileRecorder = TileRecorder;
})(window.App2);
