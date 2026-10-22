/**
 * Layers panel: list (top layer first) with visibility, thumbnail and
 * rename-on-double-click; drag-and-drop or up/down buttons to reorder;
 * add / duplicate / delete / merge down / clear; opacity and blend mode
 * of the active layer. All changes go through app.commands (undoable).
 */
(function (App2) {
  'use strict';

  const { h, iconButton, slider, select } = App2.ui;
  const { ArtDocument } = App2.canvas;
  const { math: M } = App2.core;

  App2.ui.LayersPanel = function (app, root) {
    const doc = app.doc;
    const cmd = app.commands;
    const list = h('ul', { class: 'layer-list', role: 'listbox', 'aria-label': 'Layers' });
    let opacityStart = null;

    const opacity = slider({
      label: 'Opacity',
      min: 0,
      max: 1,
      step: 0.01,
      value: 1,
      format: 'pct',
      onInput: (v) => {
        const L = doc.activeLayer;
        if (!L) return;
        if (opacityStart === null) opacityStart = L.opacity;
        L.opacity = v;
        app.renderer.requestRender();
      },
      onChange: (v) => {
        const L = doc.activeLayer;
        if (!L) return;
        cmd.setLayerProp(L, 'opacity', v, opacityStart === null ? L.opacity : opacityStart);
        opacityStart = null;
      },
    });
    const blend = select({
      label: 'Blend',
      choices: ArtDocument.BLEND_MODES,
      value: 'source-over',
      onChange: (v) => doc.activeLayer && cmd.setLayerProp(doc.activeLayer, 'blend', v),
    });

    const actions = h(
      'div',
      { class: 'layer-actions' },
      iconButton('plus', 'New layer (Ctrl+Shift+N)', () => cmd.addLayer()),
      iconButton('copy', 'Duplicate layer (Ctrl+J)', () => cmd.duplicateLayer()),
      iconButton('up', 'Move layer up', () => doc.activeLayer && cmd.moveLayer(doc.activeLayer, doc.activeIndex + 1)),
      iconButton('down', 'Move layer down', () => doc.activeLayer && cmd.moveLayer(doc.activeLayer, doc.activeIndex - 1)),
      iconButton('merge', 'Merge down (Ctrl+M)', () => cmd.mergeDown()),
      iconButton('clear', 'Clear layer', () => cmd.clearLayer()),
      iconButton('trash', 'Delete layer', () => cmd.deleteLayer())
    );

    root.appendChild(h('div', { class: 'controls' }, opacity, blend));
    root.appendChild(list);
    root.appendChild(actions);

    const thumbs = new Map(); // layer.id → {canvas, version}

    function drawThumb(layer, canvas) {
      const g = canvas.getContext('2d');
      g.clearRect(0, 0, canvas.width, canvas.height);
      const b = layer.tileBounds();
      if (!b) return;
      const s = Math.min(canvas.width / b.w, canvas.height / b.h);
      const ox = (canvas.width - b.w * s) / 2, oy = (canvas.height - b.h * s) / 2;
      g.imageSmoothingEnabled = true;
      layer.renderRegion(g, b, s, ox, oy);
    }

    function render() {
      list.innerHTML = '';
      const L = doc.activeLayer;
      for (let i = doc.layers.length - 1; i >= 0; i--) {
        const layer = doc.layers[i];
        const thumb = h('canvas', { class: 'layer-thumb', width: 48, height: 36 });
        drawThumb(layer, thumb);
        thumbs.set(layer.id, { canvas: thumb, version: layer.version });
        const vis = iconButton(layer.visible ? 'eye' : 'eyeOff', layer.visible ? 'Hide layer' : 'Show layer', (e) => {
          e.stopPropagation();
          cmd.setLayerProp(layer, 'visible', !layer.visible);
        }, 'small');
        const name = h('span', { class: 'layer-name', title: 'Double-click to rename' }, layer.name);
        const meta = h('span', { class: 'layer-meta' }, (layer.opacity < 1 ? Math.round(layer.opacity * 100) + '%' : '') + (layer.blend !== 'source-over' ? ' ' + (ArtDocument.BLEND_MODES.find((b) => b[0] === layer.blend) || ['', ''])[1] : ''));
        const li = h(
          'li',
          {
            class: 'layer-item' + (layer === L ? ' active' : '') + (layer.visible ? '' : ' hidden-layer'),
            role: 'option',
            'aria-selected': layer === L ? 'true' : 'false',
            draggable: 'true',
            dataset: { index: String(i) },
          },
          vis,
          thumb,
          h('span', { class: 'layer-text' }, name, meta)
        );
        li.addEventListener('click', () => doc.setActive(layer.id));
        name.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          startRename(layer, name);
        });
        // Drag & drop reordering (desktop).
        li.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/plain', String(i));
          e.dataTransfer.effectAllowed = 'move';
          li.classList.add('dragging');
        });
        li.addEventListener('dragend', () => li.classList.remove('dragging'));
        li.addEventListener('dragover', (e) => {
          e.preventDefault();
          li.classList.add('drop-target');
        });
        li.addEventListener('dragleave', () => li.classList.remove('drop-target'));
        li.addEventListener('drop', (e) => {
          e.preventDefault();
          li.classList.remove('drop-target');
          const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
          if (!isNaN(from) && doc.layers[from]) cmd.moveLayer(doc.layers[from], i);
        });
        list.appendChild(li);
      }
      if (L) {
        opacity.set(L.opacity);
        blend.set(L.blend);
      }
    }

    function startRename(layer, nameEl) {
      const input = h('input', { class: 'layer-rename', type: 'text', value: layer.name });
      nameEl.replaceWith(input);
      input.focus();
      input.select();
      let done = false;
      const finish = (save) => {
        if (done) return;
        done = true;
        const v = input.value.trim();
        if (save && v && v !== layer.name) cmd.setLayerProp(layer, 'name', v);
        else render();
      };
      input.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') finish(true);
        if (e.key === 'Escape') finish(false);
      });
      input.addEventListener('blur', () => finish(true));
      input.addEventListener('click', (e) => e.stopPropagation());
    }

    // Refresh thumbnails lazily after pixel changes.
    const refreshThumbs = M.debounce(() => {
      for (const layer of doc.layers) {
        const t = thumbs.get(layer.id);
        if (t && t.version !== layer.version) {
          drawThumb(layer, t.canvas);
          t.version = layer.version;
        }
      }
    }, 250);

    app.bus.on('layers:changed', render);
    app.bus.on('doc:changed', refreshThumbs);
    render();
  };
})(window.App2);
