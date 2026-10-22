/**
 * Color panel: HSV picker (saturation/value square + hue strip), hex input,
 * primary/secondary swatches with swap, eyedropper shortcut and recent
 * colors. The picker edits whichever swatch is selected (primary by default).
 */
(function (App2) {
  'use strict';

  const { h, iconButton } = App2.ui;
  const { Color, math: M } = App2.core;

  App2.ui.ColorPanel = function (app, root) {
    let target = 'primary';
    let hsv = Color.hexToHsv(app.state.primary);
    let internal = false;

    const sv = h('canvas', { class: 'sv-canvas', 'aria-label': 'Saturation and brightness' });
    const svCursor = h('div', { class: 'sv-cursor' });
    const svWrap = h('div', { class: 'sv-wrap' }, sv, svCursor);
    const hue = h('canvas', { class: 'hue-canvas', 'aria-label': 'Hue' });
    const hueCursor = h('div', { class: 'hue-cursor' });
    const hueWrap = h('div', { class: 'hue-wrap' }, hue, hueCursor);

    const primarySw = h('button', { class: 'swatch-big primary', type: 'button', 'aria-label': 'Edit primary color', 'data-tip': 'Primary' });
    const secondarySw = h('button', { class: 'swatch-big secondary', type: 'button', 'aria-label': 'Edit secondary color', 'data-tip': 'Secondary' });
    const swapBtn = iconButton('swap', 'Swap colors (X)', () => app.state.swapColors(), 'small');
    const hex = h('input', { class: 'hex-input', type: 'text', maxlength: '7', spellcheck: 'false', 'aria-label': 'Hex color' });
    const pickBtn = iconButton('eyedropper', 'Eyedropper (I) — or hold Alt while painting', () => app.tools.setActive('eyedropper'), 'small');
    const recent = h('div', { class: 'recent-colors', 'aria-label': 'Recent colors' });

    root.appendChild(svWrap);
    root.appendChild(hueWrap);
    root.appendChild(h('div', { class: 'color-row' }, h('div', { class: 'swatch-pair' }, secondarySw, primarySw), swapBtn, hex, pickBtn));
    root.appendChild(h('div', { class: 'subhead' }, 'Recent'));
    root.appendChild(recent);

    function sizeCanvas(c) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(10, c.clientWidth), hh = Math.max(10, c.clientHeight);
      if (c.width !== Math.round(w * dpr) || c.height !== Math.round(hh * dpr)) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(hh * dpr);
      }
    }

    function drawSV() {
      sizeCanvas(sv);
      const g = sv.getContext('2d');
      const W = sv.width, H = sv.height;
      g.fillStyle = Color.hsvToHex(hsv.h, 1, 1);
      g.fillRect(0, 0, W, H);
      const wg = g.createLinearGradient(0, 0, W, 0);
      wg.addColorStop(0, 'rgba(255,255,255,1)');
      wg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = wg;
      g.fillRect(0, 0, W, H);
      const bg = g.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, 'rgba(0,0,0,0)');
      bg.addColorStop(1, 'rgba(0,0,0,1)');
      g.fillStyle = bg;
      g.fillRect(0, 0, W, H);
    }

    function drawHue() {
      sizeCanvas(hue);
      const g = hue.getContext('2d');
      const grad = g.createLinearGradient(0, 0, hue.width, 0);
      for (let i = 0; i <= 6; i++) grad.addColorStop(i / 6, Color.hsvToHex(i * 60, 1, 1));
      g.fillStyle = grad;
      g.fillRect(0, 0, hue.width, hue.height);
    }

    function placeCursors() {
      svCursor.style.left = hsv.s * 100 + '%';
      svCursor.style.top = (1 - hsv.v) * 100 + '%';
      svCursor.style.background = Color.hsvToHex(hsv.h, hsv.s, hsv.v);
      hueCursor.style.left = (hsv.h / 360) * 100 + '%';
    }

    function syncSwatches() {
      primarySw.style.background = app.state.primary;
      secondarySw.style.background = app.state.secondary;
      primarySw.classList.toggle('editing', target === 'primary');
      secondarySw.classList.toggle('editing', target === 'secondary');
      if (document.activeElement !== hex) hex.value = app.state[target];
    }

    function commitHsv() {
      internal = true;
      app.state.setColor(Color.hsvToHex(hsv.h, hsv.s, hsv.v), target);
      internal = false;
      placeCursors();
      syncSwatches();
    }

    function drag(el, onMove) {
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        el.setPointerCapture(e.pointerId);
        onMove(e);
        const move = (ev) => onMove(ev);
        const up = () => {
          el.removeEventListener('pointermove', move);
          el.removeEventListener('pointerup', up);
          el.removeEventListener('pointercancel', up);
          app.state.addRecent(app.state[target]);
        };
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerup', up);
        el.addEventListener('pointercancel', up);
      });
    }

    drag(svWrap, (e) => {
      const r = svWrap.getBoundingClientRect();
      hsv.s = M.clamp((e.clientX - r.left) / r.width, 0, 1);
      hsv.v = 1 - M.clamp((e.clientY - r.top) / r.height, 0, 1);
      commitHsv();
    });
    drag(hueWrap, (e) => {
      const r = hueWrap.getBoundingClientRect();
      hsv.h = M.clamp((e.clientX - r.left) / r.width, 0, 0.9999) * 360;
      drawSV();
      commitHsv();
    });

    hex.addEventListener('change', () => {
      const v = Color.normalizeHex(hex.value);
      if (!v) {
        hex.value = app.state[target];
        app.toast('Enter a hex color like #ff8800', 'warn');
        return;
      }
      app.state.setColor(v, target);
      app.state.addRecent(v);
    });
    hex.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') hex.blur();
    });

    const setTarget = (t) => {
      target = t;
      hsv = Color.hexToHsv(app.state[target]);
      drawSV();
      placeCursors();
      syncSwatches();
    };
    primarySw.addEventListener('click', () => setTarget('primary'));
    secondarySw.addEventListener('click', () => setTarget('secondary'));

    function renderRecent() {
      recent.innerHTML = '';
      for (const c of app.state.recent) {
        recent.appendChild(
          h('button', {
            class: 'swatch',
            type: 'button',
            style: { background: c },
            'aria-label': 'Use ' + c,
            'data-tip': c + ' (right-click: secondary)',
            onclick: () => app.state.setColor(c, target),
            oncontextmenu: (e) => {
              e.preventDefault();
              app.state.setColor(c, 'secondary');
            },
          })
        );
      }
    }

    app.bus.on('color:changed', (e) => {
      if (!internal && e.which === target) {
        const n = Color.hexToHsv(e.hex);
        // Keep hue when the new color is gray (hue undefined).
        if (n.s < 0.001 || n.v < 0.001) n.h = hsv.h;
        hsv = n;
        drawSV();
        placeCursors();
      }
      syncSwatches();
    });
    app.bus.on('recent:changed', renderRecent);

    const redraw = () => {
      drawSV();
      drawHue();
      placeCursors();
    };
    if (window.ResizeObserver) new ResizeObserver(redraw).observe(svWrap);
    window.addEventListener('resize', redraw);
    requestAnimationFrame(redraw);
    syncSwatches();
    renderRecent();
  };
})(window.App2);
