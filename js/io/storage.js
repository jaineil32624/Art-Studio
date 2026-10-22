/**
 * Browser storage (localStorage): debounced autosave + manual save slot.
 * localStorage is typically limited to ~5–10 MB per origin, so very large
 * artworks may not fit; in that case the user is told to export a project
 * file instead.
 */
(function (App2) {
  'use strict';

  const { Project } = App2.io;
  const KEY_AUTO = 'app2.autosave.v1';
  const KEY_SAVE = 'app2.save.v1';
  const AUTOSAVE_DELAY = 2500;

  function storageAvailable() {
    try {
      const k = '__app2_test__';
      window.localStorage.setItem(k, '1');
      window.localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  }

  class Storage {
    constructor(app) {
      this.app = app;
      this.available = storageAvailable();
      this.enabled = true;
      this._timer = 0;
      this._dirty = false;
      this._warned = false;
      this.lastSaved = null;
    }

    static get KEY_AUTO() {
      return KEY_AUTO;
    }
    static get KEY_SAVE() {
      return KEY_SAVE;
    }

    has(key) {
      if (!this.available) return false;
      try {
        return !!localStorage.getItem(key);
      } catch (e) {
        return false;
      }
    }

    /** Save to a slot. Returns { ok, bytes, error }. */
    saveTo(key) {
      if (!this.available) return { ok: false, error: 'Browser storage is not available here.' };
      let json;
      try {
        json = JSON.stringify(Project.serialize(this.app));
      } catch (err) {
        return { ok: false, error: err.message };
      }
      try {
        localStorage.setItem(key, json);
        this.lastSaved = new Date();
        this._dirty = false;
        this.app.bus.emit('storage:saved', { key, bytes: json.length });
        return { ok: true, bytes: json.length };
      } catch (err) {
        const quota = err && (err.name === 'QuotaExceededError' || err.code === 22 || err.code === 1014);
        return {
          ok: false,
          bytes: json.length,
          error: quota ? 'Artwork is too large for browser storage (' + (json.length / 1048576).toFixed(1) + ' MB). Use File → Export project instead.' : err.message,
        };
      }
    }

    /** Manual save (Ctrl+S). Also refreshes the autosave slot. */
    save() {
      const res = this.saveTo(KEY_SAVE);
      if (res.ok) {
        this.saveTo(KEY_AUTO);
        this.app.toast('Saved to this browser (' + (res.bytes / 1024).toFixed(0) + ' KB).', 'success');
      } else this.app.toast(res.error, 'error', 6000);
      return res;
    }

    async loadFrom(key) {
      if (!this.has(key)) return false;
      const raw = localStorage.getItem(key);
      const loaded = await Project.deserialize(raw);
      Project.apply(this.app, loaded);
      this._dirty = false;
      return true;
    }

    /** On startup, restore the autosave (or the manual save). */
    async restoreOnStartup() {
      try {
        if (await this.loadFrom(KEY_AUTO)) return 'autosave';
        if (await this.loadFrom(KEY_SAVE)) return 'save';
      } catch (err) {
        console.error('[App2] restore failed', err);
        this.app.toast('Could not restore the previous session: ' + err.message, 'error');
      }
      return null;
    }

    clearAutosave() {
      try {
        localStorage.removeItem(KEY_AUTO);
      } catch (e) {
        /* ignore */
      }
    }

    /** Debounced autosave after document changes. */
    startAutosave() {
      if (!this.available) return;
      const schedule = () => {
        this._dirty = true;
        clearTimeout(this._timer);
        this._timer = setTimeout(() => this._autosave(), AUTOSAVE_DELAY);
      };
      this.app.bus.on('doc:changed', schedule);
      this.app.bus.on('layers:changed', schedule);
      window.addEventListener('beforeunload', () => {
        if (this._dirty && this.enabled && !this.app.history.busy) this.saveTo(KEY_AUTO);
      });
    }

    _autosave() {
      if (!this.enabled || !this._dirty) return;
      if (this.app.history.busy) {
        // A stroke is in progress — try again shortly.
        this._timer = setTimeout(() => this._autosave(), 800);
        return;
      }
      const res = this.saveTo(KEY_AUTO);
      if (!res.ok && !this._warned) {
        this._warned = true;
        this.app.toast('Autosave paused: ' + res.error, 'warn', 7000);
      } else if (res.ok) this._warned = false;
    }
  }

  App2.io.Storage = Storage;
})(window.App2);
