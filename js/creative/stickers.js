/**
 * Built-in sticker library: emoji (rendered with the system emoji font) and
 * vector stickers drawn with canvas paths (optionally tinted with the
 * primary color). All stickers render to an offscreen canvas that the
 * Sticker/Place tool can transform and commit.
 */
(function (App2) {
  'use strict';

  const SIZE = 256;

  const EMOJI = ['⭐', '❤️', '😀', '😎', '🥳', '😺', '🐶', '🦊', '🐼', '🦄', '🐝', '🦋', '🌸', '🌻', '🌈', '☀️', '🌙', '⚡', '🔥', '❄️', '🍀', '🍓', '🍕', '🎈', '🎨', '🎵', '💎', '👑', '🚀', '✨', '💥', '👍'];

  /** Vector stickers: draw(ctx, s, tint) centered at (0,0), radius s. */
  const VECTOR = {
    heart: {
      name: 'Heart',
      color: '#ff4d6d',
      draw(ctx, s, c) {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.moveTo(0, s * 0.8);
        ctx.bezierCurveTo(-s * 1.1, s * 0.05, -s * 0.75, -s * 0.95, 0, -s * 0.4);
        ctx.bezierCurveTo(s * 0.75, -s * 0.95, s * 1.1, s * 0.05, 0, s * 0.8);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.ellipse(-s * 0.42, -s * 0.38, s * 0.16, s * 0.1, -0.6, 0, Math.PI * 2);
        ctx.fill();
      },
    },
    star: {
      name: 'Star',
      color: '#ffc93c',
      draw(ctx, s, c) {
        ctx.fillStyle = c;
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = s * 0.05;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const r = i % 2 ? s * 0.45 : s * 0.95;
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
          else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      },
    },
    cloud: {
      name: 'Cloud',
      color: '#e8f1ff',
      draw(ctx, s, c) {
        ctx.fillStyle = c;
        ctx.strokeStyle = 'rgba(40,60,90,0.35)';
        ctx.lineWidth = s * 0.04;
        ctx.beginPath();
        ctx.arc(-s * 0.45, s * 0.1, s * 0.35, Math.PI * 0.5, Math.PI * 1.5);
        ctx.arc(-s * 0.1, -s * 0.2, s * 0.42, Math.PI, Math.PI * 1.85);
        ctx.arc(s * 0.4, -s * 0.02, s * 0.38, Math.PI * 1.3, Math.PI * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      },
    },
    bolt: {
      name: 'Lightning',
      color: '#ffd23f',
      draw(ctx, s, c) {
        ctx.fillStyle = c;
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.lineWidth = s * 0.04;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(s * 0.15, -s);
        ctx.lineTo(-s * 0.55, s * 0.1);
        ctx.lineTo(-s * 0.05, s * 0.1);
        ctx.lineTo(-s * 0.2, s);
        ctx.lineTo(s * 0.55, -s * 0.15);
        ctx.lineTo(s * 0.05, -s * 0.15);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      },
    },
    smile: {
      name: 'Smiley',
      color: '#ffd166',
      draw(ctx, s, c) {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.92, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2b2d42';
        ctx.beginPath();
        ctx.ellipse(-s * 0.3, -s * 0.22, s * 0.09, s * 0.15, 0, 0, Math.PI * 2);
        ctx.ellipse(s * 0.3, -s * 0.22, s * 0.09, s * 0.15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#2b2d42';
        ctx.lineWidth = s * 0.08;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(0, s * 0.05, s * 0.5, Math.PI * 0.18, Math.PI * 0.82);
        ctx.stroke();
      },
    },
    bubble: {
      name: 'Speech bubble',
      color: '#ffffff',
      draw(ctx, s, c) {
        ctx.fillStyle = c;
        ctx.strokeStyle = '#2b2d42';
        ctx.lineWidth = s * 0.06;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.ellipse(0, -s * 0.15, s * 0.9, s * 0.6, 0, 0, Math.PI * 2);
        ctx.moveTo(-s * 0.35, s * 0.35);
        ctx.lineTo(-s * 0.55, s * 0.85);
        ctx.lineTo(-s * 0.05, s * 0.42);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.ellipse(0, -s * 0.15, s * 0.86, s * 0.56, 0, 0, Math.PI * 2);
        ctx.fill();
      },
    },
    arrow: {
      name: 'Arrow',
      color: '#4cc9f0',
      draw(ctx, s, c) {
        ctx.fillStyle = c;
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.lineWidth = s * 0.04;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-s * 0.9, -s * 0.22);
        ctx.lineTo(s * 0.2, -s * 0.22);
        ctx.lineTo(s * 0.2, -s * 0.6);
        ctx.lineTo(s * 0.92, 0);
        ctx.lineTo(s * 0.2, s * 0.6);
        ctx.lineTo(s * 0.2, s * 0.22);
        ctx.lineTo(-s * 0.9, s * 0.22);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      },
    },
    flower: {
      name: 'Flower',
      color: '#f78fb3',
      draw(ctx, s, c) {
        ctx.fillStyle = c;
        for (let i = 0; i < 6; i++) {
          ctx.save();
          ctx.rotate((i * Math.PI) / 3);
          ctx.beginPath();
          ctx.ellipse(0, -s * 0.5, s * 0.26, s * 0.45, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        ctx.fillStyle = '#ffd23f';
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.26, 0, Math.PI * 2);
        ctx.fill();
      },
    },
    sparkle: {
      name: 'Sparkle',
      color: '#a5f3fc',
      draw(ctx, s, c) {
        ctx.fillStyle = c;
        const star = (x, y, r) => {
          ctx.beginPath();
          ctx.moveTo(x, y - r);
          ctx.quadraticCurveTo(x, y, x + r, y);
          ctx.quadraticCurveTo(x, y, x, y + r);
          ctx.quadraticCurveTo(x, y, x - r, y);
          ctx.quadraticCurveTo(x, y, x, y - r);
          ctx.fill();
        };
        star(-s * 0.15, s * 0.1, s * 0.8);
        star(s * 0.6, -s * 0.55, s * 0.35);
        star(s * 0.55, s * 0.6, s * 0.22);
      },
    },
    crown: {
      name: 'Crown',
      color: '#f9c74f',
      draw(ctx, s, c) {
        ctx.fillStyle = c;
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = s * 0.04;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-s * 0.85, s * 0.55);
        ctx.lineTo(-s * 0.9, -s * 0.45);
        ctx.lineTo(-s * 0.45, s * 0.05);
        ctx.lineTo(0, -s * 0.7);
        ctx.lineTo(s * 0.45, s * 0.05);
        ctx.lineTo(s * 0.9, -s * 0.45);
        ctx.lineTo(s * 0.85, s * 0.55);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#e63946';
        for (const x of [-0.5, 0, 0.5]) {
          ctx.beginPath();
          ctx.arc(x * s, s * 0.32, s * 0.09, 0, Math.PI * 2);
          ctx.fill();
        }
      },
    },
    note: {
      name: 'Music note',
      color: '#7b2cbf',
      draw(ctx, s, c) {
        ctx.fillStyle = c;
        ctx.strokeStyle = c;
        ctx.lineWidth = s * 0.1;
        ctx.beginPath();
        ctx.ellipse(-s * 0.35, s * 0.55, s * 0.28, s * 0.2, -0.4, 0, Math.PI * 2);
        ctx.ellipse(s * 0.45, s * 0.35, s * 0.28, s * 0.2, -0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-s * 0.1, s * 0.5);
        ctx.lineTo(-s * 0.1, -s * 0.7);
        ctx.lineTo(s * 0.7, -s * 0.9);
        ctx.lineTo(s * 0.7, s * 0.3);
        ctx.stroke();
      },
    },
    sun: {
      name: 'Sun',
      color: '#ff9f1c',
      draw(ctx, s, c) {
        ctx.fillStyle = c;
        ctx.strokeStyle = c;
        ctx.lineWidth = s * 0.09;
        ctx.lineCap = 'round';
        for (let i = 0; i < 12; i++) {
          const a = (i * Math.PI) / 6;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * s * 0.6, Math.sin(a) * s * 0.6);
          ctx.lineTo(Math.cos(a) * s * 0.92, Math.sin(a) * s * 0.92);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.45, 0, Math.PI * 2);
        ctx.fill();
      },
    },
  };

  const LIST = [];
  for (const id of Object.keys(VECTOR)) LIST.push({ id: 'vec-' + id, name: VECTOR[id].name, kind: 'vector' });
  EMOJI.forEach((e, i) => LIST.push({ id: i === 0 ? 'emoji-star' : 'emoji-' + i, name: 'Emoji ' + e, kind: 'emoji', char: e }));

  const cache = new Map();

  /**
   * Render a sticker to a canvas. opts.tint (hex) recolors vector stickers.
   * opts.size defaults to 256.
   */
  function render(id, opts) {
    opts = opts || {};
    const size = opts.size || SIZE;
    const item = LIST.find((s) => s.id === id);
    if (!item) return null;
    const key = id + '|' + (opts.tint || '') + '|' + size;
    if (cache.has(key)) return cache.get(key);
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    if (item.kind === 'emoji') {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = Math.round(size * 0.8) + 'px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
      ctx.fillText(item.char, size / 2, size * 0.54);
    } else {
      const v = VECTOR[id.slice(4)];
      ctx.translate(size / 2, size / 2);
      v.draw(ctx, size * 0.46, opts.tint || v.color);
    }
    if (cache.size > 80) cache.clear();
    cache.set(key, c);
    return c;
  }

  App2.creative.stickers = {
    list: () => LIST.slice(),
    render,
    name: (id) => {
      const s = LIST.find((x) => x.id === id);
      return s ? s.name : 'Sticker';
    },
    /** Register a custom vector sticker. */
    registerVector(id, name, color, draw) {
      VECTOR[id] = { name, color, draw };
      LIST.push({ id: 'vec-' + id, name, kind: 'vector' });
    },
  };
})(window.App2);
