/* Home dashboard. */
(function () {
  'use strict';
  const C = window.BCS_CONFIG, esc = UI.esc;

  window.Views.dashboard = function (host) {
    const o = Stats.overall();
    const subs = Stats.subjectStats('all');
    const sel = App.selectedBcs;
    const counts = QBank.bcsCounts();
    const sampleCount = QBank.all().filter(q => q.source === 'sample').length;
    const importedCount = QBank.all().length - sampleCount;
    const recent = Store.state.exams.slice().sort((a, b) => b.submittedAt - a.submittedAt).slice(0, 6);
    const cfg = sel ? App.examConfig(sel) : null;

    host.innerHTML = `
      <section class="hero card">
        ${Views.profileCard('card')}
        <div class="hero-select">
          <div class="hero-text">
            <span class="eyebrow">TIS Academy</span>
            <h1>BCS Preparation &amp; MCQ Platform</h1>
            <p class="muted">Sit realistic timed exams, practise at your own pace, and see exactly which subjects and topics need work.</p>
          </div>
          <label class="field">
            <span>BCS examination</span>
            <select id="dash-bcs" class="input input-lg">${App.bcsOptions(sel)}</select>
          </label>
          <div class="bcs-info" id="bcs-info">${sel ? bcsInfo(sel, cfg, counts[sel] || 0) : '<span class="muted">Select a BCS examination (10th–50th) to start Exam Mode or a BCS-specific practice session.</span>'}</div>
          ${PWA.isApp() ? '' : `<div class="apk-card">
            <div><b>📱 Android app</b><span class="muted small">Download and install the APK — works offline, no Play Store needed.</span></div>
            ${PWA.apkButton()}
          </div>`}
          <div class="mode-buttons">
            <button class="mode-btn mode-exam" data-act="exam">
              <span class="mode-icon" aria-hidden="true">⏱</span>
              <span><b>Exam Mode</b><small>Timed, negative marking, full result</small></span>
            </button>
            <button class="mode-btn mode-practice" data-act="practice">
              <span class="mode-icon" aria-hidden="true">✎</span>
              <span><b>Practice Mode</b><small>No timer, reveal answers when you choose</small></span>
            </button>
          </div>
        </div>
      </section>

      ${importedCount === 0 ? `<div class="notice">
        <b>About the question bank:</b> the ${sampleCount} bundled questions are <b>sample practice questions</b> in BCS syllabus style. They are not official questions from any particular BCS examination. Exam Mode builds a mock from them using the selected BCS's pattern.
        To practise authentic previous questions, add them under <a href="#/settings">Settings → Import questions</a>. Imported questions keep their BCS number and can be marked <i>verified</i>.
      </div>` : ''}

      <section class="kpis">
        ${kpi('Questions available', o.totalAvailable, `${sampleCount} sample · ${importedCount} imported`)}
        ${kpi('Exams completed', o.examsCompleted, o.latest ? 'Last: ' + UI.fmtDate(o.latest.submittedAt, false) : 'No exams yet')}
        ${kpi('Average exam marks', o.avgExamPct == null ? '—' : UI.num(o.avgExamPct, 1) + '%', o.avgExamMarks == null ? 'Take an exam to see this' : 'Avg ' + UI.num(o.avgExamMarks) + ' marks')}
        ${kpi('Overall accuracy', o.all.attempted ? UI.num(o.all.accuracy, 1) + '%' : '—', `${o.all.correct} correct of ${o.all.attempted} attempted`)}
      </section>

      <div class="grid-2">
        <section class="card">
          <div class="card-head"><h2>Subject-wise performance</h2><a href="#/analysis" class="link">Full analysis →</a></div>
          ${subs.some(s => s.attempted) ? `<table class="table compact">
            <thead><tr><th>Subject</th><th class="num">Attempted</th><th class="num">Accuracy</th><th>Level</th></tr></thead>
            <tbody>${subs.map(s => `<tr>
              <td>${esc(s.subject.short)}</td>
              <td class="num">${s.attempted}</td>
              <td class="num">${s.attempted ? UI.num(s.accuracy, 1) + '%' : '—'}</td>
              <td>${s.attempted ? UI.levelBadge(s.level) : '<span class="muted">—</span>'}</td></tr>`).join('')}</tbody>
          </table>` : Charts.empty('No attempts yet. Start an exam or a practice session.')}
        </section>

        <section class="card">
          <div class="card-head"><h2>Recent examinations</h2><a href="#/history" class="link">All history →</a></div>
          ${recent.length ? `<table class="table compact">
            <thead><tr><th>Date</th><th>BCS</th><th class="num">Marks</th><th class="num">%</th><th></th></tr></thead>
            <tbody>${recent.map(e => `<tr>
              <td>${UI.fmtDate(e.submittedAt)}</td>
              <td>${C.ordinal(e.bcs)}${e.isSample ? ' <span class="badge src-sample">Mock</span>' : ''}</td>
              <td class="num">${UI.num(e.summary.marks)} / ${UI.num(e.summary.maxMarks)}</td>
              <td class="num">${UI.num(e.summary.pct, 1)}%</td>
              <td><a class="link" href="#/result/${e.id}">View</a></td></tr>`).join('')}</tbody>
          </table>` : Charts.empty('No examinations completed yet.')}
        </section>
      </div>

      <div class="grid-3">
        ${quick('Random practice', 'Practise 20 random questions from the whole bank.', 'random')}
        ${quick('Review mistakes', 'Retry the questions you got wrong in Practice Mode.', 'wrong')}
        ${quick('Bookmarked questions', `${Store.state.bookmarks.length} saved question(s).`, 'bookmarks')}
      </div>`;

    const selEl = host.querySelector('#dash-bcs');
    selEl.addEventListener('change', () => {
      App.selectedBcs = selEl.value || null;
      const s = App.selectedBcs;
      host.querySelector('#bcs-info').innerHTML = s ? bcsInfo(s, App.examConfig(s), QBank.bcsCounts()[s] || 0) : '<span class="muted">Select a BCS examination to begin.</span>';
    });

    host.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const act = b.dataset.act;
      if (act === 'exam') {
        if (!App.selectedBcs) { UI.toast('Please select a BCS examination first.', 'warn'); selEl.focus(); selEl.classList.add('shake'); setTimeout(() => selEl.classList.remove('shake'), 500); return; }
        if (Store.state.activeExam) { App.go('#/exam/run'); return; }
        App.go('#/exam/setup');
      } else if (act === 'practice') App.go('#/practice');
      else if (act === 'random') Views.startPractice({ ids: UI.shuffle(QBank.all().map(q => q.id)).slice(0, 20), label: 'Random 20 questions' });
      else if (act === 'wrong') {
        const ids = QBank.filter({ status: 'wrong' }).map(q => q.id);
        if (!ids.length) return UI.toast('No wrong answers recorded in Practice Mode yet.', 'info');
        Views.startPractice({ ids, label: 'Review mistakes' });
      } else if (act === 'bookmarks') {
        const ids = QBank.filter({ status: 'bookmarked' }).map(q => q.id);
        if (!ids.length) return UI.toast('You have no bookmarked questions yet.', 'info');
        Views.startPractice({ ids, label: 'Bookmarked questions' });
      }
    });
  };

  function bcsInfo(bcs, cfg, official) {
    return `<div class="info-row">
      <span><b>${C.ordinal(bcs)} BCS</b> pattern: ${cfg.questions} questions · ${cfg.durationMin} min · +${cfg.correctMark} / −${cfg.negativeMark}${cfg.isCustom ? ' <span class="badge">custom</span>' : ''}</span>
      <span>${official ? `<span class="badge src-verified">${official} official question(s) imported</span>` : '<span class="badge src-sample">No official questions imported — sample mock</span>'}</span>
    </div>`;
  }
  function kpi(label, value, sub) {
    return `<div class="kpi card"><div class="kpi-label">${esc(label)}</div><div class="kpi-value">${esc(value)}</div><div class="kpi-sub">${esc(sub)}</div></div>`;
  }
  function quick(title, text, act) {
    return `<button class="card quick" data-act="${act}"><b>${esc(title)}</b><span class="muted">${esc(text)}</span></button>`;
  }
})();
