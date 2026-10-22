/**
 * Keyboard shortcuts and the Help dialog.
 * Tool shortcuts come from each tool's `shortcut` property, so new tools get
 * a key automatically.
 */
(function (App2) {
  'use strict';

  const { h } = App2.ui;

  const GLOBAL_SHORTCUTS = [
    ['Ctrl+Z', 'Undo'],
    ['Ctrl+Y / Ctrl+Shift+Z', 'Redo'],
    ['Ctrl+S', 'Save to browser storage'],
    ['Ctrl+Shift+S', 'Export project file (.app2.json)'],
    ['Ctrl+O', 'Open project file'],
    ['Ctrl+E', 'Export PNG'],
    ['Space + drag', 'Pan (also middle mouse / two fingers)'],
    ['Mouse wheel', 'Zoom at cursor (Shift+wheel pans)'],
    ['+ / −', 'Zoom in / out'],
    ['0', 'Zoom to fit artwork'],
    ['1', 'Zoom 100%'],
    ['[ / ]', 'Brush size down / up'],
    ['Shift+[ / Shift+]', 'Opacity down / up'],
    ['X', 'Swap primary / secondary colors'],
    ['Alt + click', 'Pick color while painting'],
    ['Ctrl+Shift+N', 'New layer'],
    ['Ctrl+J', 'Duplicate layer'],
    ['Ctrl+M', 'Merge layer down'],
    ['Ctrl+D', 'Deselect'],
    ['Delete', 'Clear selected area'],
    ['Enter / Esc', 'Apply / cancel sticker placement'],
    ['Tab', 'Show / hide side panel'],
    ['?', 'This help'],
  ];

  function isTyping(el) {
    if (!el) return false;
    const tag = el.tagName;
    if (tag === 'TEXTAREA' || el.isContentEditable) return true;
    if (tag === 'SELECT') return true;
    if (tag === 'INPUT') {
      const t = (el.type || 'text').toLowerCase();
      return ['text', 'search', 'number', 'email', 'url', 'password', 'tel'].indexOf(t) >= 0;
    }
    return false;
  }

  App2.ui.Shortcuts = function (app) {
    const tools = app.tools;

    function adjust(key, factor, min, max, round) {
      const t = tools.active;
      if (!t || t.settings[key] === undefined) return;
      let v = t.settings[key] * factor;
      if (factor > 1 && v - t.settings[key] < (round ? 1 : 0.05)) v = t.settings[key] + (round ? 1 : 0.05);
      v = Math.max(min, Math.min(max, round ? Math.round(v) : Math.round(v * 100) / 100));
      t.setSetting(key, v);
    }

    window.addEventListener('keydown', (e) => {
      if (isTyping(e.target)) return;
      if (document.querySelector('.modal-overlay')) return;
      const k = e.key;
      const ctrl = e.ctrlKey || e.metaKey;

      if (k === ' ' || e.code === 'Space') {
        app.input.setSpace(true);
        e.preventDefault();
        return;
      }

      if (ctrl) {
        const lk = k.toLowerCase();
        const map = {
          z: () => (e.shiftKey ? app.redo() : app.undo()),
          y: () => app.redo(),
          s: () => (e.shiftKey ? app.actions.exportProject() : app.actions.save()),
          o: () => app.actions.openProject(),
          e: () => app.actions.exportPNG(),
          d: () => {
            app.state.update('selection', null);
            app.renderer.requestRender();
          },
          j: () => app.commands.duplicateLayer(),
          m: () => app.commands.mergeDown(),
          n: () => e.shiftKey && app.commands.addLayer(),
          '0': () => app.zoomToFit(),
          '=': () => app.view.zoomBy(1.25),
          '+': () => app.view.zoomBy(1.25),
          '-': () => app.view.zoomBy(1 / 1.25),
        };
        if (map[lk]) {
          e.preventDefault();
          if (lk === 'n' && !e.shiftKey) return; // leave Ctrl+N to the browser
          map[lk]();
        }
        return;
      }

      // Let the active tool handle Enter / Escape / Delete first.
      if (tools.active && tools.active.onKeyDown(e)) {
        e.preventDefault();
        app.renderer.requestRender();
        return;
      }

      if (e.altKey) return;

      switch (k) {
        case '[':
          if (e.shiftKey) adjust('opacity', 0.9, 0.01, 1, false);
          else adjust('size', 1 / 1.15, 1, 400, true);
          return;
        case ']':
          if (e.shiftKey) adjust('opacity', 1.1, 0.01, 1, false);
          else adjust('size', 1.15, 1, 400, true);
          return;
        case '{':
          adjust('opacity', 0.9, 0.01, 1, false);
          return;
        case '}':
          adjust('opacity', 1.1, 0.01, 1, false);
          return;
        case '+':
        case '=':
          app.view.zoomBy(1.25);
          return;
        case '-':
        case '_':
          app.view.zoomBy(1 / 1.25);
          return;
        case '0':
          app.zoomToFit();
          return;
        case '1':
          app.view.zoomBy(1 / app.view.zoom);
          return;
        case '?':
          App2.ui.showHelp(app);
          return;
        case 'Tab':
          e.preventDefault();
          app.ui.togglePanel();
          return;
        case 'Delete':
        case 'Backspace':
          if (app.state.selection) {
            e.preventDefault();
            app.commands.clearRect(app.state.selection);
          }
          return;
        case 'Escape':
          if (app.state.selection) {
            app.state.update('selection', null);
            app.renderer.requestRender();
          }
          return;
      }
      if (k.length === 1 && /[a-z]/i.test(k) && !e.shiftKey) {
        if (k.toLowerCase() === 'x') {
          app.state.swapColors();
          return;
        }
        const t = tools.findByShortcut(k);
        if (t) {
          tools.setActive(t.id);
          e.preventDefault();
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.key === ' ' || e.code === 'Space') app.input.setSpace(false);
    });
    window.addEventListener('blur', () => app.input.setSpace(false));
  };

  App2.ui.showHelp = function (app) {
    const toolRows = app.tools.list
      .filter((t) => t.shortcut)
      .map((t) => h('tr', null, h('td', null, h('kbd', null, t.shortcut.toUpperCase())), h('td', null, t.name)));
    const globalRows = GLOBAL_SHORTCUTS.map((s) => h('tr', null, h('td', null, h('kbd', null, s[0])), h('td', null, s[1])));
    const content = h(
      'div',
      { class: 'help' },
      h('p', null, 'Welcome to ', h('strong', null, 'App2'), ' — an infinite canvas: draw anywhere, pan and zoom freely. Your work is autosaved in this browser; export a project file to keep it safe or move it to another device.'),
      h('div', { class: 'help-cols' }, h('div', null, h('h3', null, 'Tools'), h('table', null, toolRows)), h('div', null, h('h3', null, 'Shortcuts'), h('table', null, globalRows))),
      h('p', { class: 'hint' }, 'Tablets: use a pen for pressure; two fingers pan and pinch-zoom. Tap the sliders icon (top right) to open the panels.')
    );
    App2.ui.modal('Help & keyboard shortcuts', content);
  };
})(window.App2);
