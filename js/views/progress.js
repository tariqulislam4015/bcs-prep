/* Overall long-term progress dashboard. */
(function () {
  'use strict';
  const C = window.BCS_CONFIG, esc = UI.esc;

  Views.progress = function (host) {
    const o = Stats.overall();
    const exams = Store.state.exams.slice().sort((a, b) => a.submittedAt - b.submittedAt);
    const subs = Stats.subjectStats('all');
    const rated = subs.filter(s => s.level.rank >= 0).sort((a, b) => b.accuracy - a.accuracy);
    const cmp = Stats.examComparison();
    const imp = o.improvement;

    // practice activity, last 14 days
    const days = [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (let i = 13; i >= 0; i--) { const d = new Date(today); d.setDate(d.getDate() - i); days.push({ t: d.getTime(), label: d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' }), n: 0, c: 0 }); }
    for (const l of Store.state.practice.log) {
      const d = new Date(l.at); d.setHours(0, 0, 0, 0);
      const slot = days.find(x => x.t === d.getTime()); if (slot) { slot.n++; if (l.ok) slot.c++; }
    }

    // rolling trend: first half vs second half of exams
    let trendText = 'Take at least two exams to see your trend.';
    if (exams.length >= 2) {
      const half = Math.floor(exams.length / 2);
      const avg = (arr) => arr.reduce((a, e) => a + e.summary.pct, 0) / arr.length;
      const early = avg(exams.slice(0, half)), late = avg(exams.slice(exams.length - half));
      const d = late - early;
      trendText = d > 1 ? `Improving: your recent exams average ${UI.num(late, 1)}% vs ${UI.num(early, 1)}% earlier (+${UI.num(d, 1)} points).`
        : d < -1 ? `Declining: recent exams average ${UI.num(late, 1)}% vs ${UI.num(early, 1)}% earlier (${UI.num(d, 1)} points). Review weak subjects.`
        : `Stable: recent exams average ${UI.num(late, 1)}%, about the same as earlier (${UI.num(early, 1)}%).`;
    }

    host.innerHTML = `
      <div class="page-head row"><div><h1>Overall progress</h1><p class="muted">Is your BCS preparation improving over time?</p></div>
        <div class="actions"><a class="btn" href="#/history">Exam history</a><button class="btn btn-primary" id="pg-report">Export performance report</button></div></div>

      <section class="kpis kpis-5">
        ${kpi('Questions practised', o.practiceAttempted, `of ${o.totalAvailable} in the bank`)}
        ${kpi('Exams completed', o.examsCompleted, '')}
        ${kpi('Total correct', o.all.correct, 'exam + practice')}
        ${kpi('Total incorrect', o.all.wrong, 'exam + practice')}
        ${kpi('Overall accuracy', o.all.attempted ? UI.num(o.all.accuracy, 1) + '%' : '—', `${o.all.attempted} attempted`)}
        ${kpi('Overall marks', UI.num(o.all.marks), `Exam ${UI.num(o.exam.marks)} · Practice ${UI.num(o.practice.marks)}`)}
        ${kpi('Average exam score', o.avgExamPct == null ? '—' : UI.num(o.avgExamPct, 1) + '%', o.avgExamMarks == null ? '' : UI.num(o.avgExamMarks) + ' marks avg')}
        ${kpi('Highest exam score', o.best ? UI.num(o.best.summary.pct, 1) + '%' : '—', o.best ? `${UI.num(o.best.summary.marks)}/${UI.num(o.best.summary.maxMarks)} · ${C.ordinal(o.best.bcs)} BCS` : '')}
        ${kpi('Latest exam score', o.latest ? UI.num(o.latest.summary.pct, 1) + '%' : '—', o.latest ? `${UI.num(o.latest.summary.marks)}/${UI.num(o.latest.summary.maxMarks)} · ${UI.fmtDate(o.latest.submittedAt, false)}` : '')}
        ${kpi('Change vs previous exam', imp == null ? '—' : (imp >= 0 ? '+' : '') + UI.num(imp, 1) + ' pts', imp == null ? 'Needs two exams' : imp > 0 ? 'Improved' : imp < 0 ? 'Dropped' : 'No change', imp == null ? '' : imp >= 0 ? 't-good' : 't-bad')}
      </section>

      <div class="notice ${exams.length >= 2 ? '' : 'muted-notice'}"><b>Trend:</b> ${esc(trendText)}</div>

      <div class="grid-2">
        <section class="card"><h2>Exam performance over time (%)</h2>
          ${Charts.line(exams.map((e, i) => ({ label: '#' + (i + 1), value: e.summary.pct, tip: `#${i + 1} · ${C.ordinal(e.bcs)} BCS · ${UI.fmtDate(e.submittedAt, false)} · ${UI.num(e.summary.pct, 1)}%` })), { emptyMsg: 'No exams yet.', yMin: 0, yMax: 100 })}
        </section>
        <section class="card"><h2>Marks obtained in each exam</h2>
          ${Charts.vbar(exams.map((e, i) => ({ label: '#' + (i + 1), value: e.summary.marks, max: e.summary.maxMarks, color: e.summary.marks >= 0 ? 'var(--c-primary)' : 'var(--c-weak)', tip: `#${i + 1} ${C.ordinal(e.bcs)} BCS: ${UI.num(e.summary.marks)} / ${UI.num(e.summary.maxMarks)}` })), { emptyMsg: 'No exams yet.' })}
        </section>
        <section class="card"><h2>Subject-wise accuracy</h2>
          ${Charts.hbar(subs.filter(s => s.attempted).map(s => ({ label: s.subject.short, value: s.accuracy, note: `${s.correct}/${s.attempted}` })), { emptyMsg: 'No attempts yet.' })}
        </section>
        <section class="card"><h2>Correct vs incorrect answers</h2>
          ${Charts.donut([{ label: 'Correct', value: o.all.correct, color: 'var(--c-strong)' }, { label: 'Incorrect', value: o.all.wrong, color: 'var(--c-weak)' }, { label: 'Skipped in exams', value: o.exam.skipped, color: 'var(--c-neutral)' }], { center: o.all.attempted ? UI.num(o.all.accuracy, 0) + '%' : '—', sub: 'accuracy' })}
          ${rated.length ? `<div class="sw small"><div><b class="t-good">Strongest:</b> ${rated.slice(0, 2).map(s => esc(s.subject.short) + ' (' + UI.num(s.accuracy, 0) + '%)').join(', ')}</div>
            ${rated.length > 1 ? `<div><b class="t-bad">Weakest:</b> ${rated.slice(Math.max(1, rated.length - 2)).reverse().map(s => esc(s.subject.short) + ' (' + UI.num(s.accuracy, 0) + '%)').join(', ')}</div>` : ''}</div>` : ''}
        </section>
      </div>

      <section class="card"><h2>Compare across BCS examinations</h2>
        ${cmp.length ? `<div class="table-wrap"><table class="table">
          <thead><tr><th>BCS</th><th class="num">Exams</th><th class="num">Average %</th><th class="num">Best %</th><th class="num">Latest %</th><th class="num">Best marks</th><th class="num">Avg accuracy</th><th>Average score</th></tr></thead>
          <tbody>${cmp.map(r => `<tr><td>${C.ordinal(r.bcs)} BCS</td><td class="num">${r.count}</td><td class="num">${UI.num(r.avgPct, 1)}%</td><td class="num">${UI.num(r.bestPct, 1)}%</td><td class="num">${UI.num(r.latestPct, 1)}%</td><td class="num">${UI.num(r.bestMarks)}</td><td class="num">${UI.num(r.avgAccuracy, 1)}%</td><td style="min-width:140px">${Charts.progress(r.avgPct)}</td></tr>`).join('')}</tbody>
        </table></div>` : Charts.empty('Complete exams for different BCS patterns to compare them here.')}
      </section>

      <section class="card"><h2>Practice activity — last 14 days</h2>
        ${days.some(d => d.n) ? Charts.vbar(days.map(d => ({ label: d.label, value: d.n, tip: `${d.label}: ${d.n} attempts, ${d.c} correct` }))) : Charts.empty('No practice attempts in the last 14 days.')}
      </section>`;

    host.querySelector('#pg-report').addEventListener('click', () => Views.exportReport());
  };

  function kpi(label, value, sub, cls = '') {
    return `<div class="kpi card"><div class="kpi-label">${esc(label)}</div><div class="kpi-value ${cls}">${esc(value)}</div><div class="kpi-sub">${esc(sub)}</div></div>`;
  }
})();
