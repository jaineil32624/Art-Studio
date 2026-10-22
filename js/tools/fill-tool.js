/**
 * Fill bucket — scanline flood fill with color tolerance.
 *
 * Because the canvas is infinite, the fill region is bounded by the visible
 * area united with the existing content (capped to 4096 px per side around
 * the click). Open areas therefore fill up to that boundary.
 */
(function (App2) {
  'use strict';

  const { Tool } = App2.tools;
  const { math: M, Color } = App2.core;
  const MAX_SIDE = 4096;

  class FillTool extends Tool {
    constructor(app, def) {
      super(app, def);
      this.altPicks = true;
    }

    getOptions() {
      return [
        { key: 'tolerance', label: 'Tolerance', type: 'range', min: 0, max: 255, step: 1 },
        { key: 'opacity', label: 'Opacity', type: 'range', min: 0.01, max: 1, step: 0.01, format: 'pct' },
        { key: 'fillWith', label: 'Fill with', type: 'select', choices: [['color', 'Primary color'], ['pattern', 'Active pattern']] },
        { key: 'sampleAll', label: 'Sample all layers', type: 'toggle' },
        { key: 'expand', label: 'Grow 1px (cover anti-aliasing)', type: 'toggle' },
      ];
    }

    onPointerDown(e) {
      const layer = this.paintableLayer();
      if (!layer) return;
      try {
        this.fillAt(layer, e.x, e.y);
      } catch (err) {
        console.error(err);
        this.app.toast('Fill failed: ' + err.message, 'error');
      }
    }

    /** Compute the region of world space the fill may cover. */
    _region(sx, sy, srcLayers) {
      let region = M.rectRoundOut(this.app.view.visibleRect());
      for (const l of srcLayers) {
        const b = l.tileBounds();
        if (b) region = M.rectUnion(region, b);
      }
      const clampAxis = (pos, len, seed) => {
        if (len <= MAX_SIDE) return [pos, len];
        const p = M.clamp(seed - MAX_SIDE / 2, pos, pos + len - MAX_SIDE);
        return [p, MAX_SIDE];
      };
      const [x, w] = clampAxis(region.x, region.w, sx);
      const [y, h] = clampAxis(region.y, region.h, sy);
      return { x: Math.floor(x), y: Math.floor(y), w: Math.ceil(w), h: Math.ceil(h) };
    }

    fillAt(layer, wx, wy) {
      const app = this.app, st = this.settings;
      const sx = Math.floor(wx), sy = Math.floor(wy);
      const srcLayers = st.sampleAll ? app.doc.layers.filter((l) => l.visible) : [layer];
      const R = this._region(sx, sy, srcLayers);
      const W = R.w, H = R.h;
      const ix = sx - R.x, iy = sy - R.y;
      if (ix < 0 || iy < 0 || ix >= W || iy >= H) return;

      // 1) Rasterise the source.
      const src = document.createElement('canvas');
      src.width = W;
      src.height = H;
      const g = src.getContext('2d', { willReadFrequently: true });
      app.doc.composite(g, R, { layers: srcLayers, ignoreLayerProps: !st.sampleAll });
      const d = g.getImageData(0, 0, W, H).data;

      // 2) Scanline flood fill on premultiplied colors.
      const i0 = (iy * W + ix) * 4;
      const ta = d[i0 + 3];
      const tr = (d[i0] * ta) / 255, tg = (d[i0 + 1] * ta) / 255, tb = (d[i0 + 2] * ta) / 255;
      const tol = st.tolerance;
      const mask = new Uint8Array(W * H);
      const match = (p) => {
        const i = p * 4;
        const a = d[i + 3];
        return (
          Math.abs(a - ta) <= tol &&
          Math.abs((d[i] * a) / 255 - tr) <= tol &&
          Math.abs((d[i + 1] * a) / 255 - tg) <= tol &&
          Math.abs((d[i + 2] * a) / 255 - tb) <= tol
        );
      };
      const stack = [ix, iy];
      let minX = W, minY = H, maxX = -1, maxY = -1;
      while (stack.length) {
        const y = stack.pop(), x = stack.pop();
        const row = y * W;
        if (mask[row + x] || !match(row + x)) continue;
        let lx = x, rx = x;
        while (lx > 0 && !mask[row + lx - 1] && match(row + lx - 1)) lx--;
        while (rx < W - 1 && !mask[row + rx + 1] && match(row + rx + 1)) rx++;
        for (let i = lx; i <= rx; i++) mask[row + i] = 1;
        if (lx < minX) minX = lx;
        if (rx > maxX) maxX = rx;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        for (const ny of [y - 1, y + 1]) {
          if (ny < 0 || ny >= H) continue;
          const nrow = ny * W;
          let inRun = false;
          for (let i = lx; i <= rx; i++) {
            const ok = !mask[nrow + i] && match(nrow + i);
            if (ok && !inRun) {
              stack.push(i, ny);
              inRun = true;
            } else if (!ok) inRun = false;
          }
        }
      }
      if (maxX < 0) return;

      // 3) Optional 1px dilation to cover anti-aliased edges.
      let finalMask = mask;
      if (st.expand) {
        finalMask = new Uint8Array(mask);
        for (let y = Math.max(0, minY - 1); y <= Math.min(H - 1, maxY + 1); y++)
          for (let x = Math.max(0, minX - 1); x <= Math.min(W - 1, maxX + 1); x++) {
            if (mask[y * W + x]) continue;
            if ((x > 0 && mask[y * W + x - 1]) || (x < W - 1 && mask[y * W + x + 1]) || (y > 0 && mask[(y - 1) * W + x]) || (y < H - 1 && mask[(y + 1) * W + x]))
              finalMask[y * W + x] = 1;
          }
        minX = Math.max(0, minX - 1);
        minY = Math.max(0, minY - 1);
        maxX = Math.min(W - 1, maxX + 1);
        maxY = Math.min(H - 1, maxY + 1);
      }

      // 4) Build the fill image within the mask bounding box.
      const bw = maxX - minX + 1, bh = maxY - minY + 1;
      const out = document.createElement('canvas');
      out.width = bw;
      out.height = bh;
      const og = out.getContext('2d');
      const img = og.createImageData(bw, bh);
      const c = Color.hexToRgb(app.state.primary);
      for (let y = 0; y < bh; y++)
        for (let x = 0; x < bw; x++) {
          if (!finalMask[(y + minY) * W + x + minX]) continue;
          const o = (y * bw + x) * 4;
          img.data[o] = c.r;
          img.data[o + 1] = c.g;
          img.data[o + 2] = c.b;
          img.data[o + 3] = 255;
        }
      og.putImageData(img, 0, 0);
      const ox = R.x + minX, oy = R.y + minY;
      if (st.fillWith === 'pattern') {
        const tile = App2.creative.patterns.activeTile();
        if (tile) {
          const pat = og.createPattern(tile, 'repeat');
          // Anchor the pattern to world coordinates.
          if (pat.setTransform && typeof DOMMatrix !== 'undefined') pat.setTransform(new DOMMatrix([1, 0, 0, 1, -ox, -oy]));
          og.globalCompositeOperation = 'source-in';
          og.fillStyle = pat;
          og.fillRect(0, 0, bw, bh);
        }
      }

      // 5) Commit onto the layer.
      app.history.begin(layer);
      layer.paint({ x: ox, y: oy, w: bw, h: bh }, (ctx) => {
        ctx.globalAlpha = st.opacity;
        ctx.drawImage(out, ox, oy);
      });
      app.history.end('Fill');
      if (st.fillWith !== 'pattern') app.state.addRecent(app.state.primary);
      app.doc.changed();
    }
  }

  App2.tools.register({
    id: 'fill',
    name: 'Fill Bucket',
    icon: 'bucket',
    shortcut: 'g',
    group: 'fill',
    order: 310,
    description: 'Flood fill an area with color or pattern.',
    defaults: { tolerance: 32, opacity: 1, fillWith: 'color', sampleAll: false, expand: true },
    create: (app, def) => new FillTool(app, def),
  });
})(window.App2);
