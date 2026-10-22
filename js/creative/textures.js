/**
 * Procedural texture generator. Every generator is seamless (tileable) so
 * the result can be used directly as a pattern.
 *
 *   App2.creative.textures.generate({ type, size, scale, detail, seed, colorA, colorB })
 *     → HTMLCanvasElement
 *
 * Add a generator with App2.creative.textures.register(id, name, fn) where
 * fn(noise, u, v, params) returns a value 0..1 for normalised coords u,v in
 * [0,1). Use params.period for periodic noise so the texture tiles.
 */
(function (App2) {
  'use strict';

  const { Noise, Color, math: M } = App2.core;
  const generators = [];

  function register(id, name, fn) {
    generators.push({ id, name, fn });
  }

  // Clouds — fBm noise.
  register('clouds', 'Clouds / noise', (n, u, v, p) => {
    const f = p.period;
    return M.clamp(0.5 + 0.55 * n.fbm(u * f, v * f, p.detail, f, f), 0, 1);
  });

  // Marble — sine bands distorted by turbulence.
  register('marble', 'Marble', (n, u, v, p) => {
    const f = p.period;
    const t = n.turbulence(u * f, v * f, p.detail, f, f);
    const s = Math.sin((u + v) * Math.PI * 2 * 3 + t * 9);
    return Math.pow(0.5 + 0.5 * s, 0.6);
  });

  // Wood — rings along one axis with noise distortion.
  register('wood', 'Wood grain', (n, u, v, p) => {
    const f = p.period;
    const k = Math.max(1, Math.round(f * 0.25));
    const d = n.fbm(u * f, v * k + 0.5, p.detail, f, k);
    const rings = (v * 12 + d * 2.5) % 1;
    const r = rings < 0 ? rings + 1 : rings;
    return M.clamp(0.25 + 0.75 * Math.pow(r, 2.2) + 0.1 * n.perlin2(u * f * 8, v * 2, f * 8, 2), 0, 1);
  });

  // Cells — Worley noise (F2 - F1 gives cell borders).
  register('cells', 'Cells', (n, u, v, p) => {
    const f = Math.max(2, Math.round(p.period * 1.5));
    const w = n.worley(u * f, v * f, f, f);
    return M.clamp((w.f2 - w.f1) * 1.6, 0, 1);
  });

  // Stone — Worley F1 blended with fBm.
  register('stone', 'Stone', (n, u, v, p) => {
    const f = Math.max(2, Math.round(p.period));
    const w = n.worley(u * f, v * f, f, f);
    const g = 0.5 + 0.5 * n.fbm(u * f * 2, v * f * 2, p.detail, f * 2, f * 2);
    return M.clamp(w.f1 * 0.9 + g * 0.45 - 0.15, 0, 1);
  });

  // Static — per-pixel white noise.
  register('static', 'Static grain', (n, u, v, p) => n.hash2(Math.floor(u * p.size), Math.floor(v * p.size), 7));

  /**
   * Generate a texture canvas.
   * params: type, size (px), scale (feature size 1..16), detail (octaves),
   *         seed, colorA, colorB (hex).
   */
  function generate(params) {
    const p = Object.assign({ type: 'clouds', size: 256, scale: 4, detail: 5, seed: 1, colorA: '#1f2430', colorB: '#ffffff' }, params || {});
    const gen = generators.find((g) => g.id === p.type) || generators[0];
    const size = M.clamp(p.size | 0, 16, 2048);
    const noise = new Noise(p.seed >>> 0);
    const ca = Color.hexToRgb(p.colorA), cb = Color.hexToRgb(p.colorB);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(size, size);
    const d = img.data;
    const gp = { period: Math.max(1, Math.round(p.scale)), detail: p.detail | 0, size };
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const t = gen.fn(noise, x / size, y / size, gp);
        const i = (y * size + x) * 4;
        d[i] = ca.r + (cb.r - ca.r) * t;
        d[i + 1] = ca.g + (cb.g - ca.g) * t;
        d[i + 2] = ca.b + (cb.b - ca.b) * t;
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
  }

  App2.creative.textures = {
    register,
    generate,
    list: () => generators.map((g) => ({ id: g.id, name: g.name })),
  };
})(window.App2);
