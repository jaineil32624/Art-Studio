/**
 * Export: PNG (transparent or with background), JPG (flattened onto white)
 * and project files (.app2.json). Downloads use an <a download> link with an
 * object URL, which also works when the app runs from file://.
 */
(function (App2) {
  'use strict';

  const { Project } = App2.io;
  const MAX_SIDE = 12000;

  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 1500);
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
      if (canvas.toBlob) {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Encoding failed'))), type, quality);
      } else {
        try {
          const data = canvas.toDataURL(type, quality);
          const bin = atob(data.split(',')[1]);
          const arr = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
          resolve(new Blob([arr], { type }));
        } catch (err) {
          reject(err);
        }
      }
    });
  }

  function safeName(name) {
    return (name || 'artwork').replace(/[^a-z0-9_\- ]+/gi, '').trim().replace(/\s+/g, '-') || 'artwork';
  }

  /**
   * Flatten visible layers into a canvas cropped to the artwork bounds.
   * opts.background — fill color (or null for transparency)
   * opts.padding — extra px around the content
   * Returns null if the document is empty.
   */
  function flatten(app, opts) {
    opts = opts || {};
    const bounds = app.doc.contentBounds();
    if (!bounds) return null;
    const pad = opts.padding || 0;
    const rect = { x: bounds.x - pad, y: bounds.y - pad, w: bounds.w + pad * 2, h: bounds.h + pad * 2 };
    const scale = Math.min(1, MAX_SIDE / Math.max(rect.w, rect.h));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(rect.w * scale));
    c.height = Math.max(1, Math.round(rect.h * scale));
    app.doc.composite(c.getContext('2d'), rect, { scale, background: opts.background || null });
    return c;
  }

  async function exportImage(app, type, opts) {
    const isJpg = type === 'image/jpeg';
    const canvas = flatten(app, { background: isJpg ? '#ffffff' : opts && opts.background ? app.doc.background : null, padding: (opts && opts.padding) || 0 });
    if (!canvas) {
      app.toast('Nothing to export yet — draw something first!', 'warn');
      return;
    }
    const blob = await canvasToBlob(canvas, type, isJpg ? 0.92 : undefined);
    download(blob, safeName(app.doc.name) + (isJpg ? '.jpg' : '.png'));
    app.toast('Exported ' + canvas.width + '×' + canvas.height + (isJpg ? ' JPG' : ' PNG') + '.', 'success');
  }

  const Export = {
    download,
    flatten,
    canvasToBlob,
    /** Transparent PNG (opts.background = true → include paper color). */
    png: (app, opts) => exportImage(app, 'image/png', opts),
    /** JPG flattened onto white. */
    jpg: (app) => exportImage(app, 'image/jpeg'),
    /** Download the project as .app2.json. */
    project(app) {
      const json = JSON.stringify(Project.serialize(app));
      download(new Blob([json], { type: 'application/json' }), safeName(app.doc.name) + '.app2.json');
      app.toast('Project exported (' + (json.length / 1024).toFixed(0) + ' KB).', 'success');
    },
    /** Read a File object as text / data URL. */
    readFile(file, as) {
      return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => reject(r.error || new Error('Could not read file'));
        if (as === 'dataURL') r.readAsDataURL(file);
        else r.readAsText(file);
      });
    },
    /** Import a project File. */
    async importProject(app, file) {
      const text = await Export.readFile(file, 'text');
      const loaded = await Project.deserialize(text);
      Project.apply(app, loaded);
      app.zoomToFit();
      app.toast('Opened "' + (app.doc.name || file.name) + '".', 'success');
    },
    /** Import an image File and start placing it on a new layer. */
    async importImage(app, file) {
      const url = await Export.readFile(file, 'dataURL');
      const img = await Project.loadImage(url);
      const c = document.createElement('canvas');
      c.width = img.naturalWidth || img.width;
      c.height = img.naturalHeight || img.height;
      c.getContext('2d').drawImage(img, 0, 0);
      const tool = app.tools.setActive('sticker') || app.tools.get('sticker');
      const z = app.view.zoom;
      const fit = Math.min(1, (app.view.width * 0.8) / z / c.width, (app.view.height * 0.8) / z / c.height);
      tool.place(c, { name: file.name.replace(/\.[^.]+$/, ''), newLayer: true, scale: fit });
      app.toast('Position the image, then press Enter (or Apply).');
    },
  };

  App2.io.Export = Export;
})(window.App2);
