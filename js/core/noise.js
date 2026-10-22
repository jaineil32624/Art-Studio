/**
 * Deterministic randomness and procedural noise.
 *
 *  - mulberry32(seed)  → fast seeded PRNG returning floats in [0, 1)
 *  - Noise(seed)       → 2D gradient (Perlin) noise with optional periodic
 *                        wrapping (for seamless textures), fBm, turbulence
 *                        and Worley/cellular noise.
 */
(function (App2) {
  'use strict';

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Hash a string into a 32-bit seed. */
  function hashString(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  const GRAD = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => a + (b - a) * t;
  const mod = (a, n) => ((a % n) + n) % n;

  class Noise {
    constructor(seed) {
      this.seed = (seed === undefined ? 1 : seed) >>> 0;
      const rand = mulberry32(this.seed);
      const p = new Uint8Array(256);
      for (let i = 0; i < 256; i++) p[i] = i;
      for (let i = 255; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        const t = p[i]; p[i] = p[j]; p[j] = t;
      }
      this.perm = new Uint8Array(512);
      for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
    }

    /**
     * 2D Perlin noise, roughly in [-1, 1].
     * px / py: optional integer periods (≤ 256) for seamless tiling.
     */
    perlin2(x, y, px, py) {
      let X = Math.floor(x), Y = Math.floor(y);
      const xf = x - X, yf = y - Y;
      let X1 = X + 1, Y1 = Y + 1;
      if (px > 0) { X = mod(X, px); X1 = mod(X1, px); }
      if (py > 0) { Y = mod(Y, py); Y1 = mod(Y1, py); }
      X &= 255; X1 &= 255; Y &= 255; Y1 &= 255;
      const p = this.perm;
      const aa = p[p[X] + Y], ab = p[p[X] + Y1], ba = p[p[X1] + Y], bb = p[p[X1] + Y1];
      const g = (h, gx, gy) => {
        const v = GRAD[h & 7];
        return v[0] * gx + v[1] * gy;
      };
      const u = fade(xf), v = fade(yf);
      const x1 = lerp(g(aa, xf, yf), g(ba, xf - 1, yf), u);
      const x2 = lerp(g(ab, xf, yf - 1), g(bb, xf - 1, yf - 1), u);
      return lerp(x1, x2, v);
    }

    /** Fractal Brownian motion. Returns roughly [-1, 1]. */
    fbm(x, y, octaves, px, py) {
      const oct = octaves || 5;
      let amp = 1, freq = 1, sum = 0, norm = 0;
      for (let i = 0; i < oct; i++) {
        sum += amp * this.perlin2(x * freq, y * freq, px ? px * freq : 0, py ? py * freq : 0);
        norm += amp;
        amp *= 0.5;
        freq *= 2;
      }
      return sum / norm;
    }

    /** Turbulence: fBm of absolute noise. Returns roughly [0, 1]. */
    turbulence(x, y, octaves, px, py) {
      const oct = octaves || 5;
      let amp = 1, freq = 1, sum = 0, norm = 0;
      for (let i = 0; i < oct; i++) {
        sum += amp * Math.abs(this.perlin2(x * freq, y * freq, px ? px * freq : 0, py ? py * freq : 0));
        norm += amp;
        amp *= 0.5;
        freq *= 2;
      }
      return sum / norm;
    }

    /** Integer hash → [0, 1). */
    hash2(i, j, k) {
      let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(this.seed + (k || 0), 144665)) | 0;
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      h ^= h >>> 16;
      return (h >>> 0) / 4294967296;
    }

    /**
     * Worley / cellular noise. Returns {f1, f2} distances to the nearest and
     * second-nearest feature point (in cell units). Optional period wraps cells.
     */
    worley(x, y, px, py) {
      const cx = Math.floor(x), cy = Math.floor(y);
      let f1 = 9, f2 = 9;
      for (let j = -1; j <= 1; j++) {
        for (let i = -1; i <= 1; i++) {
          const gx = cx + i, gy = cy + j;
          const hx = px > 0 ? mod(gx, px) : gx;
          const hy = py > 0 ? mod(gy, py) : gy;
          const fx = gx + this.hash2(hx, hy, 1);
          const fy = gy + this.hash2(hx, hy, 2);
          const d = Math.hypot(fx - x, fy - y);
          if (d < f1) { f2 = f1; f1 = d; }
          else if (d < f2) f2 = d;
        }
      }
      return { f1, f2 };
    }
  }

  App2.core.mulberry32 = mulberry32;
  App2.core.hashString = hashString;
  App2.core.Noise = Noise;
})(window.App2);
