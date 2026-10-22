/**
 * Top bar: File menu (new / open / save / import / export), document name,
 * undo/redo, autosave status, help and the mobile panel toggle.
 */
(function (App2) {
  'use strict';

  const { h, iconButton } = App2.ui;
  const { Export } = App2.io;

  App2.ui.Topbar = function (app, root) {
    const fileInputProject = h('input', { type: 'file', accept: '.json,.app2.json,application/json', hidden: true });
    const fileInputImage = h('input', { type: 'file', accept: 'image/*', hidden: true });

    const run = (fn) => async () => {
      closeMenus();
      try {
        await fn();
      } catch (err) {
        console.error(err);
        app.toast(err.message || String(err), 'error', 5000);
      }
    };

    fileInputProject.addEventListener('change', run(async () => {
      const f = fileInputProject.files[0];
      fileInputProject.value = '';
      if (f) await Export.importProject(app, f);
    }));
    fileInputImage.addEventListener('change', run(async () => {
      const f = fileInputImage.files[0];
      fileInputImage.value = '';
      if (f) await Export.importImage(app, f);
    }));

    app.actions = Object.assign(app.actions || {}, {
      newDocument() {
        if (!window.confirm('Start a new artwork? Unsaved changes will be lost (the current autosave is replaced).')) return;
        app.newDocument();
      },
      openProject: () => fileInputProject.click(),
      importImage: () => fileInputImage.click(),
      save: () => app.storage.save(),
      async restoreSaved() {
        if (!app.storage.has(App2.io.Storage.KEY_SAVE)) {
          app.toast('No manual save found in this browser.', 'warn');
          return;
        }
        if (!window.confirm('Replace the current artwork with your last manual save?')) return;
        await app.storage.loadFrom(App2.io.Storage.KEY_SAVE);
        app.toast('Restored last save.', 'success');
      },
      exportPNG: () => Export.png(app),
      exportPNGBg: () => Export.png(app, { background: true }),
      exportJPG: () => Export.jpg(app),
      exportProject: () => Export.project(app),
    });
    const A = app.actions;

    const item = (icon, label, shortcut, fn) =>
      h('button', { class: 'menu-item', type: 'button', role: 'menuitem', onclick: run(fn), html: App2.ui.icon(icon, 16) + '<span>' + label + '</span>' + (shortcut ? '<kbd>' + shortcut + '</kbd>' : '') });

    const fileMenu = h(
      'div',
      { class: 'menu', role: 'menu' },
      item('newfile', 'New artwork', '', A.newDocument),
      item('folder', 'Open project (.app2.json)…', 'Ctrl+O', A.openProject),
      h('div', { class: 'menu-sep' }),
      item('save', 'Save to browser', 'Ctrl+S', A.save),
      item('restore', 'Restore last browser save', '', A.restoreSaved),
      h('div', { class: 'menu-sep' }),
      item('image', 'Import image…', '', A.importImage),
      h('div', { class: 'menu-sep' }),
      item('download', 'Export PNG (transparent)', 'Ctrl+E', A.exportPNG),
      item('download', 'Export PNG (with background)', '', A.exportPNGBg),
      item('download', 'Export JPG (white background)', '', A.exportJPG),
      item('download', 'Export project (.app2.json)', 'Ctrl+Shift+S', A.exportProject)
    );
    const fileBtn = h('button', { class: 'menu-btn', type: 'button', 'aria-haspopup': 'true', html: App2.ui.icon('file', 18) + '<span>File</span>' + App2.ui.icon('chevron', 14) });
    const fileWrap = h('div', { class: 'menu-wrap' }, fileBtn, fileMenu);
    fileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = !fileWrap.classList.contains('open');
      closeMenus();
      fileWrap.classList.toggle('open', open);
    });
    function closeMenus() {
      fileWrap.classList.remove('open');
    }
    document.addEventListener('pointerdown', (e) => {
      if (!fileWrap.contains(e.target)) closeMenus();
    });

    const name = h('input', { class: 'doc-name', type: 'text', value: app.doc.name, 'aria-label': 'Artwork name', spellcheck: 'false' });
    name.addEventListener('change', () => {
      app.doc.name = name.value.trim() || 'Untitled';
      name.value = app.doc.name;
      app.doc.changed();
    });
    name.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') name.blur();
    });
    app.bus.on('project:loaded', () => (name.value = app.doc.name));

    const undoBtn = iconButton('undo', 'Undo (Ctrl+Z)', () => app.undo());
    const redoBtn = iconButton('redo', 'Redo (Ctrl+Y)', () => app.redo());
    const saveBtn = iconButton('save', 'Save to browser (Ctrl+S)', () => A.save());
    const exportBtn = iconButton('download', 'Export PNG (Ctrl+E)', run(A.exportPNG));
    const status = h('span', { class: 'save-status', title: 'Autosave status' }, '');
    const helpBtn = iconButton('help', 'Help & shortcuts (?)', () => App2.ui.showHelp(app));
    const panelBtn = iconButton('sliders', 'Show/hide panels', () => app.ui.togglePanel(), 'panel-toggle');

    root.appendChild(h('div', { class: 'brand', html: '<span class="logo">' + App2.ui.icon('palette', 22) + '</span><span class="brand-name">Art Studio</span>' }));
    root.appendChild(fileWrap);
    root.appendChild(name);
    root.appendChild(h('div', { class: 'top-group' }, undoBtn, redoBtn));
    root.appendChild(h('div', { class: 'top-group hide-sm' }, saveBtn, exportBtn));
    root.appendChild(h('div', { class: 'spacer' }));
    root.appendChild(status);
    // Optional background music toggle + volume (see js/music.js).
    const musicSlot = h('div', { class: 'top-group music-slot' });
    App2.music.mountControl(musicSlot);
    App2.music.init();
    root.appendChild(musicSlot);
    root.appendChild(helpBtn);
    root.appendChild(panelBtn);
    root.appendChild(fileInputProject);
    root.appendChild(fileInputImage);

    const syncHistory = () => {
      undoBtn.disabled = !app.history.canUndo;
      redoBtn.disabled = !app.history.canRedo;
      const u = app.history.undoStack[app.history.undoStack.length - 1];
      const r = app.history.redoStack[app.history.redoStack.length - 1];
      undoBtn.dataset.tip = 'Undo' + (u ? ' ' + u.label : '') + ' (Ctrl+Z)';
      redoBtn.dataset.tip = 'Redo' + (r ? ' ' + r.label : '') + ' (Ctrl+Y)';
    };
    app.bus.on('history:changed', syncHistory);
    syncHistory();

    app.bus.on('storage:saved', () => {
      const t = new Date();
      status.textContent = 'Saved ' + t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    });
    app.bus.on('doc:changed', () => {
      status.textContent = '• Unsaved changes';
    });
  };
})(window.App2);
