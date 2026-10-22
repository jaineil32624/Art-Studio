/**
 * App2 bootstrap: wires the document, viewport, history, renderer, tools,
 * storage and UI panels together into the `App2.app` object.
 */
(function (App2) {
  'use strict';

  const { EventBus, Store } = App2.core;
  const { ArtDocument, Viewport, History, Commands, Renderer } = App2.canvas;
  const { h } = App2.ui;

  function boot() {
    const bus = new EventBus();
    const app = { bus, version: App2.version, ui: {} };
    App2.app = app;

    app.toast = App2.ui.toast;
    app.state = new Store(bus);
    app.doc = new ArtDocument(bus);
    app.view = new Viewport(() => {
      bus.emit('view:changed');
      if (app.renderer) app.renderer.requestRender();
    });
    app.history = new History({
      onChange: () => bus.emit('history:changed'),
      onApply: () => {
        app.doc.layersChanged();
        app.doc.changed();
      },
    });
    app.commands = new Commands(app);

    const stage = document.getElementById('stage');
    const canvas = document.getElementById('view');
    app.renderer = new Renderer(app, canvas);
    app.tools = new App2.tools.ToolManager(app);
    app.tools.init();
    app.storage = new App2.io.Storage(app);
    App2.creative.patterns.init(bus);

    /* ---------- app-level helpers ---------- */
    app.undo = () => {
      if (app.tools.active && app.tools.active.busy) return;
      const e = app.history.undo();
      if (e) app.toast('Undo: ' + e.label, 'info', 1200);
    };
    app.redo = () => {
      if (app.tools.active && app.tools.active.busy) return;
      const e = app.history.redo();
      if (e) app.toast('Redo: ' + e.label, 'info', 1200);
    };
    app.zoomToFit = () => {
      const b = app.doc.tileBounds();
      if (!b) {
        app.view.set(-app.view.width / 2, -app.view.height / 2, 1);
        return;
      }
      const tight = app.doc.contentBounds() || b;
      app.view.fitRect(tight, 48);
    };
    app.newDocument = () => {
      if (app.tools.active) app.tools.active.cancel();
      const st = app.tools.get('sticker');
      if (st && st.pending) st.cancelPlacement();
      app.doc.reset();
      app.doc.replaceLayers([app.doc.createLayer('Layer 1')], 0);
      app.doc.setBackground('#ffffff');
      app.state.update('selection', null);
      app.history.clear();
      app.view.set(-app.view.width / 2, -app.view.height / 2, 1);
      app.storage.clearAutosave();
      bus.emit('project:loaded');
      app.toast('New artwork created.');
    };

    /* ---------- UI ---------- */
    App2.ui.Topbar(app, document.getElementById('topbar'));
    App2.ui.Toolbar(app, document.getElementById('toolbar'));

    const panel = document.getElementById('panel');
    const colorBody = h('div', { class: 'color-panel' });
    const toolBody = h('div', { class: 'tool-options' });
    const layersBody = h('div', { class: 'layers-panel' });
    const canvasBody = h('div', { class: 'canvas-panel' });
    const creativeBody = h('div', { class: 'creative-panel' });
    const S = App2.ui.section;
    panel.appendChild(S('Color', 'palette', colorBody, { id: 'sec-color' }));
    panel.appendChild(S('Tool settings', 'sliders', toolBody, { id: 'sec-tool' }));
    panel.appendChild(S('Layers', 'layers', layersBody, { id: 'sec-layers' }));
    panel.appendChild(S('Canvas, symmetry & pixel mode', 'symmetry', canvasBody, { id: 'sec-canvas', collapsed: true }));
    panel.appendChild(S('Creative', 'sparkles', creativeBody, { id: 'sec-creative' }));

    App2.ui.ColorPanel(app, colorBody);
    App2.ui.ToolOptions(app, toolBody);
    App2.ui.LayersPanel(app, layersBody);
    App2.ui.CanvasPanel(app, canvasBody);
    App2.ui.CreativePanel(app, creativeBody);
    App2.ui.ZoomControls(app, stage);
    App2.ui.installTooltips();

    const root = document.getElementById('app');
    const isSmall = () => window.matchMedia('(max-width: 860px)').matches;
    app.ui.togglePanel = (force) => {
      if (isSmall()) root.classList.toggle('panel-open', force);
      else root.classList.toggle('panel-hidden', force === undefined ? undefined : !force);
      setTimeout(() => app.renderer.resize(), 0);
    };
    app.ui.openPanel = (sectionName) => {
      if (isSmall()) root.classList.add('panel-open');
      else root.classList.remove('panel-hidden');
      const sec = document.getElementById('sec-' + sectionName);
      if (sec) {
        sec.classList.remove('collapsed');
        sec.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
      setTimeout(() => app.renderer.resize(), 0);
    };
    document.getElementById('panel-scrim').addEventListener('click', () => root.classList.remove('panel-open'));

    app.input = new App2.ui.CanvasInput(app, canvas);
    App2.ui.Shortcuts(app);

    /* ---------- drag & drop files onto the stage ---------- */
    stage.addEventListener('dragover', (e) => {
      e.preventDefault();
      stage.classList.add('dropping');
    });
    stage.addEventListener('dragleave', () => stage.classList.remove('dropping'));
    stage.addEventListener('drop', async (e) => {
      e.preventDefault();
      stage.classList.remove('dropping');
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (!f) return;
      try {
        if (/\.json$/i.test(f.name)) await App2.io.Export.importProject(app, f);
        else if (/^image\//.test(f.type)) await App2.io.Export.importImage(app, f);
        else app.toast('Unsupported file: ' + f.name, 'warn');
      } catch (err) {
        app.toast(err.message, 'error', 5000);
      }
    });

    /* ---------- render plumbing ---------- */
    bus.on('doc:changed', () => app.renderer.requestRender());
    bus.on('layers:changed', () => app.renderer.requestRender());
    bus.on('state:changed', () => app.renderer.requestRender());
    window.addEventListener('resize', () => app.renderer.resize());
    if (window.ResizeObserver) new ResizeObserver(() => app.renderer.resize()).observe(stage);

    /* ---------- initial document ---------- */
    app.doc.replaceLayers([app.doc.createLayer('Layer 1')], 0);
    app.renderer.resize();
    app.view.set(-app.view.width / 2, -app.view.height / 2, 1);
    app.tools.setActive('brush');
    app.history.clear();

    app.storage
      .restoreOnStartup()
      .then((restored) => {
        if (restored) {
          app.toast('Welcome back — your artwork was restored.', 'success');
        } else {
          app.toast('Welcome to App2! Press ? for shortcuts.', 'info', 4000);
        }
        app.storage.startAutosave();
        app.renderer.requestRender();
      });

    window.addEventListener('error', (e) => {
      if (e && e.message) app.toast('Unexpected error: ' + e.message, 'error', 5000);
    });
    window.addEventListener('unhandledrejection', (e) => {
      const msg = e && e.reason && (e.reason.message || String(e.reason));
      if (msg) app.toast('Unexpected error: ' + msg, 'error', 5000);
    });

    document.getElementById('app').classList.add('ready');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.App2);
