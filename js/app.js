/* App shell: router, theme, shared helpers. Views register on window.Views. */
(function () {
  'use strict';
  const C = window.BCS_CONFIG;
  window.Views = window.Views || {};

  const App = {
    examConfig(bcs) {
      const d = C.defaultExamConfig(bcs);
      const o = Store.state.settings.examOverrides[bcs] || {};
      return { ...d, ...o, isCustom: Object.keys(o).length > 0 };
    },
    get selectedBcs() { return Store.state.settings.selectedBcs; },
    set selectedBcs(v) { Store.state.settings.selectedBcs = v ? Number(v) : null; Store.save(); },

    bcsOptions(selected, { placeholder = 'Select a BCS examination…' } = {}) {
      const counts = QBank.bcsCounts();
      let html = `<option value="">${UI.esc(placeholder)}</option>`;
      for (let n = C.BCS_MIN; n <= C.BCS_MAX; n++) {
        const extra = counts[n] ? ` — ${counts[n]} questions` : '';
        html += `<option value="${n}" ${Number(selected) === n ? 'selected' : ''}>${C.ordinal(n)} BCS${extra}</option>`;
      }
      return html;
    },
    subjectOptions(selected, all = 'All subjects') {
      return `<option value="">${UI.esc(all)}</option>` + C.SUBJECTS.map(s => `<option value="${s.key}" ${selected === s.key ? 'selected' : ''}>${UI.esc(s.en)}</option>`).join('');
    },
    topicOptions(subject, selected) {
      return `<option value="">All topics</option>` + QBank.topics(subject).map(t => `<option value="${UI.esc(t.name)}" ${selected === t.name ? 'selected' : ''}>${UI.esc(t.name)} (${t.count})</option>`).join('');
    },

    go(hash) { if (location.hash === hash) render(); else location.hash = hash; },

    setTheme(t) {
      Store.state.settings.theme = t; Store.save();
      document.documentElement.setAttribute('data-theme', t);
      const b = document.getElementById('theme-toggle');
      if (b) b.setAttribute('aria-label', t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    },

    toggleBookmark(qid) {
      const bm = Store.state.bookmarks;
      const i = bm.indexOf(qid);
      if (i >= 0) bm.splice(i, 1); else bm.push(qid);
      Store.save();
      return i < 0;
    },
    isBookmarked(qid) { return Store.state.bookmarks.includes(qid); },

    updateExamBanner() {
      const el = document.getElementById('exam-banner');
      if (!el) return;
      const ax = Store.state.activeExam;
      const onRun = location.hash.startsWith('#/exam/run');
      if (ax && !onRun) {
        el.hidden = false;
        el.innerHTML = `<span>An exam (${C.ordinal(ax.bcs)} BCS) is in progress — the timer keeps running.</span><a class="btn btn-sm btn-primary" href="#/exam/run">Resume exam</a>`;
      } else el.hidden = true;
    }
  };
  window.App = App;

  /* ----------------------------- router ----------------------------- */
  const routes = [
    [/^#?\/?$/, 'dashboard'],
    [/^#\/exam\/setup$/, 'examSetup'],
    [/^#\/exam\/run$/, 'examRun'],
    [/^#\/result\/(.+)$/, 'examResult'],
    [/^#\/practice$/, 'practiceSetup'],
    [/^#\/practice\/run$/, 'practiceRun'],
    [/^#\/bank$/, 'bank'],
    [/^#\/analysis$/, 'analysis'],
    [/^#\/progress$/, 'progress'],
    [/^#\/history$/, 'history'],
    [/^#\/settings$/, 'settings'],
    [/^#\/about$/, 'about']
  ];

  let currentCleanup = null;

  function render() {
    const hash = location.hash || '#/';
    let view = 'dashboard', params = [];
    for (const [re, name] of routes) { const m = hash.match(re); if (m) { view = name; params = m.slice(1); break; } }
    if (typeof currentCleanup === 'function') { try { currentCleanup(); } catch (e) { console.error(e); } }
    currentCleanup = null;
    // fresh container per render so view-level event listeners never accumulate
    const old = document.getElementById('view');
    const host = old.cloneNode(false);
    old.replaceWith(host);
    host.className = 'view view-' + view;
    document.body.dataset.view = view;
    const fn = window.Views[view];
    try {
      currentCleanup = fn ? fn(host, ...params) : null;
    } catch (e) {
      console.error(e);
      host.innerHTML = `<div class="card"><h2>Something went wrong</h2><p class="muted">${UI.esc(e.message)}</p><a class="btn" href="#/">Back to dashboard</a></div>`;
    }
    // nav highlight
    const navKey = view.startsWith('exam') ? 'exam' : view.startsWith('practice') ? 'practice' : view;
    document.querySelectorAll('.nav a, .tabbar a').forEach(a => a.classList.toggle('active', a.dataset.nav === navKey));
    document.body.classList.remove('nav-open');
    App.updateExamBanner();
    if (window.PWA) PWA.keepAwake(view === 'examRun');
    window.scrollTo(0, 0);
  }

  function init() {
    Store.load();
    QBank.rebuild();
    App.setTheme(Store.state.settings.theme);
    document.getElementById('theme-toggle').addEventListener('click', () => App.setTheme(Store.state.settings.theme === 'dark' ? 'light' : 'dark'));
    document.getElementById('nav-toggle').addEventListener('click', () => document.body.classList.toggle('nav-open'));
    window.addEventListener('hashchange', render);
    // mobile: expand/collapse the question palette panel
    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-side-toggle]'); if (!t) return;
      const side = t.closest('.exam-side'); const open = side.classList.toggle('open');
      t.setAttribute('aria-expanded', open); t.textContent = open ? 'Hide ▴' : 'Show all ▾';
    });
    // keep tabs in sync if the app is open in two tabs
    window.addEventListener('storage', (e) => { if (e.key === C.STORAGE_KEY) { Store.load(); QBank.rebuild(); } });
    const np = document.getElementById('nav-profile'); if (np && Views.profileCard) np.innerHTML = Views.profileCard('mini');
    if (!Store.storageOk) UI.toast('Browser storage is unavailable — progress will not be saved.', 'error', 8000);
    render();
  }
  document.addEventListener('DOMContentLoaded', init);
})();
