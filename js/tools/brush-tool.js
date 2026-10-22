/**
 * BrushTool — the generic driver that turns pointer input into calls on a
 * brush engine (see brushes/registry.js). It handles:
 *   - stroke buffering (opacity cap / no build-up) vs. direct painting
 *   - input smoothing, pressure → size/opacity
 *   - spacing-based dab interpolation or continuous segments
 *   - symmetry (one "lane" per symmetry matrix)
 *   - airbrush ticking while the pointer is held still
 *   - history recording and cancellation
 */
(function (App2) {
  'use strict';

  const { Tool } = App2.tools;
  const { TiledLayer, Symmetry } = App2.canvas;
  const { Color, math: M, mulberry32, Noise } = App2.core;
  const U = App2.brushes.util;

  const sharedNoise = new Noise(1337);

  // Small canvas reused for color sampling (oil smudge, etc.).
  let sampleCanvas = null;
  function sampleLayer(layer, x, y, r) {
    if (!sampleCanvas) {
      sampleCanvas = document.createElement('canvas');
      sampleCanvas.width = sampleCanvas.height = 4;
    }
    const g = sampleCanvas.getContext('2d', { willReadFrequently: true });
    g.clearRect(0, 0, 4, 4);
    const size = Math.max(1, r * 2);
    g.imageSmoothingEnabled = true;
    layer.renderRegion(g, { x: x - size / 2, y: y - size / 2, w: size, h: size }, 4 / size);
    const d = g.getImageData(0, 0, 4, 4).data;
    let rs = 0, gs = 0, bs = 0, as = 0;
    for (let i = 0; i < d.length; i += 4) {
      const a = d[i + 3];
      rs += d[i] * a;
      gs += d[i + 1] * a;
      bs += d[i + 2] * a;
      as += a;
    }
    if (as === 0) return { r: 0, g: 0, b: 0, a: 0 };
    return { r: rs / as, g: gs / as, b: bs / as, a: as / (16 * 255) };
  }

  class BrushTool extends Tool {
    constructor(app, engine) {
      super(app, {
        id: engine.id,
        name: engine.name,
        icon: engine.icon,
        shortcut: engine.shortcut,
        group: engine.group,
        order: engine.order,
        description: engine.description,
        defaults: engine.defaults,
      });
      this.engine = engine;
      this.stroke = null;
      this.altPicks = engine.usesColor !== false;
    }

    getOptions() {
      const eng = this.engine;
      const opts = [
        { key: 'size', label: 'Size', type: 'range', min: 1, max: eng.maxSize || 300, step: 1, format: 'px' },
        { key: 'opacity', label: 'Opacity', type: 'range', min: 0.01, max: 1, step: 0.01, format: 'pct' },
      ];
      if (!eng.noHardness) opts.push({ key: 'hardness', label: 'Hardness', type: 'range', min: 0, max: 1, step: 0.01, format: 'pct' });
      if (!eng.segment && !eng.noSpacing) opts.push({ key: 'spacing', label: 'Spacing', type: 'range', min: 0.02, max: 2, step: 0.01, format: 'pct' });
      opts.push({ key: 'smoothing', label: 'Smoothing', type: 'range', min: 0, max: 0.95, step: 0.01, format: 'pct' });
      return opts.concat(eng.options, [
        { key: 'pressureSize', label: 'Pressure → size', type: 'toggle' },
        { key: 'pressureOpacity', label: 'Pressure → opacity', type: 'toggle' },
      ]);
    }

    cursorRadius() {
      return this.settings.size / 2;
    }

    get busy() {
      return !!this.stroke;
    }

    static pressureOf(e) {
      if (e.pointerType === 'pen') return Math.max(0.02, e.pressure || 0);
      return 1; // mouse & touch: full pressure
    }

    _radiusFor(pressure) {
      const st = this.settings;
      return Math.max(0.5, st.size * 0.5 * (st.pressureSize ? M.lerp(0.12, 1, pressure) : 1));
    }

    _alphaFor(pressure) {
      const st = this.settings;
      const p = st.pressureOpacity ? M.lerp(0.1, 1, pressure) : 1;
      // Buffered engines get full alpha per dab; opacity is applied on commit.
      return this.engine.buffered ? p : st.opacity * p;
    }

    _makeLane(matrix, index, seed, target, layer, rgb, hex) {
      const tool = this;
      const s = {
        app: this.app,
        tool,
        engine: this.engine,
        settings: this.settings,
        index,
        matrix,
        mirrored: matrix[0] * matrix[3] - matrix[1] * matrix[2] < 0,
        rgb,
        hex,
        target,
        layer,
        rng: mulberry32(seed),
        noise: sharedNoise,
        state: {},
        paint(rect, fn, opts) {
          target.paint(rect, fn, opts);
        },
        paintAt(x, y, r, fn, opts) {
          const p = Math.ceil(r) + 2;
          target.paint({ x: x - p, y: y - p, w: 2 * p, h: 2 * p }, fn, opts);
        },
        dab(x, y, r, alpha, hardness, color) {
          s.paintAt(x, y, r, (ctx) => U.dab(ctx, x, y, r, color || rgb, alpha, hardness));
        },
        sample(x, y, r) {
          return sampleLayer(layer, x, y, r || 2);
        },
        radiusFor: (p) => tool._radiusFor(p),
        alphaFor: (p) => tool._alphaFor(p),
      };
      return { s, m: matrix, prev: null, carry: 0, dist: 0, angle: 0 };
    }

    onPointerDown(e) {
      if (this.stroke) this.onPointerUp(e);
      const layer = this.paintableLayer();
      if (!layer) return;
      const app = this.app;
      const eng = this.engine;
      const st = this.settings;
      let target;
      if (eng.buffered) {
        target = new TiledLayer({ name: 'stroke-buffer' });
        app.renderer.live = { layer, buffer: target, alpha: st.opacity, composite: eng.composite || 'source-over' };
      } else {
        target = layer;
        app.history.begin(layer);
      }
      const hex = app.state.primary;
      const rgb = Color.hexToRgb(hex);
      const seed = (Math.random() * 0x7fffffff) | 0;
      const lanes = Symmetry.matrices(app.state.symmetry).map((m, i) => this._makeLane(m, i, seed, target, layer, rgb, hex));
      const p = { x: e.x, y: e.y, pressure: BrushTool.pressureOf(e) };
      this.stroke = { layer, target, lanes, smooth: p, raw: p, timer: 0, hex };
      for (const lane of lanes) if (eng.begin) eng.begin(lane.s);
      this._feed(p);
      if (eng.airbrush) this.stroke.timer = setInterval(() => this._tick(), 45);
      app.renderer.requestRender();
    }

    onPointerMove(e) {
      const stroke = this.stroke;
      if (!stroke) return;
      const sm = this.settings.smoothing || 0;
      const pr = BrushTool.pressureOf(e);
      const k = 1 - sm;
      const p = {
        x: M.lerp(stroke.smooth.x, e.x, k),
        y: M.lerp(stroke.smooth.y, e.y, k),
        pressure: M.lerp(stroke.smooth.pressure, pr, Math.max(k, 0.3)),
      };
      stroke.smooth = p;
      stroke.raw = { x: e.x, y: e.y, pressure: pr };
      this._feed(p);
      this.app.renderer.requestRender();
    }

    onPointerUp() {
      const stroke = this.stroke;
      if (!stroke) return;
      // Catch up with the real pointer position so smoothing never "shortens" a stroke.
      const r = stroke.raw;
      if (r && (Math.abs(r.x - stroke.smooth.x) > 0.5 || Math.abs(r.y - stroke.smooth.y) > 0.5)) {
        this._feed({ x: r.x, y: r.y, pressure: stroke.smooth.pressure });
      }
      this._finish();
    }

    _finish() {
      const stroke = this.stroke;
      this.stroke = null;
      clearInterval(stroke.timer);
      const app = this.app;
      const eng = this.engine;
      for (const lane of stroke.lanes) if (eng.end) eng.end(lane.s);
      if (eng.buffered) {
        app.renderer.live = null;
        app.history.begin(stroke.layer);
        stroke.target.drawOnto(stroke.layer, this.settings.opacity, eng.composite || 'source-over');
      }
      app.history.end(this.name);
      if (eng.usesColor !== false) app.state.addRecent(stroke.hex);
      app.doc.changed();
    }

    cancel() {
      const stroke = this.stroke;
      if (!stroke) return;
      this.stroke = null;
      clearInterval(stroke.timer);
      if (this.engine.buffered) this.app.renderer.live = null;
      else this.app.history.abort();
      this.app.doc.changed();
    }

    /** Feed one (already smoothed) input point to every symmetry lane. */
    _feed(p) {
      const eng = this.engine;
      for (const lane of this.stroke.lanes) {
        const q = M.matApply(lane.m, p.x, p.y);
        const pt = { x: q.x, y: q.y, pressure: p.pressure };
        if (!lane.prev) {
          lane.prev = pt;
          if (eng.segment) eng.segment(lane.s, pt, pt);
          else {
            this._emit(lane, pt, 0);
            lane.carry = this._spacing(pt.pressure);
          }
          continue;
        }
        const dx = pt.x - lane.prev.x, dy = pt.y - lane.prev.y;
        const d = Math.hypot(dx, dy);
        if (d < 0.01) continue;
        lane.angle = Math.atan2(dy, dx);
        if (eng.segment) {
          eng.segment(lane.s, lane.prev, pt);
          lane.dist += d;
          lane.prev = pt;
          continue;
        }
        let t = lane.carry;
        let guard = 0;
        while (t <= d && guard++ < 20000) {
          const k = t / d;
          const press = M.lerp(lane.prev.pressure, pt.pressure, k);
          this._emit(lane, { x: lane.prev.x + dx * k, y: lane.prev.y + dy * k, pressure: press }, lane.dist + t);
          t += this._spacing(press);
        }
        lane.carry = t - d;
        lane.dist += d;
        lane.prev = pt;
      }
    }

    _spacing(pressure) {
      const st = this.settings;
      return Math.max(0.5, this._radiusFor(pressure) * 2 * (st.spacing || 0.1));
    }

    _emit(lane, pt, dist) {
      this.engine.dab(lane.s, {
        x: pt.x,
        y: pt.y,
        pressure: pt.pressure,
        angle: lane.angle,
        radius: this._radiusFor(pt.pressure),
        alpha: this._alphaFor(pt.pressure),
        dist,
      });
    }

    /** Airbrush: keep spraying at the current position while held still. */
    _tick() {
      if (!this.stroke) return;
      for (const lane of this.stroke.lanes) if (lane.prev) this._emit(lane, lane.prev, lane.dist);
      this.app.renderer.requestRender();
    }
  }

  App2.tools.BrushTool = BrushTool;
})(window.App2);
