/**
 * Eraser — a buffered round tip committed with "destination-out", so the
 * eraser opacity behaves like a single pass (no build-up within a stroke).
 */
(function (App2) {
  'use strict';

  const BLACK = { r: 0, g: 0, b: 0 };

  App2.brushes.register({
    id: 'eraser',
    name: 'Eraser',
    icon: 'eraser',
    shortcut: 'e',
    group: 'paint',
    order: 40,
    description: 'Erase to transparency on the active layer.',
    buffered: true,
    composite: 'destination-out',
    usesColor: false,
    defaults: { size: 32, opacity: 1, hardness: 0.8, spacing: 0.08 },
    dab(s, p) {
      s.dab(p.x, p.y, p.radius, p.alpha, s.settings.hardness, BLACK);
    },
  });
})(window.App2);
