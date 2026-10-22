/**
 * App2 — root namespace.
 *
 * Every script in the project attaches itself to `window.App2`. We use classic
 * <script> tags (not ES modules) so the app works when index.html is opened
 * directly from disk via file://, where module imports are blocked by CORS.
 *
 * Sub-namespaces:
 *   App2.core     – event bus, math, color, noise, app state
 *   App2.canvas   – tiled layers, document, viewport, history, renderer
 *   App2.tools    – Tool base class, tool manager, individual tools
 *   App2.brushes  – brush engine registry and engines
 *   App2.creative – textures, stickers, patterns, palettes
 *   App2.io       – storage, project (de)serialisation, export
 *   App2.ui       – DOM panels and input handling
 */
(function (global) {
  'use strict';

  const App2 = global.App2 || {};
  App2.version = '1.0.0';

  ['core', 'canvas', 'tools', 'brushes', 'creative', 'io', 'ui'].forEach(function (ns) {
    App2[ns] = App2[ns] || {};
  });

  global.App2 = App2;
})(window);
