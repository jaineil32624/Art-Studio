/**
 * Minimal publish/subscribe event bus.
 *
 * Events used across the app (payloads in parentheses):
 *   doc:changed        – pixels changed somewhere (renderer + autosave + thumbnails)
 *   layers:changed     – layer list / layer properties changed
 *   history:changed    – undo/redo stacks changed
 *   tool:changed       ({tool, prev})
 *   tool:setting       ({tool, key, value, source})
 *   color:changed      ({which, hex})
 *   recent:changed     ()
 *   state:<key>        (value) – e.g. state:symmetry, state:pixel
 *   view:changed       – pan / zoom changed
 *   pattern:changed    – pattern library or active pattern changed
 */
(function (App2) {
  'use strict';

  class EventBus {
    constructor() {
      this._handlers = new Map();
    }

    /** Subscribe; returns an unsubscribe function. */
    on(type, fn) {
      if (!this._handlers.has(type)) this._handlers.set(type, new Set());
      this._handlers.get(type).add(fn);
      return () => this.off(type, fn);
    }

    off(type, fn) {
      const set = this._handlers.get(type);
      if (set) set.delete(fn);
    }

    once(type, fn) {
      const off = this.on(type, (payload) => {
        off();
        fn(payload);
      });
      return off;
    }

    /** Emit synchronously. One failing handler never breaks the others. */
    emit(type, payload) {
      const set = this._handlers.get(type);
      if (!set) return;
      for (const fn of Array.from(set)) {
        try {
          fn(payload);
        } catch (err) {
          console.error('[App2] handler for "' + type + '" failed:', err);
        }
      }
    }
  }

  App2.core.EventBus = EventBus;
})(window.App2);
