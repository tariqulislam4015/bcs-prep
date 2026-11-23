/* Subject-wise and topic-wise performance analysis with recommendations. */
(function () {
  'use strict';
  const C = window.BCS_CONFIG, esc = UI.esc;

  Views.analysis = function (host) {
    let mode = 'all', topicSub = '';

    function draw() {
      const subs = Stats.subjectStats(mode);
      const rated = subs.filter(s => s.level.rank >= 0).sort((a, b) => b.accuracy - a.accuracy);
      const nTop = Math.min(3, Math.ceil(rated.length / 2));
      const strongest = rated.slice(0, nTop), weakest = rated.slice(nTop).slice(-3).reverse();
      const recs = Stats.recommendations(mode);
      const topics = Stats.topicStats(mode, topicSub || null);

      host.innerHTML = `
        <div class="page-head row"><div><h1>Performance analysis</h1><p class="muted">Which subjects and topics need more preparation?</p></div>
          <div class="seg">${[['all', 'Combined'], ['exam', 'Exam Mode'], ['practice', 'Practice Mode']].map(([k, l]) => `<button class="seg-btn ${mode === k ? 'active' : ''}" data-mode="${k}">${l}</button>`).join('')}</div></div>

        <section class="card">
          <h2>Subject-wise performance <span class="muted small">(${mode === 'all' ? 'exam + practice' : mode})</span></h2>
          <div class="table-wrap"><table class="table">
            <thead><tr><th>Subject</th><th class="num">Available Qs</th><th class="num">Attempted</th><th class="num">Correct</th><th class="num">Wrong</th>${mode === 'exam' || mode === 'all' ? '<th class="num">Skipped (exam)</th>' : '<th class="num">Unattempted</th>'}<th class="num">Marks</th><th class="num">Accuracy</th><th>Performance</th></tr></thead>
            <tbody>${subs.map(s => `<tr>
              <td><b>${esc(s.subject.en)}</b><div class="muted small">${esc(s.subject.bn)}</div></td>
              <td class="num">${s.available}</td><td class="num">${s.attempted}</td><td class="num t-good">${s.correct}</td><td class="num t-bad">${s.wrong}</td>
              <td class="num">${mode === 'practice' ? s.practiceUnattempted : s.skipped}</td>
              <td class="num"><b>${UI.num(s.marks)}</b></td>
              <td class="num">${s.attempted ? UI.num(s.accuracy, 1) + '%' : '—'}</td>
              <td>${s.attempted ? UI.levelBadge(s.level) : '<span class="muted">—</span>'}</td></tr>`).join('')}</tbody>
          </table></div>
          <p class="muted small">Accuracy = correct ÷ attempted. Levels: Strong ≥ 80%, Good ≥ 65%, Average ≥ 50%, Weak &lt; 50% (minimum ${C.MIN_ATTEMPTS_FOR_LEVEL} attempts for a rating).</p>
        </section>

        <div class="grid-2">
          <section class="card"><h2>Accuracy by subject</h2>
            ${Charts.hbar(subs.filter(s => s.attempted).map(s => ({ label: s.subject.short, value: s.accuracy, note: `${s.correct}/${s.attempted}` })), { emptyMsg: 'No attempts yet.' })}
          </section>
          <section class="card"><h2>Strongest &amp; weakest subjects</h2>
            ${rated.length ? `<div class="sw">
              <div><h3 class="t-good">Strongest</h3><ol>${strongest.map(s => `<li>${esc(s.subject.short)} — ${UI.num(s.accuracy, 1)}%</li>`).join('')}</ol></div>
              <div><h3 class="t-bad">Weakest</h3><ol>${weakest.length ? '' : '<li class="muted">Rate more subjects to compare</li>'}${weakest.map(s => `<li>${esc(s.subject.short)} — ${UI.num(s.accuracy, 1)}%</li>`).join('')}</ol></div></div>`
              : Charts.empty(`Attempt at least ${C.MIN_ATTEMPTS_FOR_LEVEL} questions in a subject to rate it.`)}
            <h3>Recommendations</h3>
            ${recs.length ? `<ul class="recs">${recs.map(r => `<li class="rec rec-${r.type}">${esc(r.text)}</li>`).join('')}</ul>` : '<p class="muted">Recommendations appear once you have attempted some questions.</p>'}
          </section>
        </div>

        <section class="card">
          <div class="card-head"><h2>Topic-wise analysis</h2>
            <select class="input input-sm" id="a-sub">${App.subjectOptions(topicSub, 'All subjects')}</select></div>
          <div class="table-wrap"><table class="table">
            <thead><tr><th>Subject</th><th>Topic</th><th class="num">Available</th><th class="num">Attempted</th><th class="num">Correct</th><th class="num">Wrong</th><th class="num">Accuracy</th><th>Level</th><th></th></tr></thead>
            <tbody>${topics.length ? topics.map(t => `<tr>
              <td>${esc(C.subjectByKey[t.subject] ? C.subjectByKey[t.subject].short : t.subject)}</td><td>${esc(t.topic)}</td>
              <td class="num">${t.available}</td><td class="num">${t.attempted}</td><td class="num t-good">${t.correct}</td><td class="num t-bad">${t.wrong}</td>
              <td class="num"><div class="acc-cell">${t.attempted ? UI.num(t.accuracy, 1) + '%' : '—'}${t.attempted ? Charts.progress(t.accuracy, { cls: 'thin ' + t.level.cls }) : ''}</div></td>
              <td>${t.attempted ? UI.levelBadge(t.level) : '<span class="muted">—</span>'}</td>
              <td>${t.available ? `<button class="link" data-topic="${esc(t.subject)}||${esc(t.topic)}">Practise</button>` : ''}</td></tr>`).join('') : '<tr><td colspan="9" class="muted">No topics.</td></tr>'}</tbody>
          </table></div>
        </section>`;
    }

    host.addEventListener('click', (e) => {
      const m = e.target.closest('[data-mode]'); if (m) { mode = m.dataset.mode; draw(); return; }
      const t = e.target.closest('[data-topic]');
      if (t) {
        const [s, tp] = t.dataset.topic.split('||');
        const ids = QBank.filter({ subject: s, topic: tp }).map(q => q.id);
        Views.startPractice({ ids, label: `${C.subjectByKey[s].short} · ${tp}` });
      }
    });
    host.addEventListener('change', (e) => { if (e.target.id === 'a-sub') { topicSub = e.target.value; draw(); } });
    draw();
  };
})();
