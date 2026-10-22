/**
 * DOM helpers and reusable controls (sliders, selects, toggles, toasts,
 * collapsible sections, modal dialogs).
 */
(function (App2) {
  'use strict';

  /** h('div', {class:'x', onclick: fn}, child, 'text', [children]) */
  function h(tag, attrs) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const k of Object.keys(attrs)) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'text') el.textContent = v;
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
      }
    }
    for (let i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }

  function append(el, child) {
    if (child == null || child === false) return;
    if (Array.isArray(child)) child.forEach((c) => append(el, c));
    else if (child instanceof Node) el.appendChild(child);
    else el.appendChild(document.createTextNode(String(child)));
  }

  function formatValue(v, format) {
    switch (format) {
      case 'pct':
        return Math.round(v * 100) + '%';
      case 'px':
        return (Math.round(v * 10) / 10) + 'px';
      case 'deg':
        return Math.round(v) + '°';
      default:
        return Math.abs(v) < 1 && v !== 0 ? String(Math.round(v * 1000) / 1000) : String(Math.round(v * 100) / 100);
    }
  }

  /** Icon button with tooltip. */
  function iconButton(icon, label, onClick, cls) {
    return h('button', {
      class: 'icon-btn ' + (cls || ''),
      type: 'button',
      'aria-label': label,
      'data-tip': label,
      html: App2.ui.icon(icon),
      onclick: onClick,
    });
  }

  /**
   * Range slider with label and live value.
   * opts: { label, min, max, step, value, format, onInput(v), onChange(v) }
   */
  function slider(opts) {
    const val = h('span', { class: 'ctl-value' }, formatValue(opts.value, opts.format));
    const input = h('input', { type: 'range', min: opts.min, max: opts.max, step: opts.step || 1, value: opts.value, 'aria-label': opts.label });
    const fill = () => {
      const pct = ((parseFloat(input.value) - opts.min) / (opts.max - opts.min)) * 100;
      input.style.setProperty('--fill', pct + '%');
    };
    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      val.textContent = formatValue(v, opts.format);
      fill();
      if (opts.onInput) opts.onInput(v);
    });
    input.addEventListener('change', () => opts.onChange && opts.onChange(parseFloat(input.value)));
    fill();
    const el = h('label', { class: 'ctl ctl-range' }, h('span', { class: 'ctl-row' }, h('span', { class: 'ctl-label' }, opts.label), val), input);
    el.set = (v) => {
      input.value = v;
      val.textContent = formatValue(v, opts.format);
      fill();
    };
    el.input = input;
    return el;
  }

  function select(opts) {
    const sel = h('select', { 'aria-label': opts.label, onchange: () => opts.onChange && opts.onChange(sel.value) });
    for (const [value, text] of opts.choices) {
      const o = h('option', { value }, text);
      if (String(value) === String(opts.value)) o.selected = true;
      sel.appendChild(o);
    }
    const el = h('label', { class: 'ctl ctl-select' }, opts.label ? h('span', { class: 'ctl-label' }, opts.label) : null, sel);
    el.set = (v) => (sel.value = v);
    el.input = sel;
    return el;
  }

  function toggle(opts) {
    const input = h('input', { type: 'checkbox', onchange: () => opts.onChange && opts.onChange(input.checked) });
    input.checked = !!opts.value;
    const el = h('label', { class: 'ctl ctl-toggle' }, input, h('span', { class: 'switch' }), h('span', { class: 'ctl-label' }, opts.label));
    el.set = (v) => (input.checked = !!v);
    el.input = input;
    return el;
  }

  function button(label, onClick, cls, icon) {
    return h('button', { class: 'btn ' + (cls || ''), type: 'button', onclick: onClick, html: (icon ? App2.ui.icon(icon, 16) : '') + '<span>' + escapeHtml(label) + '</span>' });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  /** Collapsible panel section. */
  function section(title, icon, body, opts) {
    opts = opts || {};
    const head = h('button', { class: 'section-head', type: 'button', 'aria-expanded': opts.collapsed ? 'false' : 'true', html: App2.ui.icon(icon, 16) + '<span>' + escapeHtml(title) + '</span>' + App2.ui.icon('chevron', 14) });
    const wrap = h('section', { class: 'panel-section' + (opts.collapsed ? ' collapsed' : ''), id: opts.id }, head, h('div', { class: 'section-body' }, body));
    head.addEventListener('click', () => {
      wrap.classList.toggle('collapsed');
      head.setAttribute('aria-expanded', wrap.classList.contains('collapsed') ? 'false' : 'true');
    });
    return wrap;
  }

  let toastHost = null;
  /** Show a transient notification. type: info | success | warn | error */
  function toast(msg, type, ms) {
    if (!toastHost) {
      toastHost = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
      document.body.appendChild(toastHost);
    }
    const t = h('div', { class: 'toast toast-' + (type || 'info') }, msg);
    toastHost.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 300);
    }, ms || 2600);
  }

  /** Simple modal dialog. Returns { el, close }. */
  function modal(title, content) {
    const close = () => {
      overlay.remove();
      document.removeEventListener('keydown', onKey, true);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    };
    const box = h(
      'div',
      { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('div', { class: 'modal-head' }, h('h2', null, title), iconButton('x', 'Close', close)),
      h('div', { class: 'modal-body' }, content)
    );
    const overlay = h('div', { class: 'modal-overlay', onclick: (e) => e.target === overlay && close() }, box);
    document.body.appendChild(overlay);
    document.addEventListener('keydown', onKey, true);
    return { el: box, close };
  }

  /**
   * Global tooltips for any element with a data-tip attribute. Rendered as a
   * single fixed-position element so they are never clipped by scrolling
   * containers. Mouse/pen hover only (touch devices skip them).
   */
  function installTooltips() {
    const tip = h('div', { class: 'tooltip', role: 'tooltip' });
    document.body.appendChild(tip);
    let current = null;
    let timer = 0;
    const hide = () => {
      clearTimeout(timer);
      current = null;
      tip.classList.remove('show');
    };
    document.addEventListener('pointerover', (e) => {
      if (e.pointerType === 'touch') return;
      const el = e.target.closest && e.target.closest('[data-tip]');
      if (!el || el === current) return;
      current = el;
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (current !== el || !document.body.contains(el)) return;
        tip.textContent = el.getAttribute('data-tip');
        const r = el.getBoundingClientRect();
        const tw = tip.offsetWidth, th = tip.offsetHeight;
        let x, y;
        if (el.closest('.toolbar') && window.innerWidth > 860) {
          x = r.right + 8;
          y = r.top + r.height / 2 - th / 2;
        } else {
          x = r.left + r.width / 2 - tw / 2;
          y = r.bottom + 6;
          if (y + th > window.innerHeight - 4) y = r.top - th - 6;
        }
        x = Math.max(4, Math.min(window.innerWidth - tw - 4, x));
        tip.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
        tip.classList.add('show');
      }, 350);
    });
    document.addEventListener('pointerout', (e) => {
      if (current && (!e.relatedTarget || !current.contains(e.relatedTarget))) hide();
    });
    document.addEventListener('pointerdown', hide, true);
    window.addEventListener('blur', hide);
  }

  Object.assign(App2.ui, { h, formatValue, iconButton, slider, select, toggle, button, section, toast, modal, escapeHtml, installTooltips });
})(window.App2);
