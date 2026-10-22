/**
 * Symmetry drawing. Each symmetry mode is expressed as a list of affine
 * matrices around the symmetry center; tools apply every matrix to the
 * input (points for brushes, ctx.transform for shapes). The first matrix
 * is always the identity.
 */
(function (App2) {
  'use strict';

  const M = App2.core.math;

  const MODES = [
    ['off', 'Off'],
    ['vertical', 'Mirror ↔ (vertical axis)'],
    ['horizontal', 'Mirror ↕ (horizontal axis)'],
    ['quad', 'Both axes (4-way)'],
    ['radial', 'Radial (N-way)'],
    ['kaleido', 'Kaleidoscope (N-way + mirror)'],
  ];

  const Symmetry = {
    MODES,

    matrices(sym) {
      if (!sym || sym.mode === 'off') return [M.matIdentity()];
      const cx = sym.cx || 0, cy = sym.cy || 0;
      const n = M.clamp(sym.count | 0, 2, 32);
      const about = (m) => M.matAbout(cx, cy, m);
      const flipX = [-1, 0, 0, 1, 0, 0];
      const flipY = [1, 0, 0, -1, 0, 0];
      switch (sym.mode) {
        case 'vertical':
          return [M.matIdentity(), about(flipX)];
        case 'horizontal':
          return [M.matIdentity(), about(flipY)];
        case 'quad':
          return [M.matIdentity(), about(flipX), about(flipY), about([-1, 0, 0, -1, 0, 0])];
        case 'radial': {
          const out = [];
          for (let i = 0; i < n; i++) out.push(about(M.matRotate((i * Math.PI * 2) / n)));
          return out;
        }
        case 'kaleido': {
          const out = [];
          for (let i = 0; i < n; i++) {
            const R = M.matRotate((i * Math.PI * 2) / n);
            out.push(about(R));
            out.push(about(M.matMultiply(R, flipX)));
          }
          return out;
        }
        default:
          return [M.matIdentity()];
      }
    },

    /** Draw guide lines in screen space. */
    drawGuides(ctx, view, sym) {
      if (!sym || sym.mode === 'off') return;
      const c = view.worldToScreen(sym.cx || 0, sym.cy || 0);
      const far = Math.hypot(view.width, view.height) * 2;
      ctx.save();
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = 'rgba(80, 200, 255, 0.75)';
      const line = (ang) => {
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        ctx.lineTo(c.x + Math.cos(ang) * far, c.y + Math.sin(ang) * far);
        ctx.stroke();
      };
      switch (sym.mode) {
        case 'vertical':
          line(-Math.PI / 2); line(Math.PI / 2);
          break;
        case 'horizontal':
          line(0); line(Math.PI);
          break;
        case 'quad':
          line(0); line(Math.PI / 2); line(Math.PI); line(-Math.PI / 2);
          break;
        case 'radial':
        case 'kaleido': {
          const n = M.clamp(sym.count | 0, 2, 32);
          for (let i = 0; i < n; i++) line(-Math.PI / 2 + (i * Math.PI * 2) / n);
          break;
        }
      }
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(80, 200, 255, 0.95)';
      ctx.beginPath();
      ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
  };

  App2.canvas.Symmetry = Symmetry;
})(window.App2);
