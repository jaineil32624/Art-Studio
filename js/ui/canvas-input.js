/**
 * Canvas input: converts Pointer Events on the stage canvas into tool calls
 * and handles navigation.
 *
 *   - One pointer (mouse / pen / finger)  → active tool
 *   - Space + drag, middle mouse, Hand tool → pan
 *   - Two fingers                            → pinch-zoom + pan (cancels any stroke)
 *   - Mouse wheel → zoom at cursor; Shift+wheel → pan horizontally;
 *     Ctrl+wheel (trackpad pinch) → zoom
 *   - Alt + click with painting tools        → eyedropper
 *   - Coalesced events are used for smooth, high-frequency pen input.
 */
(function (App2) {
  'use strict';

  const { math: M } = App2.core;

  class CanvasInput {
    constructor(app, canvas) {
      this.app = app;
      this.canvas = canvas;
      this.pointers = new Map(); // pointerId → {x, y, type}
      this.mode = null; // 'tool' | 'pan' | 'pick' | 'gesture' | 'ignore'
      this.toolPointer = null;
      this.spaceDown = false;
      this.last = null;
      this.gesture = null;

      canvas.addEventListener('pointerdown', (e) => this._down(e));
      canvas.addEventListener('pointermove', (e) => this._move(e));
      canvas.addEventListener('pointerup', (e) => this._up(e));
      canvas.addEventListener('pointercancel', (e) => this._up(e, true));
      canvas.addEventListener('pointerleave', () => {
        app.renderer.hover = null;
        app.renderer.requestRender();
      });
      canvas.addEventListener('wheel', (e) => this._wheel(e), { passive: false });
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
      // Prevent Safari's own gesture zoom on the canvas.
      canvas.addEventListener('gesturestart', (e) => e.preventDefault());
      app.bus.on('tool:changed', () => this.updateCursor());
    }

    get panning() {
      return this.mode === 'pan' || this.mode === 'gesture';
    }

    setCursor(c) {
      if (this.canvas.style.cursor !== c) this.canvas.style.cursor = c;
    }

    updateCursor() {
      if (this.mode === 'pan') this.setCursor('grabbing');
      else if (this.spaceDown) this.setCursor('grab');
      else this.setCursor((this.app.tools.active && this.app.tools.active.cursor) || 'crosshair');
    }

    setSpace(down) {
      if (this.spaceDown === down) return;
      this.spaceDown = down;
      this.updateCursor();
    }

    /** Normalised event for tools. */
    evt(e) {
      const r = this.canvas.getBoundingClientRect();
      const sx = e.clientX - r.left, sy = e.clientY - r.top;
      const w = this.app.view.screenToWorld(sx, sy);
      return {
        x: w.x,
        y: w.y,
        sx,
        sy,
        pressure: e.pressure,
        button: e.button,
        buttons: e.buttons,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        ctrlKey: e.ctrlKey || e.metaKey,
        pointerType: e.pointerType || 'mouse',
        tiltX: e.tiltX || 0,
        tiltY: e.tiltY || 0,
      };
    }

    _touchCount() {
      let n = 0;
      for (const p of this.pointers.values()) if (p.type === 'touch') n++;
      return n;
    }

    _down(e) {
      const app = this.app;
      e.preventDefault();
      if (document.activeElement && document.activeElement !== document.body && document.activeElement.blur) document.activeElement.blur();
      try {
        this.canvas.setPointerCapture(e.pointerId);
      } catch (err) {
        /* ignore */
      }
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });

      // Second finger → pinch/pan gesture (cancel the stroke started by the first).
      if (e.pointerType === 'touch' && this._touchCount() >= 2) {
        if (this.mode === 'tool' && app.tools.active) app.tools.active.cancel();
        this.mode = 'gesture';
        this._gestureStart();
        return;
      }
      if (this.mode) return; // already busy with another pointer

      const tool = app.tools.active;
      const ev = this.evt(e);
      if (e.button === 1 || this.spaceDown || (tool && tool.pans)) {
        this.mode = 'pan';
        this.last = { x: e.clientX, y: e.clientY };
        this.updateCursor();
        return;
      }
      if (e.altKey && tool && tool.altPicks) {
        this.mode = 'pick';
        App2.tools.EyedropperTool.pick(app, ev.x, ev.y, e.button === 2 ? 'secondary' : 'primary', false);
        return;
      }
      if (!tool) return;
      // Only left button / pen / touch, or right button for tools that use it.
      if (e.pointerType === 'mouse' && e.button !== 0 && !(e.button === 2 && tool.rightButton)) return;
      this.mode = 'tool';
      this.toolPointer = e.pointerId;
      try {
        tool.onPointerDown(ev);
      } catch (err) {
        console.error(err);
        app.toast('Tool error: ' + err.message, 'error');
        this.mode = null;
      }
      app.renderer.requestRender();
    }

    _move(e) {
      const app = this.app;
      const p = this.pointers.get(e.pointerId);
      if (p) {
        p.x = e.clientX;
        p.y = e.clientY;
      }
      const r = this.canvas.getBoundingClientRect();
      if (e.pointerType !== 'touch') app.renderer.hover = { x: e.clientX - r.left, y: e.clientY - r.top };

      switch (this.mode) {
        case 'gesture':
          this._gestureMove();
          return;
        case 'pan':
          app.view.panBy(e.clientX - this.last.x, e.clientY - this.last.y);
          this.last = { x: e.clientX, y: e.clientY };
          return;
        case 'pick': {
          const ev = this.evt(e);
          App2.tools.EyedropperTool.pick(app, ev.x, ev.y, 'primary', false);
          return;
        }
        case 'tool': {
          if (e.pointerId !== this.toolPointer) return;
          const tool = app.tools.active;
          const list = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
          const events = list && list.length ? list : [e];
          try {
            for (const ce of events) tool.onPointerMove(this.evt(ce));
          } catch (err) {
            console.error(err);
          }
          app.renderer.requestRender();
          return;
        }
        case 'ignore':
          return;
        default: {
          const tool = app.tools.active;
          if (tool && !this.spaceDown) tool.onHover(this.evt(e));
          app.renderer.requestRender();
        }
      }
    }

    _up(e, cancelled) {
      const app = this.app;
      this.pointers.delete(e.pointerId);
      try {
        this.canvas.releasePointerCapture(e.pointerId);
      } catch (err) {
        /* ignore */
      }
      switch (this.mode) {
        case 'gesture':
          // Wait for all fingers to lift before allowing new strokes.
          this.mode = this.pointers.size ? 'ignore' : null;
          this.gesture = null;
          break;
        case 'ignore':
          if (!this.pointers.size) this.mode = null;
          break;
        case 'pan':
        case 'pick':
          this.mode = null;
          if (this.mode === null && this.last) this.last = null;
          this.updateCursor();
          break;
        case 'tool':
          if (e.pointerId !== this.toolPointer) break;
          this.mode = null;
          this.toolPointer = null;
          try {
            if (cancelled) app.tools.active.cancel();
            else app.tools.active.onPointerUp(this.evt(e));
          } catch (err) {
            console.error(err);
            app.toast('Tool error: ' + err.message, 'error');
          }
          break;
      }
      app.renderer.requestRender();
    }

    _gestureStart() {
      const pts = Array.from(this.pointers.values()).filter((p) => p.type === 'touch').slice(0, 2);
      if (pts.length < 2) return;
      const r = this.canvas.getBoundingClientRect();
      const cx = (pts[0].x + pts[1].x) / 2 - r.left, cy = (pts[0].y + pts[1].y) / 2 - r.top;
      this.gesture = {
        dist: Math.max(10, Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y)),
        zoom: this.app.view.zoom,
        world: this.app.view.screenToWorld(cx, cy),
      };
    }

    _gestureMove() {
      const g = this.gesture;
      if (!g) return this._gestureStart();
      const pts = Array.from(this.pointers.values()).filter((p) => p.type === 'touch').slice(0, 2);
      if (pts.length < 2) return;
      const r = this.canvas.getBoundingClientRect();
      const cx = (pts[0].x + pts[1].x) / 2 - r.left, cy = (pts[0].y + pts[1].y) / 2 - r.top;
      const d = Math.max(10, Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y));
      const v = this.app.view;
      const z = M.clamp((g.zoom * d) / g.dist, v.minZoom, v.maxZoom);
      // Keep the world point that was under the initial midpoint under the current midpoint.
      v.set(g.world.x - cx / z, g.world.y - cy / z, z);
    }

    _wheel(e) {
      e.preventDefault();
      const app = this.app;
      const r = this.canvas.getBoundingClientRect();
      const sx = e.clientX - r.left, sy = e.clientY - r.top;
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      const dy = e.deltaY * unit, dx = e.deltaX * unit;
      if (e.shiftKey && !e.ctrlKey) {
        app.view.panBy(-(dy || dx), 0);
        return;
      }
      const k = e.ctrlKey ? 0.01 : 0.0015;
      app.view.zoomAt(sx, sy, app.view.zoom * Math.exp(-dy * k));
    }
  }

  App2.ui.CanvasInput = CanvasInput;
})(window.App2);
