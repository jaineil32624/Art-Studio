/**
 * Creative panel (tabs): palette generator, texture generator, stickers and
 * patterns.
 */
(function (App2) {
  'use strict';

  const { h, slider, select, button, iconButton } = App2.ui;
  const { palettes, textures, stickers, patterns } = App2.creative;

  /** Sticker picker grid, shared by this panel and the Sticker tool options. */
  App2.ui.buildStickerGrid = function (app, container, opts) {
    opts = opts || {};
    const grid = h('div', { class: 'sticker-grid' + (opts.compact ? ' compact' : '') });
    const tool = () => app.tools.get('sticker');
    for (const s of stickers.list()) {
      const thumb = stickers.render(s.id, { size: 64 });
      const img = h('canvas', { width: 64, height: 64 });
      img.getContext('2d').drawImage(thumb, 0, 0);
      const b = h('button', { class: 'sticker-btn', type: 'button', 'aria-label': s.name, 'data-tip': s.name }, img);
      b.dataset.id = s.id;
      b.addEventListener('click', () => {
        app.tools.setActive('sticker');
        tool().selectSticker(s.id);
        app.toast('Click on the canvas to place "' + s.name + '".');
      });
      grid.appendChild(b);
    }
    const sync = () => {
      const t = tool();
      for (const b of grid.children) b.classList.toggle('selected', !!t && b.dataset.id === t.stickerId);
    };
    app.bus.on('sticker:selected', sync);
    sync();
    container.appendChild(grid);
  };

  App2.ui.CreativePanel = function (app, root) {
    const tabs = [
      { id: 'palette', label: 'Palette', icon: 'palette', build: buildPalette },
      { id: 'texture', label: 'Textures', icon: 'texture', build: buildTextures },
      { id: 'sticker', label: 'Stickers', icon: 'sticker', build: buildStickers },
      { id: 'pattern', label: 'Patterns', icon: 'pattern', build: buildPatterns },
    ];
    const tabBar = h('div', { class: 'tabs', role: 'tablist' });
    const body = h('div', { class: 'tab-body' });
    const panes = {};
    for (const t of tabs) {
      const btn = h('button', { class: 'tab', type: 'button', role: 'tab', 'data-tip': t.label, html: App2.ui.icon(t.icon, 16) + '<span>' + t.label + '</span>' });
      btn.addEventListener('click', () => show(t.id));
      t.btn = btn;
      tabBar.appendChild(btn);
      const pane = h('div', { class: 'tab-pane', role: 'tabpanel' });
      t.build(pane);
      panes[t.id] = pane;
      body.appendChild(pane);
    }
    root.appendChild(tabBar);
    root.appendChild(body);

    function show(id) {
      for (const t of tabs) {
        t.btn.classList.toggle('active', t.id === id);
        t.btn.setAttribute('aria-selected', t.id === id ? 'true' : 'false');
        panes[t.id].hidden = t.id !== id;
      }
      try {
        localStorage.setItem('app2.creativeTab', id);
      } catch (e) {
        /* ignore */
      }
    }
    let initial = 'palette';
    try {
      initial = localStorage.getItem('app2.creativeTab') || 'palette';
    } catch (e) {
      /* ignore */
    }
    show(panes[initial] ? initial : 'palette');

    /* ---------------- Palette ---------------- */
    function buildPalette(pane) {
      let mode = 'complementary';
      const swatches = h('div', { class: 'palette-swatches' });
      const modeBtns = h('div', { class: 'chip-row' });
      const generate = () => {
        const colors = palettes.generate(app.state.primary, mode);
        swatches.innerHTML = '';
        for (const c of colors) {
          swatches.appendChild(
            h('button', {
              class: 'palette-swatch',
              type: 'button',
              style: { background: c, color: App2.core.Color.contrastText(c) },
              'aria-label': 'Use ' + c,
              'data-tip': 'Click: primary · Right-click: secondary',
              onclick: () => {
                app.state.setColor(c, 'primary');
                app.state.addRecent(c);
              },
              oncontextmenu: (e) => {
                e.preventDefault();
                app.state.setColor(c, 'secondary');
              },
              html: '<span>' + c + '</span>',
            })
          );
        }
      };
      for (const [id, label] of palettes.MODES) {
        const b = h('button', { class: 'chip' + (id === mode ? ' active' : ''), type: 'button' }, label);
        b.addEventListener('click', () => {
          mode = id;
          for (const c of modeBtns.children) c.classList.toggle('active', c === b);
          generate();
        });
        modeBtns.appendChild(b);
      }
      pane.appendChild(h('p', { class: 'hint' }, 'Harmonies are built from your primary color.'));
      pane.appendChild(modeBtns);
      pane.appendChild(swatches);
      pane.appendChild(
        h(
          'div',
          { class: 'btn-row' },
          button('Regenerate', generate, 'small', 'dice'),
          button('Add all to recent', () => {
            Array.from(swatches.children).reverse().forEach((b) => app.state.addRecent(b.textContent));
          }, 'small')
        )
      );
      app.bus.on('color:changed', (e) => {
        if (e.which === 'primary' && mode !== 'random' && !pane.hidden) generate();
      });
      generate();
    }

    /* ---------------- Textures ---------------- */
    function buildTextures(pane) {
      const p = { type: 'clouds', size: 512, scale: 4, detail: 5, seed: 1234 };
      const colA = h('input', { type: 'color', value: app.state.primary, 'aria-label': 'Dark color' });
      const colB = h('input', { type: 'color', value: app.state.secondary, 'aria-label': 'Light color' });
      const preview = h('canvas', { class: 'texture-preview', width: 160, height: 160 });
      let current = null;
      const regen = () => {
        current = textures.generate(Object.assign({}, p, { colorA: colA.value, colorB: colB.value }));
        const g = preview.getContext('2d');
        g.clearRect(0, 0, 160, 160);
        g.drawImage(current, 0, 0, 160, 160);
      };
      const deb = App2.core.math.debounce(regen, 120);
      const seedLabel = h('span', { class: 'ctl-value' }, String(p.seed));
      pane.appendChild(
        h(
          'div',
          { class: 'controls' },
          select({ label: 'Type', choices: textures.list().map((t) => [t.id, t.name]), value: p.type, onChange: (v) => ((p.type = v), regen()) }),
          slider({ label: 'Scale', min: 1, max: 16, step: 1, value: p.scale, onInput: (v) => ((p.scale = v), deb()) }),
          slider({ label: 'Detail', min: 1, max: 8, step: 1, value: p.detail, onInput: (v) => ((p.detail = v), deb()) }),
          select({ label: 'Size', choices: [['256', '256 px'], ['512', '512 px'], ['1024', '1024 px']], value: String(p.size), onChange: (v) => ((p.size = +v), regen()) }),
          h(
            'div',
            { class: 'ctl-inline' },
            h('span', { class: 'ctl-label' }, 'Colors'),
            colA,
            colB,
            iconButton('swap', 'Use current primary/secondary', () => {
              colA.value = app.state.primary;
              colB.value = app.state.secondary;
              regen();
            }, 'small'),
            h('span', { class: 'ctl-label' }, 'Seed'),
            seedLabel,
            iconButton('dice', 'Randomize', () => {
              p.seed = (Math.random() * 1e6) | 0;
              seedLabel.textContent = String(p.seed);
              regen();
            }, 'small')
          )
        )
      );
      colA.addEventListener('input', deb);
      colB.addEventListener('input', deb);
      pane.appendChild(h('div', { class: 'texture-wrap' }, preview));
      pane.appendChild(
        h(
          'div',
          { class: 'btn-row' },
          button('Place on new layer', () => {
            if (!current) regen();
            const tool = app.tools.setActive('sticker') || app.tools.get('sticker');
            tool.place(current, { name: 'Texture', newLayer: true, scale: 1 });
            app.toast('Move/scale/rotate the texture, then press Enter.');
          }, 'primary small', 'texture'),
          button('Save as pattern', () => {
            if (!current) regen();
            patterns.add(current, 'Texture ' + p.type);
            app.toast('Saved to Patterns — use it with the Fill bucket or Pattern Brush.');
          }, 'small', 'pattern')
        )
      );
      // Generate lazily the first time the tab becomes visible.
      requestAnimationFrame(regen);
    }

    /* ---------------- Stickers ---------------- */
    function buildStickers(pane) {
      pane.appendChild(h('p', { class: 'hint' }, 'Pick a sticker, click the canvas, then drag to move, use the corners to scale and the top handle to rotate. Enter applies.'));
      App2.ui.buildStickerGrid(app, pane);
    }

    /* ---------------- Patterns ---------------- */
    function buildPatterns(pane) {
      const gen = { type: 'checker', size: 32 };
      const lib = h('div', { class: 'pattern-grid' });
      const renderLib = () => {
        lib.innerHTML = '';
        for (const pat of patterns.list()) {
          const c = h('canvas', { width: 56, height: 56 });
          const g = c.getContext('2d');
          g.fillStyle = g.createPattern(pat.canvas, 'repeat');
          g.fillRect(0, 0, 56, 56);
          const b = h('button', { class: 'pattern-btn' + (pat.id === patterns.activeId() ? ' selected' : ''), type: 'button', 'aria-label': pat.name, 'data-tip': pat.name }, c);
          b.addEventListener('click', () => patterns.setActive(pat.id));
          b.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (window.confirm('Delete pattern "' + pat.name + '"?')) patterns.remove(pat.id);
          });
          lib.appendChild(b);
        }
      };
      pane.appendChild(
        h(
          'div',
          { class: 'controls' },
          select({ label: 'Generator', choices: Object.keys(patterns.GENERATORS).map((k) => [k, patterns.GENERATORS[k].name]), value: gen.type, onChange: (v) => (gen.type = v) }),
          slider({ label: 'Tile size', min: 8, max: 256, step: 1, value: gen.size, format: 'px', onInput: (v) => (gen.size = v) })
        )
      );
      pane.appendChild(
        h(
          'div',
          { class: 'btn-row' },
          button('Create from colors', () => {
            patterns.add(patterns.generate(gen.type, gen.size, app.state.primary, app.state.secondary), patterns.GENERATORS[gen.type].name);
          }, 'primary small', 'plus'),
          button('From selection', () => patterns.fromSelection(app), 'small', 'select')
        )
      );
      pane.appendChild(h('div', { class: 'subhead' }, 'Library (click = active, right-click = delete)'));
      pane.appendChild(lib);
      pane.appendChild(
        h(
          'div',
          { class: 'btn-row' },
          button('Use with Fill', () => {
            const t = app.tools.setActive('fill') || app.tools.get('fill');
            t.setSetting('fillWith', 'pattern');
          }, 'small', 'bucket'),
          button('Use with Brush', () => app.tools.setActive('patternbrush'), 'small', 'pattern')
        )
      );
      app.bus.on('pattern:changed', renderLib);
      renderLib();
    }
  };
})(window.App2);
