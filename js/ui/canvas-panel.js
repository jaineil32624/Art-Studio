/**
 * Canvas panel: paper/background color, symmetry settings and pixel-art
 * mode. Also builds the floating zoom controls over the stage.
 */
(function (App2) {
  'use strict';

  const { h, slider, select, toggle, button, iconButton } = App2.ui;
  const { Symmetry } = App2.canvas;

  App2.ui.CanvasPanel = function (app, root) {
    const st = app.state;

    // --- Background ---
    const bgColor = h('input', { type: 'color', class: 'bg-color', value: app.doc.background || '#ffffff', 'aria-label': 'Paper color' });
    const bgMode = select({
      label: 'Paper',
      choices: [['color', 'Solid color'], ['transparent', 'Transparent']],
      value: app.doc.background ? 'color' : 'transparent',
      onChange: (v) => app.doc.setBackground(v === 'transparent' ? null : bgColor.value),
    });
    bgColor.addEventListener('input', () => {
      if (app.doc.background) app.doc.setBackground(bgColor.value);
    });
    app.bus.on('background:changed', (bg) => {
      bgMode.set(bg ? 'color' : 'transparent');
      if (bg) bgColor.value = bg;
    });

    // --- Symmetry ---
    const symMode = select({ label: 'Symmetry', choices: Symmetry.MODES, value: st.symmetry.mode, onChange: (v) => st.update('symmetry', { mode: v }) });
    const symCount = slider({ label: 'Radial segments', min: 2, max: 24, step: 1, value: st.symmetry.count, onInput: (v) => st.update('symmetry', { count: v }) });
    const symGuides = toggle({ label: 'Show guides', value: st.symmetry.guides, onChange: (v) => st.update('symmetry', { guides: v }) });
    const symCenter = button('Center axis on view', () => {
      const c = app.view.screenToWorld(app.view.width / 2, app.view.height / 2);
      st.update('symmetry', { cx: Math.round(c.x), cy: Math.round(c.y) });
      app.toast('Symmetry center moved to the middle of the view.');
    }, 'small');
    const syncSym = () => {
      symMode.set(st.symmetry.mode);
      symCount.set(st.symmetry.count);
      symGuides.set(st.symmetry.guides);
      const radial = st.symmetry.mode === 'radial' || st.symmetry.mode === 'kaleido';
      symCount.style.display = radial ? '' : 'none';
      symGuides.style.display = st.symmetry.mode === 'off' ? 'none' : '';
      symCenter.style.display = st.symmetry.mode === 'off' ? 'none' : '';
    };

    // --- Pixel mode ---
    const pxEnabled = toggle({ label: 'Pixel-art mode (crisp + grid)', value: st.pixel.enabled, onChange: (v) => st.update('pixel', { enabled: v }) });
    const pxSize = slider({ label: 'Pixel size', min: 1, max: 64, step: 1, value: st.pixel.size, format: 'px', onInput: (v) => st.update('pixel', { size: v }) });
    const pxGrid = toggle({ label: 'Show pixel grid', value: st.pixel.grid, onChange: (v) => st.update('pixel', { grid: v }) });
    const syncPx = () => {
      pxEnabled.set(st.pixel.enabled);
      pxSize.set(st.pixel.size);
      pxGrid.set(st.pixel.grid);
    };

    root.appendChild(h('div', { class: 'controls' }, h('div', { class: 'ctl-inline' }, bgMode, bgColor), symMode, symCount, symGuides, symCenter, h('div', { class: 'ctl-divider' }), pxEnabled, pxSize, pxGrid));

    app.bus.on('state:symmetry', () => {
      syncSym();
      app.renderer.requestRender();
    });
    app.bus.on('state:pixel', () => {
      syncPx();
      app.renderer.requestRender();
    });
    syncSym();
  };

  /** Floating zoom controls (bottom-right of the stage). */
  App2.ui.ZoomControls = function (app, stage) {
    const label = h('button', { class: 'zoom-label', type: 'button', 'data-tip': 'Reset to 100%', 'aria-label': 'Reset zoom to 100%' }, '100%');
    label.addEventListener('click', () => app.view.zoomBy(1 / app.view.zoom));
    const bar = h(
      'div',
      { class: 'zoom-bar' },
      iconButton('zoomOut', 'Zoom out (-)', () => app.view.zoomBy(1 / 1.25)),
      label,
      iconButton('zoomIn', 'Zoom in (+)', () => app.view.zoomBy(1.25)),
      iconButton('fit', 'Zoom to fit artwork (0)', () => app.zoomToFit())
    );
    stage.appendChild(bar);
    const sync = () => (label.textContent = Math.round(app.view.zoom * 100) + '%');
    app.bus.on('view:changed', sync);
    sync();
  };
})(window.App2);
