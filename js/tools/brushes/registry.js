/**
 * Brush engine registry + shared dab utilities.
 *
 * A brush engine is a plain object:
 *
 *   App2.brushes.register({
 *     id: 'my-brush',            // unique id (also the tool id)
 *     name: 'My Brush',          // tooltip / panel title
 *     icon: 'brush',             // key in App2.ui.icons
 *     shortcut: 'b',             // optional single-key shortcut
 *     group: 'paint',            // toolbar group: paint | art | gen
 *     order: 50,                 // toolbar order
 *     description: '…',
 *     defaults: { size, opacity, hardness, spacing, smoothing, … },
 *     options: [ …extra option schema… ],
 *     buffered: true,            // paint into a stroke buffer; opacity is
 *                                // applied once on commit (no build-up)
 *     composite: 'source-over',  // how the buffer is committed (eraser uses destination-out)
 *     airbrush: false,           // keep emitting dabs while the pointer is still
 *     usesColor: true,           // add color to "recent" after a stroke
 *     noHardness: false,         // hide the hardness slider
 *
 *     begin(s) {},               // stroke started (once per symmetry lane)
 *     dab(s, p) {},              // a spaced dab: p = {x, y, pressure, angle, radius, alpha, dist}
 *     // — or —
 *     segment(s, a, b) {},       // continuous mode: line from point a to b
 *     end(s) {},
 *   });
 *
 * The stroke context `s` (one per symmetry lane) provides:
 *   s.settings, s.rgb, s.hex, s.rng(), s.noise, s.state (scratch object),
 *   s.index (lane), s.mirrored, s.target (layer or buffer),
 *   s.paint(rect, fn, opts), s.paintAt(x, y, r, fn),
 *   s.dab(x, y, r, alpha, hardness, rgb?),
 *   s.sample(x, y, r) → {r,g,b,a}  (a in 0..1; samples the real layer),
 *   s.radiusFor(pressure), s.alphaFor(pressure)
 */
(function (App2) {
  'use strict';

  const engines = [];

  const BASE_DEFAULTS = {
    size: 16,
    opacity: 1,
    hardness: 0.7,
    spacing: 0.12,
    smoothing: 0.35,
    pressureSize: true,
    pressureOpacity: false,
  };

  App2.brushes.BASE_DEFAULTS = BASE_DEFAULTS;

  App2.brushes.register = function (engine) {
    if (!engine || !engine.id) throw new Error('Brush engine needs an id');
    if (typeof engine.dab !== 'function' && typeof engine.segment !== 'function') {
      throw new Error('Brush engine "' + engine.id + '" needs dab() or segment()');
    }
    if (engines.some((e) => e.id === engine.id)) throw new Error('Duplicate brush id: ' + engine.id);
    engine.name = engine.name || engine.id;
    engine.icon = engine.icon || 'brush';
    engine.group = engine.group || 'paint';
    engine.order = engine.order || 100;
    engine.defaults = Object.assign({}, BASE_DEFAULTS, engine.defaults || {});
    engine.options = engine.options || [];
    engines.push(engine);
    return engine;
  };

  App2.brushes.list = function () {
    return engines.slice().sort((a, b) => a.order - b.order);
  };
  App2.brushes.get = function (id) {
    return engines.find((e) => e.id === id) || null;
  };

  /* ------------------------------------------------------------------ */
  /* Dab stamps: cached radial-falloff tips at a few resolutions         */
  /* ------------------------------------------------------------------ */

  const stampCache = new Map();

  function getStamp(rgb, hardness, res) {
    const h = Math.round(Math.max(0, Math.min(1, hardness)) * 20) / 20;
    const key = Math.round(rgb.r) + ',' + Math.round(rgb.g) + ',' + Math.round(rgb.b) + '|' + h + '|' + res;
    let c = stampCache.get(key);
    if (c) return c;
    if (stampCache.size > 96) stampCache.clear();
    c = document.createElement('canvas');
    c.width = c.height = res;
    const g = c.getContext('2d');
    const r = res / 2;
    const col = (a) => 'rgba(' + Math.round(rgb.r) + ',' + Math.round(rgb.g) + ',' + Math.round(rgb.b) + ',' + a.toFixed(4) + ')';
    if (h >= 0.98) {
      g.fillStyle = col(1);
      g.beginPath();
      g.arc(r, r, r - 0.5, 0, Math.PI * 2);
      g.fill();
    } else {
      const grad = g.createRadialGradient(r, r, 0, r, r, r);
      grad.addColorStop(0, col(1));
      grad.addColorStop(h, col(1));
      // Smooth (smoothstep) falloff from the hard core to the edge.
      for (let k = 1; k < 6; k++) {
        const t = k / 6;
        const a = 1 - t * t * (3 - 2 * t);
        grad.addColorStop(h + (1 - h) * t, col(a));
      }
      grad.addColorStop(1, col(0));
      g.fillStyle = grad;
      g.fillRect(0, 0, res, res);
    }
    stampCache.set(key, c);
    return c;
  }

  /** Draw one round dab in world coords onto ctx. */
  function dab(ctx, x, y, radius, rgb, alpha, hardness) {
    if (radius < 0.3 || alpha <= 0) return;
    const d = radius * 2;
    const res = d <= 12 ? 16 : d <= 48 ? 64 : 256;
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.drawImage(getStamp(rgb, hardness, res), x - radius, y - radius, d, d);
  }

  /** Integer Bresenham line, calling fn(x, y) for each pixel. */
  function bresenham(x0, y0, x1, y1, fn) {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let guard = 0;
    for (;;) {
      fn(x0, y0);
      if ((x0 === x1 && y0 === y1) || ++guard > 100000) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  App2.brushes.util = { getStamp, dab, bresenham };
})(window.App2);
