/**
 * Small math helpers: scalars, rectangles and 2D affine matrices.
 *
 * Rectangles are plain objects {x, y, w, h}.
 * Matrices are arrays [a, b, c, d, e, f] in the same order as
 * CanvasRenderingContext2D.transform(a, b, c, d, e, f):
 *     x' = a*x + c*y + e
 *     y' = b*x + d*y + f
 */
(function (App2) {
  'use strict';

  const M = {
    clamp(v, lo, hi) {
      return v < lo ? lo : v > hi ? hi : v;
    },
    lerp(a, b, t) {
      return a + (b - a) * t;
    },
    dist(ax, ay, bx, by) {
      return Math.hypot(bx - ax, by - ay);
    },
    smoothstep(e0, e1, x) {
      const t = M.clamp((x - e0) / (e1 - e0), 0, 1);
      return t * t * (3 - 2 * t);
    },
    degToRad(d) {
      return (d * Math.PI) / 180;
    },
    radToDeg(r) {
      return (r * 180) / Math.PI;
    },
    /** Snap an angle (radians) to the nearest multiple of `step` radians. */
    snapAngle(a, step) {
      return Math.round(a / step) * step;
    },
    mod(a, n) {
      return ((a % n) + n) % n;
    },

    /* ---------------- rectangles ---------------- */
    rectFromPoints(ax, ay, bx, by) {
      return { x: Math.min(ax, bx), y: Math.min(ay, by), w: Math.abs(bx - ax), h: Math.abs(by - ay) };
    },
    rectUnion(a, b) {
      if (!a) return b ? { x: b.x, y: b.y, w: b.w, h: b.h } : null;
      if (!b) return { x: a.x, y: a.y, w: a.w, h: a.h };
      const x = Math.min(a.x, b.x);
      const y = Math.min(a.y, b.y);
      return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
    },
    rectIntersect(a, b) {
      if (!a || !b) return null;
      const x = Math.max(a.x, b.x);
      const y = Math.max(a.y, b.y);
      const x2 = Math.min(a.x + a.w, b.x + b.w);
      const y2 = Math.min(a.y + a.h, b.y + b.h);
      if (x2 <= x || y2 <= y) return null;
      return { x, y, w: x2 - x, h: y2 - y };
    },
    rectInflate(r, d) {
      return { x: r.x - d, y: r.y - d, w: r.w + 2 * d, h: r.h + 2 * d };
    },
    /** Expand a rect outward to whole-pixel boundaries. */
    rectRoundOut(r) {
      const x = Math.floor(r.x);
      const y = Math.floor(r.y);
      return { x, y, w: Math.ceil(r.x + r.w) - x, h: Math.ceil(r.y + r.h) - y };
    },
    pointInRect(px, py, r) {
      return px >= r.x && py >= r.y && px <= r.x + r.w && py <= r.y + r.h;
    },
    /** Bounding box of a list of {x,y} points. */
    rectFromPointList(points) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const p of points) {
        if (p.x < x0) x0 = p.x;
        if (p.y < y0) y0 = p.y;
        if (p.x > x1) x1 = p.x;
        if (p.y > y1) y1 = p.y;
      }
      return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    },

    /* ---------------- affine matrices ---------------- */
    matIdentity() {
      return [1, 0, 0, 1, 0, 0];
    },
    /** Returns m × n, i.e. apply n first, then m. */
    matMultiply(m, n) {
      return [
        m[0] * n[0] + m[2] * n[1],
        m[1] * n[0] + m[3] * n[1],
        m[0] * n[2] + m[2] * n[3],
        m[1] * n[2] + m[3] * n[3],
        m[0] * n[4] + m[2] * n[5] + m[4],
        m[1] * n[4] + m[3] * n[5] + m[5],
      ];
    },
    matApply(m, x, y) {
      return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] };
    },
    matTranslate(tx, ty) {
      return [1, 0, 0, 1, tx, ty];
    },
    matRotate(a) {
      const c = Math.cos(a), s = Math.sin(a);
      return [c, s, -s, c, 0, 0];
    },
    matScale(sx, sy) {
      return [sx, 0, 0, sy === undefined ? sx : sy, 0, 0];
    },
    /** Apply matrix m about the pivot (cx, cy). */
    matAbout(cx, cy, m) {
      return M.matMultiply(M.matTranslate(cx, cy), M.matMultiply(m, M.matTranslate(-cx, -cy)));
    },
    /** Axis-aligned bounds of a rect after transforming it by m. */
    matTransformRect(m, r) {
      return M.rectFromPointList([
        M.matApply(m, r.x, r.y),
        M.matApply(m, r.x + r.w, r.y),
        M.matApply(m, r.x, r.y + r.h),
        M.matApply(m, r.x + r.w, r.y + r.h),
      ]);
    },

    /* ---------------- misc ---------------- */
    debounce(fn, ms) {
      let t = 0;
      const wrapped = function () {
        const args = arguments;
        clearTimeout(t);
        t = setTimeout(() => fn.apply(null, args), ms);
      };
      wrapped.cancel = () => clearTimeout(t);
      return wrapped;
    },
    uid(prefix) {
      return (prefix || 'id') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    },
  };

  App2.core.math = M;
})(window.App2);
