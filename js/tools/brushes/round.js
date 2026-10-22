/**
 * Brush — the classic soft round brush. Buffered, so overlapping dabs inside
 * one stroke never exceed the chosen opacity.
 */
(function (App2) {
  'use strict';

  App2.brushes.register({
    id: 'brush',
    name: 'Brush',
    icon: 'brush',
    shortcut: 'b',
    group: 'paint',
    order: 10,
    description: 'Soft round brush with pressure-sensitive size.',
    buffered: true,
    defaults: { size: 18, opacity: 1, hardness: 0.65, spacing: 0.08 },
    dab(s, p) {
      s.dab(p.x, p.y, p.radius, p.alpha, s.settings.hardness);
    },
  });
})(window.App2);
