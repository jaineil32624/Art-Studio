/**
 * Tool interface + ToolManager.
 *
 * A tool receives normalised pointer events in world coordinates:
 *   e = { x, y, sx, sy, pressure, button, buttons, shiftKey, altKey,
 *         ctrlKey, pointerType, tiltX, tiltY }
 *
 * Tools are registered with App2.tools.register({ id, create(app, def), … })
 * and instantiated by the ToolManager at startup. Brush engines registered in
 * App2.brushes are wrapped automatically in a BrushTool.
 *
 * Option schema (returned by getOptions(), rendered by ui/tool-options.js):
 *   { key, label, type: 'range', min, max, step, format?: 'pct'|'px'|'deg' }
 *   { key, label, type: 'select', choices: [[value, label], …] }
 *   { key, label, type: 'toggle' }
 *   { label, type: 'button', action: () => {} }
 * Any option may supply get() / set(v) to bind to something other than
 * tool.settings[key].
 */
(function (App2) {
  'use strict';

  const definitions = [];

  App2.tools.register = function (def) {
    if (!def || !def.id || typeof def.create !== 'function') throw new Error('Tool definition needs id and create()');
    definitions.push(def);
  };
  App2.tools.definitions = function () {
    return definitions.slice();
  };

  class Tool {
    constructor(app, def) {
      def = def || {};
      this.app = app;
      this.id = def.id;
      this.name = def.name || def.id;
      this.icon = def.icon || def.id;
      this.shortcut = def.shortcut || null;
      this.group = def.group || 'paint';
      this.order = def.order || 100;
      this.description = def.description || '';
      this.settings = Object.assign({}, def.defaults || {});
      this.cursor = 'crosshair';
      /** Holding Alt while pressing samples a color instead of using the tool. */
      this.altPicks = false;
      /** Whether the right mouse button is meaningful for this tool. */
      this.rightButton = false;
    }

    getOptions() {
      return [];
    }
    /** Optional: append extra custom UI under the standard options. */
    buildExtraUI(container) {} // eslint-disable-line no-unused-vars
    onActivate() {}
    onDeactivate() {}
    onPointerDown(e) {} // eslint-disable-line no-unused-vars
    onPointerMove(e) {} // eslint-disable-line no-unused-vars
    onPointerUp(e) {} // eslint-disable-line no-unused-vars
    onHover(e) {} // eslint-disable-line no-unused-vars
    /** Return true if the key was consumed. */
    onKeyDown(e) { // eslint-disable-line no-unused-vars
      return false;
    }
    /** Abort any in-progress interaction (e.g. a two-finger gesture started). */
    cancel() {}
    /** Draw previews; ctx is in screen CSS px (use renderer.applyWorldTransform for world). */
    drawOverlay(ctx, view, renderer) {} // eslint-disable-line no-unused-vars
    /** World-space radius of the brush cursor circle (0 = none). */
    cursorRadius() {
      return 0;
    }

    setSetting(key, value, source) {
      this.settings[key] = value;
      this.app.bus.emit('tool:setting', { tool: this, key, value, source: source || 'code' });
      this.app.renderer.requestRender();
    }

    /** Active layer, or null with a friendly warning if it cannot be painted. */
    paintableLayer() {
      const layer = this.app.doc.activeLayer;
      if (!layer) return null;
      if (!layer.visible) {
        this.app.toast('The active layer is hidden — show it to paint.', 'warn');
        return null;
      }
      return layer;
    }
  }

  class ToolManager {
    constructor(app) {
      this.app = app;
      this.tools = new Map();
      this.list = [];
      this.active = null;
    }

    init() {
      for (const def of App2.tools.definitions()) this.add(def.create(this.app, def));
      for (const engine of App2.brushes.list()) this.add(new App2.tools.BrushTool(this.app, engine));
      this.list.sort((a, b) => a.order - b.order);
    }

    add(tool) {
      if (this.tools.has(tool.id)) throw new Error('Duplicate tool id: ' + tool.id);
      this.tools.set(tool.id, tool);
      this.list.push(tool);
    }

    get(id) {
      return this.tools.get(id) || null;
    }

    setActive(id) {
      const tool = this.get(id);
      if (!tool || tool === this.active) return tool;
      const prev = this.active;
      if (prev) {
        prev.cancel();
        prev.onDeactivate();
      }
      this.active = tool;
      tool.onActivate();
      this.app.bus.emit('tool:changed', { tool, prev });
      this.app.renderer.requestRender();
      return tool;
    }

    findByShortcut(key) {
      const k = key.toLowerCase();
      return this.list.find((t) => t.shortcut && t.shortcut.toLowerCase() === k) || null;
    }
  }

  App2.tools.Tool = Tool;
  App2.tools.ToolManager = ToolManager;
})(window.App2);
