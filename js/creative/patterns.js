/**
 * Pattern library. A pattern is a small tile canvas used by the Fill bucket
 * ("Fill with: Active pattern"), the Pattern Brush and Shape fills.
 *
 * Patterns can come from:
 *   - built-in generators (checker, stripes, dots, grid, zigzag, bricks …)
 *   - a selection on the canvas (Select tool → "Make pattern")
 *   - the texture generator ("Save as pattern")
 */
(function (App2) {
  'use strict';

  const { math: M } = App2.core;
  const MAX_TILE = 1024;

  const library = [];
  let activeId = null;
  let counter = 0;
  let busRef = null;

  /** Generators: draw(ctx, size, a, b). */
  const GENERATORS = {
    checker: {
      name: 'Checker',
      draw(g, s, a, b) {
        g.fillStyle = b;
        g.fillRect(0, 0, s, s);
        g.fillStyle = a;
        g.fillRect(0, 0, s / 2, s / 2);
        g.fillRect(s / 2, s / 2, s / 2, s / 2);
      },
    },
    stripes: {
      name: 'Diagonal stripes',
      draw(g, s, a, b) {
        g.fillStyle = b;
        g.fillRect(0, 0, s, s);
        g.strokeStyle = a;
        g.lineWidth = s / 4;
        g.beginPath();
        for (let k = -1; k <= 1; k++) {
          g.moveTo(k * s - s / 2, s + s / 2);
          g.lineTo(k * s + s + s / 2, -s / 2);
        }
        g.stroke();
      },
    },
    dots: {
      name: 'Polka dots',
      draw(g, s, a, b) {
        g.fillStyle = b;
        g.fillRect(0, 0, s, s);
        g.fillStyle = a;
        const r = s * 0.16;
        for (const [x, y] of [[0.25, 0.25], [0.75, 0.75]]) {
          g.beginPath();
          g.arc(x * s, y * s, r, 0, Math.PI * 2);
          g.fill();
        }
      },
    },
    grid: {
      name: 'Grid',
      draw(g, s, a, b) {
        g.fillStyle = b;
        g.fillRect(0, 0, s, s);
        g.fillStyle = a;
        const w = Math.max(1, Math.round(s / 12));
        g.fillRect(0, 0, s, w);
        g.fillRect(0, 0, w, s);
      },
    },
    zigzag: {
      name: 'Zigzag',
      draw(g, s, a, b) {
        g.fillStyle = b;
        g.fillRect(0, 0, s, s);
        g.strokeStyle = a;
        g.lineWidth = s / 8;
        g.lineJoin = 'miter';
        for (const y0 of [0.3, 0.8]) {
          g.beginPath();
          g.moveTo(-s * 0.25, y0 * s + s * 0.12);
          for (let i = 0; i <= 4; i++) g.lineTo(i * s * 0.5 - s * 0.25 + s * 0.25, y0 * s + (i % 2 ? s * 0.12 : -s * 0.12));
          g.stroke();
        }
      },
    },
    bricks: {
      name: 'Bricks',
      draw(g, s, a, b) {
        g.fillStyle = a;
        g.fillRect(0, 0, s, s);
        g.fillStyle = b;
        const m = Math.max(1, Math.round(s / 16));
        g.fillRect(0, s / 2 - m / 2, s, m);
        g.fillRect(0, s - m / 2, s, m);
        g.fillRect(0, -m / 2, s, m);
        g.fillRect(s / 2 - m / 2, 0, m, s / 2);
        g.fillRect(0, s / 2, m / 2, s / 2);
        g.fillRect(s - m / 2, s / 2, m / 2, s / 2);
      },
    },
    hearts: {
      name: 'Hearts',
      draw(g, s, a, b) {
        g.fillStyle = b;
        g.fillRect(0, 0, s, s);
        g.fillStyle = a;
        const heart = (x, y, r) => {
          g.beginPath();
          g.moveTo(x, y + r * 0.8);
          g.bezierCurveTo(x - r * 1.1, y, x - r * 0.7, y - r * 0.95, x, y - r * 0.4);
          g.bezierCurveTo(x + r * 0.7, y - r * 0.95, x + r * 1.1, y, x, y + r * 0.8);
          g.fill();
        };
        heart(s * 0.25, s * 0.27, s * 0.16);
        heart(s * 0.75, s * 0.77, s * 0.16);
      },
    },
  };

  function notify() {
    if (busRef) busRef.emit('pattern:changed');
  }

  /** Add a tile canvas to the library and make it active. Returns its id. */
  function add(canvas, name) {
    const id = 'pat-' + ++counter;
    library.push({ id, name: name || 'Pattern ' + counter, canvas });
    activeId = id;
    notify();
    return id;
  }

  function generate(type, size, colorA, colorB) {
    const gen = GENERATORS[type] || GENERATORS.checker;
    const s = M.clamp(size | 0, 4, 512);
    const c = document.createElement('canvas');
    c.width = c.height = s;
    gen.draw(c.getContext('2d'), s, colorA, colorB);
    return c;
  }

  /** Copy the visible pixels inside the current selection into a new pattern. */
  function fromSelection(app) {
    const sel = app.state.selection;
    if (!sel || sel.w < 1 || sel.h < 1) {
      app.toast('Make a selection first (Select tool, R).', 'warn');
      return null;
    }
    const scale = Math.min(1, MAX_TILE / Math.max(sel.w, sel.h));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(sel.w * scale));
    c.height = Math.max(1, Math.round(sel.h * scale));
    app.doc.composite(c.getContext('2d'), sel, { scale });
    const id = add(c, 'Selection ' + c.width + '×' + c.height);
    app.toast('Pattern created from selection — use it with the Fill bucket or Pattern Brush.');
    return id;
  }

  App2.creative.patterns = {
    GENERATORS,
    init(bus) {
      busRef = bus;
      if (!library.length) {
        add(generate('checker', 32, '#2b2d42', '#edf2f4'), 'Checker');
        add(generate('stripes', 32, '#e63946', '#f1faee'), 'Candy stripes');
        add(generate('dots', 32, '#457b9d', '#f1faee'), 'Polka dots');
        add(generate('bricks', 48, '#b5654a', '#e9dccd'), 'Bricks');
        activeId = library[0].id;
      }
    },
    list: () => library.slice(),
    add,
    generate,
    fromSelection,
    remove(id) {
      const i = library.findIndex((p) => p.id === id);
      if (i >= 0) library.splice(i, 1);
      if (activeId === id) activeId = library.length ? library[0].id : null;
      notify();
    },
    setActive(id) {
      activeId = id;
      notify();
    },
    activeId: () => activeId,
    /** Active pattern tile canvas (falls back to a generated checker). */
    activeTile() {
      const p = library.find((x) => x.id === activeId) || library[0];
      return p ? p.canvas : generate('checker', 32, '#000000', '#ffffff');
    },
  };
})(window.App2);
