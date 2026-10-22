/**
 * TiledLayer — an unbounded raster layer stored as a sparse grid of
 * fixed-size canvas tiles. Tiles are created lazily the first time
 * something is painted into them, so you can draw anywhere in world space.
 *
 * All drawing goes through `paint(rect, fn)`: `fn(ctx)` is invoked once per
 * tile overlapping `rect`, with the tile context translated so that `fn`
 * can draw in *world* coordinates. Before a tile is modified, an attached
 * history recorder (if any) gets a chance to snapshot it.
 */
(function (App2) {
  'use strict';

  const TILE = 256;
  const MAX_TILES_PER_PAINT = 8192; // safety valve against runaway regions
  let nextId = 1;

  class TiledLayer {
    constructor(opts) {
      opts = opts || {};
      this.id = opts.id || 'L' + nextId++ + '-' + Math.random().toString(36).slice(2, 7);
      this.name = opts.name || 'Layer';
      this.visible = opts.visible !== false;
      this.opacity = opts.opacity != null ? opts.opacity : 1;
      this.blend = opts.blend || 'source-over';
      /** @type {Map<string, HTMLCanvasElement>} key "tx,ty" → tile canvas */
      this.tiles = new Map();
      /** History recorder (see history.js) — set while a change is being recorded. */
      this.recorder = null;
      /** Incremented on every pixel change; used for cache invalidation. */
      this.version = 0;
    }

    static get TILE() {
      return TILE;
    }
    static key(tx, ty) {
      return tx + ',' + ty;
    }
    static parseKey(k) {
      const i = k.indexOf(',');
      return [+k.slice(0, i), +k.slice(i + 1)];
    }
    static createTileCanvas() {
      const c = document.createElement('canvas');
      c.width = TILE;
      c.height = TILE;
      return c;
    }
    /** True if every pixel of the tile is fully transparent. */
    static isTileEmpty(tile) {
      const d = tile.getContext('2d').getImageData(0, 0, TILE, TILE).data;
      for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) return false;
      return true;
    }
    /** Tile index range covering a world rect. */
    static tileRange(rect) {
      return {
        tx0: Math.floor(rect.x / TILE),
        ty0: Math.floor(rect.y / TILE),
        tx1: Math.floor((rect.x + rect.w - 1e-7) / TILE),
        ty1: Math.floor((rect.y + rect.h - 1e-7) / TILE),
      };
    }

    getTile(tx, ty) {
      return this.tiles.get(tx + ',' + ty);
    }
    ensureTile(tx, ty) {
      const k = tx + ',' + ty;
      let t = this.tiles.get(k);
      if (!t) {
        t = TiledLayer.createTileCanvas();
        this.tiles.set(k, t);
      }
      return t;
    }
    setTile(tx, ty, canvas) {
      this.tiles.set(tx + ',' + ty, canvas);
      this.version++;
    }
    deleteTile(tx, ty) {
      this.tiles.delete(tx + ',' + ty);
      this.version++;
    }
    forEachTile(fn) {
      for (const [k, c] of this.tiles) {
        const p = TiledLayer.parseKey(k);
        fn(c, p[0], p[1], k);
      }
    }
    get isEmpty() {
      return this.tiles.size === 0;
    }

    /**
     * Run `fn(ctx, tx, ty)` for every tile overlapping the world rect,
     * with ctx translated into world coordinates.
     * opts.noCreate — skip tiles that do not exist yet (erasing, clipping).
     */
    paint(rect, fn, opts) {
      if (!rect || !(rect.w > 0) || !(rect.h > 0)) return;
      const r = TiledLayer.tileRange(rect);
      const count = (r.tx1 - r.tx0 + 1) * (r.ty1 - r.ty0 + 1);
      if (count > MAX_TILES_PER_PAINT) {
        console.warn('[App2] paint region too large, skipped', rect);
        return;
      }
      const noCreate = !!(opts && opts.noCreate);
      for (let ty = r.ty0; ty <= r.ty1; ty++) {
        for (let tx = r.tx0; tx <= r.tx1; tx++) {
          let tile = this.getTile(tx, ty);
          if (!tile && noCreate) continue;
          if (this.recorder) {
            const ox = tx * TILE, oy = ty * TILE;
            const lx = Math.max(0, Math.floor(rect.x - ox));
            const ly = Math.max(0, Math.floor(rect.y - oy));
            const lx2 = Math.min(TILE, Math.ceil(rect.x + rect.w - ox));
            const ly2 = Math.min(TILE, Math.ceil(rect.y + rect.h - oy));
            this.recorder.capture(this, tx, ty, { x: lx, y: ly, w: lx2 - lx, h: ly2 - ly });
          }
          if (!tile) tile = this.ensureTile(tx, ty);
          const ctx = tile.getContext('2d');
          ctx.save();
          ctx.translate(-tx * TILE, -ty * TILE);
          fn(ctx, tx, ty);
          ctx.restore();
        }
      }
      this.version++;
    }

    clearRect(rect) {
      this.paint(rect, (ctx) => ctx.clearRect(rect.x, rect.y, rect.w, rect.h), { noCreate: true });
    }

    /**
     * Draw the part of this layer that lies in world `rect` onto `ctx`,
     * mapping rect.x/rect.y to (ox, oy) and scaling by `scale`. Uses the
     * ctx's current globalAlpha / composite mode.
     */
    renderRegion(ctx, rect, scale, ox, oy) {
      scale = scale || 1;
      ox = ox || 0;
      oy = oy || 0;
      const r = TiledLayer.tileRange(rect);
      const nRange = (r.tx1 - r.tx0 + 1) * (r.ty1 - r.ty0 + 1);
      const draw = (tile, tx, ty) => {
        ctx.drawImage(tile, (tx * TILE - rect.x) * scale + ox, (ty * TILE - rect.y) * scale + oy, TILE * scale, TILE * scale);
      };
      if (this.tiles.size < nRange) {
        this.forEachTile((tile, tx, ty) => {
          if (tx >= r.tx0 && tx <= r.tx1 && ty >= r.ty0 && ty <= r.ty1) draw(tile, tx, ty);
        });
      } else {
        for (let ty = r.ty0; ty <= r.ty1; ty++)
          for (let tx = r.tx0; tx <= r.tx1; tx++) {
            const t = this.getTile(tx, ty);
            if (t) draw(t, tx, ty);
          }
      }
    }

    /**
     * Composite this layer onto another layer (used to commit stroke
     * buffers and for merge-down).
     */
    drawOnto(target, alpha, composite) {
      const op = composite || 'source-over';
      this.forEachTile((tile, tx, ty) => {
        target.paint(
          { x: tx * TILE, y: ty * TILE, w: TILE, h: TILE },
          (ctx) => {
            ctx.globalAlpha = alpha == null ? 1 : alpha;
            ctx.globalCompositeOperation = op;
            ctx.drawImage(tile, tx * TILE, ty * TILE);
          },
          { noCreate: op === 'destination-out' || op === 'source-atop' || op === 'destination-in' }
        );
      });
    }

    /** Raw RGBA of one world pixel (from this layer only). */
    getPixel(x, y) {
      const fx = Math.floor(x), fy = Math.floor(y);
      const tx = Math.floor(fx / TILE), ty = Math.floor(fy / TILE);
      const tile = this.getTile(tx, ty);
      if (!tile) return [0, 0, 0, 0];
      const d = tile.getContext('2d').getImageData(fx - tx * TILE, fy - ty * TILE, 1, 1).data;
      return [d[0], d[1], d[2], d[3]];
    }

    /** Union of all tile rectangles (fast, coarse bounds) or null. */
    tileBounds() {
      if (!this.tiles.size) return null;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      this.forEachTile((t, tx, ty) => {
        if (tx < x0) x0 = tx;
        if (ty < y0) y0 = ty;
        if (tx > x1) x1 = tx;
        if (ty > y1) y1 = ty;
      });
      return { x: x0 * TILE, y: y0 * TILE, w: (x1 - x0 + 1) * TILE, h: (y1 - y0 + 1) * TILE };
    }

    /** Exact bounds of non-transparent pixels (scans tiles) or null. */
    tightBounds() {
      let box = null;
      this.forEachTile((tile, tx, ty) => {
        const d = tile.getContext('2d').getImageData(0, 0, TILE, TILE).data;
        let minX = TILE, minY = TILE, maxX = -1, maxY = -1;
        for (let y = 0; y < TILE; y++) {
          const row = y * TILE * 4;
          for (let x = 0; x < TILE; x++) {
            if (d[row + x * 4 + 3] !== 0) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }
        if (maxX >= 0) {
          const r = { x: tx * TILE + minX, y: ty * TILE + minY, w: maxX - minX + 1, h: maxY - minY + 1 };
          box = App2.core.math.rectUnion(box, r);
        }
      });
      return box;
    }

    /** Remove tiles that are completely transparent. */
    prune() {
      for (const [k, t] of Array.from(this.tiles)) {
        if (TiledLayer.isTileEmpty(t)) this.tiles.delete(k);
      }
    }

    clear() {
      this.tiles.clear();
      this.version++;
    }

    /** Deep copy (pixels + properties, new id). */
    clone(name) {
      const L = new TiledLayer({ name: name || this.name + ' copy', visible: this.visible, opacity: this.opacity, blend: this.blend });
      this.forEachTile((tile, tx, ty) => {
        const c = TiledLayer.createTileCanvas();
        c.getContext('2d').drawImage(tile, 0, 0);
        L.tiles.set(TiledLayer.key(tx, ty), c);
      });
      return L;
    }

    /** Approximate memory footprint in bytes. */
    get byteSize() {
      return this.tiles.size * TILE * TILE * 4;
    }
  }

  App2.canvas.TILE = TILE;
  App2.canvas.TiledLayer = TiledLayer;
})(window.App2);
