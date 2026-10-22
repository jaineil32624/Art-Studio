/**
 * Inline SVG icon set (24×24, stroke-based, uses currentColor).
 * App2.ui.icon(name, size?) → SVG markup string.
 */
(function (App2) {
  'use strict';

  const P = {
    brush: '<path d="M19.5 3.5a2.1 2.1 0 0 1 3 3L12 17l-3-3z"/><path d="M8.5 14.5c-2.2 0-3.7 1.6-3.7 3.6 0 1.4-.9 2.3-2.3 2.8 1.4.9 3 1.3 4.5 1.3 3 0 4.6-2 4.6-4.6z"/>',
    pencil: '<path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z"/><path d="M14.5 6.5l3 3"/><path d="M4 20l3.2-.8"/>',
    marker: '<path d="M14 4l6 6-8.5 8.5H7.5v-4z"/><path d="M7.5 18.5L5 21H3"/><path d="M11.5 6.5l6 6"/>',
    eraser: '<path d="M8 20h12"/><path d="M4.2 14.8l9.6-9.6a2 2 0 0 1 2.8 0l3.2 3.2a2 2 0 0 1 0 2.8L11 20H8.4a2 2 0 0 1-1.4-.6L4.2 16.6a1.3 1.3 0 0 1 0-1.8z"/><path d="M9 10l5.5 5.5"/>',
    pixel: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7" fill="currentColor"/>',
    drop: '<path d="M12 2.7s-6.5 7-6.5 11.6a6.5 6.5 0 0 0 13 0C18.5 9.7 12 2.7 12 2.7z"/><path d="M9 14.5a3 3 0 0 0 3 3"/>',
    oil: '<path d="M13 3h6v8h-6z"/><path d="M14 11v3h4v-3"/><path d="M16 14v3l-3 4"/><path d="M14.5 3v4M17.5 3v4"/><path d="M4 21c1.5-3 4-4 7-4"/>',
    spray: '<rect x="5" y="9" width="8" height="12" rx="2"/><path d="M7 9V6h4v3"/><path d="M16 4h.01M19 2.5h.01M19 6h.01M22 4h.01M17 8.5h.01M21 9h.01"/>',
    flow: '<path d="M3 7c3-3 6 3 9 0s6-2 9 0"/><path d="M3 12c3-3 6 3 9 0s6-2 9 0"/><path d="M3 17c3-3 6 3 9 0s6-2 9 0"/>',
    ribbon: '<path d="M3 16c2.5-7 5.5 2 8.5-4s5 3 9.5-5"/><path d="M3 19c2.5-7 5.5 2 8.5-4s5 3 9.5-5"/><path d="M6 13.5v4M11.5 12v3.5M16 10v4"/>',
    leaf: '<path d="M5 19C5 10 10 5 20 4c-1 10-6 15-15 15z"/><path d="M5 19l9-9"/>',
    sketchy: '<path d="M3 18L8 6l5 10 3-7 5 9"/><path d="M5 14l8 2M8 6l8 3M13 16l8 2"/>',
    pattern: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
    bucket: '<path d="M18 11.5L10.5 4 3 11.5l7.5 7.5z"/><path d="M6.5 2.5l4 4"/><path d="M3 11.5h15"/><path d="M20.5 14s-1.8 2.2-1.8 3.6a1.8 1.8 0 0 0 3.6 0c0-1.4-1.8-3.6-1.8-3.6z"/>',
    gradient: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 21L21 3" opacity=".5"/><path d="M8 3L3 8M14 3L3 14M21 10L10 21M21 16l-5 5"/>',
    shapes: '<rect x="3" y="11" width="9" height="9" rx="1"/><circle cx="16.5" cy="7.5" r="4.5"/>',
    eyedropper: '<path d="M2.5 21.5l1.2-.3 9.6-9.6"/><path d="M3.7 21.2l-.3-3.3 9.6-9.6"/><path d="M15 6.2l2.7-2.7a2.2 2.2 0 0 1 3.1 3.1L18 9.3l1 1-2 2-6.3-6.3 2-2z"/>',
    sticker: '<path d="M15 3H6a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h9l6-6V6a3 3 0 0 0-3-3z"/><path d="M15 21v-4a2 2 0 0 1 2-2h4"/><path d="M8.5 13.5s1.3 1.5 3.5 1.5 3.5-1.5 3.5-1.5"/><path d="M9 9h.01M15 9h.01"/>',
    hand: '<path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-5.9-2.4L3.4 16.8a2 2 0 0 1 3-2.6L8 16"/>',
    select: '<path d="M4 8V4h4M10 4h4M16 4h4v4M20 10v4M20 16v4h-4M14 20h-4M8 20H4v-4M4 14v-4"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M3 3l18 18"/><path d="M10.6 5.1A9.8 9.8 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 3.9M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/><path d="M10 11v6M14 11v6"/>',
    copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
    up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
    down: '<path d="M12 5v14M5 12l7 7 7-7"/>',
    merge: '<path d="M8 3v5a4 4 0 0 0 4 4 4 4 0 0 1 4 4v5"/><path d="M16 3v5a4 4 0 0 1-4 4"/><path d="M13 18l3 3 3-3"/>',
    clear: '<path d="M4 4l16 16M20 4L4 20" opacity=".0"/><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9l6 6M15 9l-6 6"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/>',
    upload: '<path d="M12 21V9M7 14l5-5 5 5"/><path d="M5 3h14"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
    swap: '<path d="M7 4L3 8l4 4"/><path d="M3 8h13a4 4 0 0 1 4 4"/><path d="M17 20l4-4-4-4"/><path d="M21 16H8a4 4 0 0 1-4-4"/>',
    zoomIn: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-5-5M11 8v6M8 11h6"/>',
    zoomOut: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-5-5M8 11h6"/>',
    fit: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>',
    x: '<path d="M18 6L6 18M6 6l12 12"/>',
    check: '<path d="M5 12l5 5L20 7"/>',
    dice: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 8h.01M16 8h.01M12 12h.01M8 16h.01M16 16h.01"/>',
    layers: '<path d="M12 2L2 7l10 5 10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>',
    palette: '<path d="M12 2a10 10 0 0 0 0 20c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.4A5.6 5.6 0 0 0 22 9.8C22 5.5 17.5 2 12 2z"/><path d="M7.5 11.5h.01M8.5 7.5h.01M12.5 6h.01M16.5 8h.01"/>',
    sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    symmetry: '<path d="M12 2v20" stroke-dasharray="2 2"/><path d="M9 6L4 12l5 6z"/><path d="M15 6l5 6-5 6z"/>',
    sparkles: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
    texture: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 15c3-2 5 1 8-1s5-5 10-3"/><path d="M3 9c3-2 6 0 9-2s5-2 9-1"/>',
    newfile: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M12 12v6M9 15h6"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    restore: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 3"/>',
    chevron: '<path d="M6 9l6 6 6-6"/>',
  };

  App2.ui.icons = P;
  App2.ui.icon = function (name, size) {
    const s = size || 20;
    return (
      '<svg class="icon" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      (P[name] || P.brush) +
      '</svg>'
    );
  };
})(window.App2);
