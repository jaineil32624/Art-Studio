/**
 * Global, non-document application state (colors, symmetry, pixel mode,
 * gradient definition, selection). Mutations go through methods so the
 * UI can react via events on the bus.
 */
(function (App2) {
  'use strict';

  const Color = App2.core.Color;
  const MAX_RECENT = 18;

  class Store {
    constructor(bus) {
      this.bus = bus;
      this.primary = '#1f2430';
      this.secondary = '#ffffff';
      this.recent = ['#1f2430', '#e63946', '#f4a261', '#2a9d8f', '#457b9d', '#ffffff'];
      /** mode: off | vertical | horizontal | quad | radial | kaleido */
      this.symmetry = { mode: 'off', count: 6, cx: 0, cy: 0, guides: true };
      /** Pixel-art mode: grid size in world px, grid overlay toggle. */
      this.pixel = { enabled: false, size: 8, grid: true };
      /** Multi-stop gradient used by the gradient tool. */
      this.gradient = {
        type: 'linear',
        stops: [
          { pos: 0, color: '#ff5f6d' },
          { pos: 0.5, color: '#ffc371' },
          { pos: 1, color: '#47cacc' },
        ],
      };
      /** World-space rectangle {x,y,w,h} or null. */
      this.selection = null;
    }

    /** Set the primary or secondary color from any hex form. */
    setColor(hex, which) {
      const key = which === 'secondary' ? 'secondary' : 'primary';
      const h = Color.normalizeHex(hex);
      if (!h || this[key] === h) return;
      this[key] = h;
      this.bus.emit('color:changed', { which: key, hex: h });
    }

    swapColors() {
      const p = this.primary;
      this.primary = this.secondary;
      this.secondary = p;
      this.bus.emit('color:changed', { which: 'primary', hex: this.primary });
      this.bus.emit('color:changed', { which: 'secondary', hex: this.secondary });
    }

    addRecent(hex) {
      const h = Color.normalizeHex(hex);
      if (!h) return;
      if (this.recent[0] === h) return;
      this.recent = [h].concat(this.recent.filter((c) => c !== h)).slice(0, MAX_RECENT);
      this.bus.emit('recent:changed');
    }

    /** Shallow-merge a patch into an object-valued state key and notify. */
    update(key, patch) {
      if (patch && typeof this[key] === 'object' && this[key] !== null && !Array.isArray(patch)) {
        Object.assign(this[key], patch);
      } else {
        this[key] = patch;
      }
      this.bus.emit('state:' + key, this[key]);
      this.bus.emit('state:changed', { key });
    }
  }

  App2.core.Store = Store;
})(window.App2);
