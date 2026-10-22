/**
 * Tool options panel: renders the active tool's option schema
 * (see tools/tool.js) as sliders / selects / toggles / buttons, followed by
 * any custom UI the tool adds via buildExtraUI().
 */
(function (App2) {
  'use strict';

  const { h, slider, select, toggle, button } = App2.ui;

  App2.ui.ToolOptions = function (app, root) {
    let uiBusy = 0; // >0 while a control is writing a value (prevents re-render loops)

    const withBusy = (fn) => (v) => {
      uiBusy++;
      try {
        fn(v);
      } finally {
        uiBusy--;
      }
    };

    function render() {
      const tool = app.tools.active;
      root.innerHTML = '';
      if (!tool) return;
      root.appendChild(
        h(
          'div',
          { class: 'tool-head' },
          h('span', { class: 'tool-head-icon', html: App2.ui.icon(tool.icon, 20) }),
          h('div', null, h('div', { class: 'tool-head-name' }, tool.name, tool.shortcut ? h('kbd', null, tool.shortcut.toUpperCase()) : null), tool.description ? h('div', { class: 'tool-head-desc' }, tool.description) : null)
        )
      );
      const opts = tool.getOptions();
      const box = h('div', { class: 'controls' });
      for (const o of opts) {
        const get = o.get || (() => tool.settings[o.key]);
        const set = withBusy(o.set ? o.set : (v) => tool.setSetting(o.key, v, 'ui'));
        let el = null;
        switch (o.type) {
          case 'range':
            el = slider({ label: o.label, min: o.min, max: o.max, step: o.step, value: get(), format: o.format, onInput: set });
            break;
          case 'select':
            el = select({ label: o.label, choices: o.choices, value: get(), onChange: set });
            break;
          case 'toggle':
            el = toggle({ label: o.label, value: get(), onChange: set });
            break;
          case 'button':
            el = button(o.label, () => o.action(), o.primary ? 'primary' : '');
            if (o.disabled) el.disabled = true;
            break;
        }
        if (el) box.appendChild(el);
      }
      root.appendChild(box);
      const extra = h('div', { class: 'tool-extra' });
      tool.buildExtraUI(extra);
      if (extra.childNodes.length) root.appendChild(extra);
    }

    app.bus.on('tool:changed', render);
    app.bus.on('tool:setting', (e) => {
      if (e.source !== 'ui' && !uiBusy && e.tool === app.tools.active) render();
    });
    const rerenderIf = (ids) => () => {
      if (!uiBusy && app.tools.active && ids.indexOf(app.tools.active.id) >= 0) render();
    };
    app.bus.on('state:selection', rerenderIf(['select']));
    app.bus.on('state:pixel', rerenderIf(['pixel']));
    render();
  };

  /**
   * Gradient editor: a preview bar with draggable color stops.
   *   click bar      → add a stop (color interpolated)
   *   drag a stop    → move it
   *   select a stop  → edit its color / delete it
   */
  class GradientEditor {
    constructor(app, container) {
      this.app = app;
      this.sel = 0;
      this.bar = h('div', { class: 'grad-bar' });
      this.stopsEl = h('div', { class: 'grad-stops' });
      this.color = h('input', { type: 'color', class: 'grad-color', 'aria-label': 'Stop color' });
      this.pos = h('span', { class: 'ctl-value' });
      const usePrimary = button('Use primary', () => this._setColor(app.state.primary), 'small');
      const del = button('Delete stop', () => this._delete(), 'small');
      const rev = button('Reverse', () => this._reverse(), 'small');
      const presets = h('div', { class: 'grad-presets' });
      for (const p of GradientEditor.PRESETS) {
        const b = h('button', { class: 'grad-preset', type: 'button', 'aria-label': 'Gradient preset', style: { background: this._css(p) } });
        b.addEventListener('click', () => this._setStops(p.map((s) => Object.assign({}, s))));
        presets.appendChild(b);
      }
      this.color.addEventListener('input', () => this._setColor(this.color.value));
      container.appendChild(h('div', { class: 'subhead' }, 'Gradient stops — click the bar to add'));
      container.appendChild(h('div', { class: 'grad-editor' }, this.bar, this.stopsEl));
      container.appendChild(h('div', { class: 'grad-row' }, this.color, this.pos, usePrimary, del, rev));
      container.appendChild(h('div', { class: 'subhead' }, 'Presets'));
      container.appendChild(presets);
      this.bar.addEventListener('click', (e) => this._add(e));
      this.render();
    }

    get stops() {
      return this.app.state.gradient.stops;
    }

    _css(stops) {
      const s = stops.slice().sort((a, b) => a.pos - b.pos);
      return 'linear-gradient(90deg,' + s.map((x) => x.color + ' ' + (x.pos * 100).toFixed(1) + '%').join(',') + ')';
    }

    _commit() {
      this.app.state.update('gradient', { stops: this.stops });
      this.render();
    }

    _setStops(stops) {
      this.app.state.gradient.stops = stops;
      this.sel = 0;
      this._commit();
    }

    _setColor(hex) {
      const s = this.stops[this.sel];
      if (!s) return;
      s.color = hex;
      this._commit();
    }

    _delete() {
      if (this.stops.length <= 2) {
        this.app.toast('A gradient needs at least two stops.', 'warn');
        return;
      }
      this.stops.splice(this.sel, 1);
      this.sel = 0;
      this._commit();
    }

    _reverse() {
      for (const s of this.stops) s.pos = 1 - s.pos;
      this._commit();
    }

    _colorAt(pos) {
      const C = App2.core.Color;
      const s = this.stops.slice().sort((a, b) => a.pos - b.pos);
      if (pos <= s[0].pos) return s[0].color;
      for (let i = 1; i < s.length; i++) {
        if (pos <= s[i].pos) {
          const t = (pos - s[i - 1].pos) / Math.max(1e-6, s[i].pos - s[i - 1].pos);
          return C.rgbToHex(C.mixRgb(C.hexToRgb(s[i - 1].color), C.hexToRgb(s[i].color), t));
        }
      }
      return s[s.length - 1].color;
    }

    _add(e) {
      const r = this.bar.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
      this.stops.push({ pos, color: this._colorAt(pos) });
      this.sel = this.stops.length - 1;
      this._commit();
    }

    render() {
      this.bar.style.background = this._css(this.stops);
      this.stopsEl.innerHTML = '';
      this.stops.forEach((s, i) => {
        const el = h('button', { class: 'grad-stop' + (i === this.sel ? ' selected' : ''), type: 'button', 'aria-label': 'Stop at ' + Math.round(s.pos * 100) + '%', style: { left: s.pos * 100 + '%', background: s.color } });
        el.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          this.sel = i;
          el.setPointerCapture(e.pointerId);
          const r = this.stopsEl.getBoundingClientRect();
          const move = (ev) => {
            s.pos = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
            el.style.left = s.pos * 100 + '%';
            this.bar.style.background = this._css(this.stops);
            this.pos.textContent = Math.round(s.pos * 100) + '%';
          };
          const up = () => {
            el.removeEventListener('pointermove', move);
            el.removeEventListener('pointerup', up);
            el.removeEventListener('pointercancel', up);
            this._commit();
          };
          el.addEventListener('pointermove', move);
          el.addEventListener('pointerup', up);
          el.addEventListener('pointercancel', up);
          // Update the selection highlight without rebuilding (keeps pointer capture).
          Array.from(this.stopsEl.children).forEach((c) => c.classList.toggle('selected', c === el));
          this.color.value = s.color;
          this.pos.textContent = Math.round(s.pos * 100) + '%';
        });
        this.stopsEl.appendChild(el);
      });
      const s = this.stops[this.sel];
      if (s) {
        this.color.value = s.color;
        this.pos.textContent = Math.round(s.pos * 100) + '%';
      }
    }
  }

  GradientEditor.PRESETS = [
    [{ pos: 0, color: '#ff5f6d' }, { pos: 0.5, color: '#ffc371' }, { pos: 1, color: '#47cacc' }],
    [{ pos: 0, color: '#0f2027' }, { pos: 0.5, color: '#2c5364' }, { pos: 1, color: '#a8e6cf' }],
    [{ pos: 0, color: '#12c2e9' }, { pos: 0.5, color: '#c471ed' }, { pos: 1, color: '#f64f59' }],
    [{ pos: 0, color: '#000000' }, { pos: 1, color: '#ffffff' }],
    [{ pos: 0, color: '#ff0000' }, { pos: 0.17, color: '#ffff00' }, { pos: 0.33, color: '#00ff00' }, { pos: 0.5, color: '#00ffff' }, { pos: 0.67, color: '#0000ff' }, { pos: 0.83, color: '#ff00ff' }, { pos: 1, color: '#ff0000' }],
    [{ pos: 0, color: '#fceabb' }, { pos: 1, color: '#f8b500' }],
  ];

  App2.ui.GradientEditor = GradientEditor;
})(window.App2);
