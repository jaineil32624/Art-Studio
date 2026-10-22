/**
 * Left tool bar: one icon button per tool (grouped), with tooltips that
 * show the keyboard shortcut, plus quick primary/secondary color swatches.
 */
(function (App2) {
  'use strict';

  const { h } = App2.ui;

  App2.ui.Toolbar = function (app, root) {
    const buttons = new Map();
    let lastGroup = null;
    const list = h('div', { class: 'tool-list', role: 'toolbar', 'aria-label': 'Tools', 'aria-orientation': 'vertical' });

    for (const tool of app.tools.list) {
      if (lastGroup && tool.group !== lastGroup) list.appendChild(h('div', { class: 'tool-sep' }));
      lastGroup = tool.group;
      const tip = tool.name + (tool.shortcut ? '  (' + tool.shortcut.toUpperCase() + ')' : '');
      const btn = h('button', {
        class: 'tool-btn',
        type: 'button',
        'aria-label': tip,
        'data-tip': tip,
        'aria-pressed': 'false',
        html: App2.ui.icon(tool.icon, 22),
        onclick: () => app.tools.setActive(tool.id),
      });
      buttons.set(tool.id, btn);
      list.appendChild(btn);
    }

    const primary = h('button', { class: 'mini-swatch primary', type: 'button', 'aria-label': 'Primary color', 'data-tip': 'Primary color' });
    const secondary = h('button', { class: 'mini-swatch secondary', type: 'button', 'aria-label': 'Secondary color (X swaps)', 'data-tip': 'Secondary (X swaps)', onclick: () => app.state.swapColors() });
    const swatches = h('div', { class: 'mini-swatches' }, secondary, primary);
    primary.addEventListener('click', () => app.ui.openPanel && app.ui.openPanel('color'));

    root.appendChild(list);
    root.appendChild(swatches);

    const sync = () => {
      for (const [id, b] of buttons) {
        const on = app.tools.active && app.tools.active.id === id;
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      }
    };
    const syncColors = () => {
      primary.style.background = app.state.primary;
      secondary.style.background = app.state.secondary;
    };
    app.bus.on('tool:changed', () => {
      sync();
      const b = buttons.get(app.tools.active.id);
      if (b && b.scrollIntoView) b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
    app.bus.on('color:changed', syncColors);
    sync();
    syncColors();
  };
})(window.App2);
