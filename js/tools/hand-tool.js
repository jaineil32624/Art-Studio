/**
 * Hand tool — drag to pan the infinite canvas. (Panning is also available
 * at any time with Space+drag, the middle mouse button or two fingers.)
 * The actual panning is performed by ui/canvas-input.js, which treats this
 * tool as a "pan" tool.
 */
(function (App2) {
  'use strict';

  const { Tool } = App2.tools;

  class HandTool extends Tool {
    constructor(app, def) {
      super(app, def);
      this.cursor = 'grab';
      this.pans = true;
    }
    getOptions() {
      const app = this.app;
      return [
        { label: 'Zoom to fit artwork', type: 'button', action: () => app.zoomToFit() },
        { label: 'Reset to 100%', type: 'button', action: () => app.view.zoomBy(1 / app.view.zoom) },
      ];
    }
  }

  App2.tools.register({
    id: 'hand',
    name: 'Hand (pan)',
    icon: 'hand',
    shortcut: 'h',
    group: 'nav',
    order: 1,
    description: 'Drag to pan. Anytime: Space+drag, middle mouse or two fingers.',
    create: (app, def) => new HandTool(app, def),
  });
})(window.App2);
