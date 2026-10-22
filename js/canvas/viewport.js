/**
 * Viewport / camera. Maps between screen (CSS px, relative to the canvas
 * element) and world coordinates:
 *     world = (x, y) + screen / zoom
 */
(function (App2) {
  'use strict';

  const M = App2.core.math;

  class Viewport {
    constructor(onChange) {
      this.x = 0; // world coordinate at the screen's left edge
      this.y = 0; // world coordinate at the screen's top edge
      this.zoom = 1;
      this.width = 1; // CSS px
      this.height = 1;
      this.minZoom = 0.05;
      this.maxZoom = 64;
      this.onChange = onChange || function () {};
    }

    screenToWorld(sx, sy) {
      return { x: this.x + sx / this.zoom, y: this.y + sy / this.zoom };
    }
    worldToScreen(wx, wy) {
      return { x: (wx - this.x) * this.zoom, y: (wy - this.y) * this.zoom };
    }

    /** World rectangle currently visible. */
    visibleRect() {
      return { x: this.x, y: this.y, w: this.width / this.zoom, h: this.height / this.zoom };
    }

    resize(w, h) {
      // Keep the world point at the center fixed while the element resizes.
      const c = this.screenToWorld(this.width / 2, this.height / 2);
      this.width = Math.max(1, w);
      this.height = Math.max(1, h);
      this.x = c.x - this.width / 2 / this.zoom;
      this.y = c.y - this.height / 2 / this.zoom;
      this.onChange();
    }

    /** Set zoom keeping the world point under screen (sx, sy) fixed. */
    zoomAt(sx, sy, newZoom) {
      const z = M.clamp(newZoom, this.minZoom, this.maxZoom);
      const w = this.screenToWorld(sx, sy);
      this.zoom = z;
      this.x = w.x - sx / z;
      this.y = w.y - sy / z;
      this.onChange();
    }

    zoomBy(factor, sx, sy) {
      if (sx === undefined) {
        sx = this.width / 2;
        sy = this.height / 2;
      }
      this.zoomAt(sx, sy, this.zoom * factor);
    }

    /** Pan by a screen-space delta (drag direction). */
    panBy(dx, dy) {
      this.x -= dx / this.zoom;
      this.y -= dy / this.zoom;
      this.onChange();
    }

    centerOn(wx, wy) {
      this.x = wx - this.width / 2 / this.zoom;
      this.y = wy - this.height / 2 / this.zoom;
      this.onChange();
    }

    /** Fit a world rectangle into view with some padding (CSS px). */
    fitRect(rect, padding) {
      const pad = padding == null ? 40 : padding;
      if (!rect || rect.w <= 0 || rect.h <= 0) return;
      const z = Math.min((this.width - pad * 2) / rect.w, (this.height - pad * 2) / rect.h);
      this.zoom = M.clamp(z, this.minZoom, this.maxZoom);
      this.centerOn(rect.x + rect.w / 2, rect.y + rect.h / 2);
    }

    set(x, y, zoom) {
      this.x = x;
      this.y = y;
      this.zoom = M.clamp(zoom, this.minZoom, this.maxZoom);
      this.onChange();
    }
  }

  App2.canvas.Viewport = Viewport;
})(window.App2);
