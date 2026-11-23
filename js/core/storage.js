/* Persistent state in localStorage (single JSON document, versioned). */
(function () {
  'use strict';
  const KEY = window.BCS_CONFIG.STORAGE_KEY;
  const VERSION = 1;

  function defaults() {
    return {
      version: VERSION,
      settings: {
        theme: (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light',
        selectedBcs: null,
        examOverrides: {},                         // { [bcs]: {questions,durationMin,correctMark,negativeMark} }
        practiceMarking: { correctMark: 1, negativeMark: 0.5 }
      },
      imported: [],                                // normalized imported questions
      exams: [],                                   // completed exam records
      activeExam: null,                            // in-progress exam (survives refresh)
      practice: {
        attempts: {},                              // { [qid]: {sel, ok, s, t, bcs, at, tries} } — latest attempt per question
        log: []                                    // [{qid, ok, at}] every recorded attempt (capped)
      },
      practiceSession: null,                       // current practice session (survives refresh)
      bookmarks: []
    };
  }

  function merge(base, saved) {
    if (!saved || typeof saved !== 'object') return base;
    const out = Array.isArray(base) ? saved : { ...base };
    for (const k of Object.keys(saved)) {
      const b = base[k], s = saved[k];
      if (b && typeof b === 'object' && !Array.isArray(b) && s && typeof s === 'object' && !Array.isArray(s)) out[k] = merge(b, s);
      else out[k] = s;
    }
    return out;
  }

  let state = defaults();
  let storageOk = true;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) state = merge(defaults(), JSON.parse(raw));
    } catch (e) {
      console.error('Failed to load saved data', e);
      storageOk = false;
    }
    return state;
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      console.error('Save failed', e);
      if (window.UI) UI.toast('Could not save data (browser storage full or blocked). Export a backup.', 'error', 6000);
      return false;
    }
  }

  function exportBackup() {
    return JSON.stringify({ app: 'bcs-prep-platform', exportedAt: new Date().toISOString(), data: state }, null, 2);
  }

  function importBackup(text) {
    const parsed = JSON.parse(text);
    const data = parsed && parsed.data ? parsed.data : parsed;
    if (!data || typeof data !== 'object' || !data.settings || !Array.isArray(data.exams)) {
      throw new Error('This file is not a valid backup from this app.');
    }
    state = merge(defaults(), data);
    save();
  }

  function reset(scope) {
    const d = defaults();
    if (scope === 'exam' || scope === 'all') { state.exams = []; state.activeExam = null; }
    if (scope === 'practice' || scope === 'all') { state.practice = d.practice; state.practiceSession = null; }
    if (scope === 'all') { state.bookmarks = []; }
    save();
  }

  window.Store = {
    get state() { return state; },
    load, save, exportBackup, importBackup, reset, defaults,
    get storageOk() { return storageOk; }
  };
})();
