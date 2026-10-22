/**
 * Project (de)serialisation — the ".app2.json" format.
 *
 * {
 *   "format": "app2-project", "version": 1,
 *   "app": "App2 1.0.0", "name": "Untitled",
 *   "created": ISO, "modified": ISO,
 *   "background": "#ffffff" | null,
 *   "tileSize": 256,
 *   "activeLayer": <index>,
 *   "view": { "x", "y", "zoom" },
 *   "colors": { "primary", "secondary", "recent": [] },
 *   "layers": [ {                      // bottom → top
 *       "name", "visible", "opacity", "blend",
 *       "tiles": [ { "x": tx, "y": ty, "data": "data:image/png;base64,…" } ]
 *   } ]
 * }
 *
 * For interoperability a layer may instead carry a single image:
 *   { "name", …, "image": "data:image/png;base64,…", "x": worldX, "y": worldY }
 */
(function (App2) {
  'use strict';

  const { TiledLayer, TILE } = App2.canvas;
  const FORMAT = 'app2-project';
  const VERSION = 1;

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not decode image data'));
      img.src = src;
    });
  }

  // Encoded tiles are cached per layer and reused while layer.version is
  // unchanged, so frequent autosaves only re-encode layers that changed.
  const encodeCache = new WeakMap();

  function encodeTiles(layer) {
    const hit = encodeCache.get(layer);
    if (hit && hit.version === layer.version) return hit.tiles;
    const tiles = [];
    layer.forEachTile((tile, tx, ty) => {
      if (TiledLayer.isTileEmpty(tile)) return;
      tiles.push({ x: tx, y: ty, data: tile.toDataURL('image/png') });
    });
    encodeCache.set(layer, { version: layer.version, tiles });
    return tiles;
  }

  /** Serialise the app's document into a plain JSON-ready object. */
  function serialize(app) {
    const doc = app.doc;
    const layers = doc.layers.map((layer) => ({
      name: layer.name,
      visible: layer.visible,
      opacity: layer.opacity,
      blend: layer.blend,
      tiles: encodeTiles(layer),
    }));
    return {
      format: FORMAT,
      version: VERSION,
      app: 'App2 ' + App2.version,
      name: doc.name,
      created: doc.created,
      modified: new Date().toISOString(),
      background: doc.background,
      tileSize: TILE,
      activeLayer: doc.activeIndex,
      view: { x: app.view.x, y: app.view.y, zoom: app.view.zoom },
      colors: { primary: app.state.primary, secondary: app.state.secondary, recent: app.state.recent.slice() },
      layers,
    };
  }

  /** Parse and decode a project object. Resolves to { layers, meta }. */
  async function deserialize(obj) {
    if (typeof obj === 'string') obj = JSON.parse(obj);
    if (!obj || obj.format !== FORMAT || !Array.isArray(obj.layers)) {
      throw new Error('Not an App2 project file');
    }
    if (obj.version > VERSION) console.warn('[App2] project version ' + obj.version + ' is newer than supported (' + VERSION + ')');
    const ts = obj.tileSize || TILE;
    const layers = [];
    for (const L of obj.layers) {
      const layer = new TiledLayer({
        name: String(L.name || 'Layer'),
        visible: L.visible !== false,
        opacity: typeof L.opacity === 'number' ? L.opacity : 1,
        blend: L.blend || 'source-over',
      });
      if (Array.isArray(L.tiles)) {
        const imgs = await Promise.all(L.tiles.map((t) => loadImage(t.data).then((img) => ({ t, img }))));
        for (const { t, img } of imgs) {
          if (ts === TILE) {
            const c = TiledLayer.createTileCanvas();
            c.getContext('2d').drawImage(img, 0, 0);
            layer.tiles.set(TiledLayer.key(t.x, t.y), c);
          } else {
            const x = t.x * ts, y = t.y * ts;
            layer.paint({ x, y, w: img.width, h: img.height }, (ctx) => ctx.drawImage(img, x, y));
          }
        }
      } else if (L.image) {
        const img = await loadImage(L.image);
        const x = L.x || 0, y = L.y || 0;
        layer.paint({ x, y, w: img.width, h: img.height }, (ctx) => ctx.drawImage(img, x, y));
      }
      layers.push(layer);
    }
    return { layers, meta: obj };
  }

  /** Replace the current document with a decoded project. */
  function apply(app, loaded) {
    const meta = loaded.meta;
    const doc = app.doc;
    app.tools.active && app.tools.active.cancel();
    doc.name = meta.name || 'Untitled';
    doc.created = meta.created || new Date().toISOString();
    doc.background = meta.background === undefined ? '#ffffff' : meta.background;
    const layers = loaded.layers.length ? loaded.layers : [doc.createLayer('Layer 1')];
    doc.replaceLayers(layers, meta.activeLayer);
    if (meta.view && isFinite(meta.view.zoom)) app.view.set(meta.view.x, meta.view.y, meta.view.zoom);
    if (meta.colors) {
      if (meta.colors.primary) app.state.setColor(meta.colors.primary, 'primary');
      if (meta.colors.secondary) app.state.setColor(meta.colors.secondary, 'secondary');
      if (Array.isArray(meta.colors.recent)) {
        app.state.recent = meta.colors.recent.slice(0, 18);
        app.bus.emit('recent:changed');
      }
    }
    app.history.clear();
    app.bus.emit('background:changed', doc.background);
    app.bus.emit('project:loaded');
  }

  App2.io.Project = { FORMAT, VERSION, serialize, deserialize, apply, loadImage };
})(window.App2);
