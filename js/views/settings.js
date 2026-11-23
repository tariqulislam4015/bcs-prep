/* Settings: theme, marking, per-BCS exam config, question import, backup, report, reset. */
(function () {
  'use strict';
  const C = window.BCS_CONFIG, esc = UI.esc;

  Views.settings = function (host) {
    let cfgBcs = App.selectedBcs || 35;

    function draw() {
      const s = Store.state.settings;
      const cfg = App.examConfig(cfgBcs);
      const imported = Store.state.imported;
      const ver = imported.filter(q => q.verified).length;
      const bcsCounts = QBank.bcsCounts();
      const usedKb = Math.round((localStorage.getItem(C.STORAGE_KEY) || '').length / 1024);

      host.innerHTML = `
        <div class="page-head"><h1>Settings &amp; data</h1></div>
        <div class="grid-2">
          <section class="card"><h2>Appearance</h2>
            <div class="seg">${['light', 'dark'].map(t => `<button class="seg-btn ${s.theme === t ? 'active' : ''}" data-theme="${t}">${t === 'light' ? '☀ Light' : '☾ Dark'}</button>`).join('')}</div>
            <h2 class="mt">Practice Mode marking</h2>
            <div class="form-grid">
              <label class="field"><span>Mark per correct answer</span><input class="input" type="number" step="0.25" min="0.25" id="s-pcm" value="${s.practiceMarking.correctMark}"></label>
              <label class="field"><span>Negative mark per wrong answer</span><input class="input" type="number" step="0.05" min="0" id="s-pnm" value="${s.practiceMarking.negativeMark}"></label>
            </div>
            <button class="btn btn-primary" data-s="save-pm">Save practice marking</button>
            <p class="muted small">Practice marks are recalculated from your saved answers using these values.</p>
          </section>

          <section class="card"><h2>Exam configuration per BCS</h2>
            <label class="field"><span>BCS examination</span><select class="input" id="s-bcs">${App.bcsOptions(cfgBcs, { placeholder: '—' })}</select></label>
            <div class="form-grid">
              <label class="field"><span>Number of questions</span><input class="input" type="number" min="1" max="500" id="s-q" value="${cfg.questions}"></label>
              <label class="field"><span>Time limit (minutes)</span><input class="input" type="number" min="1" max="600" id="s-d" value="${cfg.durationMin}"></label>
              <label class="field"><span>Mark per correct answer</span><input class="input" type="number" step="0.25" min="0.25" id="s-cm" value="${cfg.correctMark}"></label>
              <label class="field"><span>Negative mark per wrong answer</span><input class="input" type="number" step="0.05" min="0" id="s-nm" value="${cfg.negativeMark}"></label>
            </div>
            <p class="muted small">${esc(C.defaultExamConfig(cfgBcs).note)}${cfg.isCustom ? ' <b>Custom settings are active for this BCS.</b>' : ''}</p>
            <div class="actions left"><button class="btn btn-primary" data-s="save-cfg">Save for ${C.ordinal(cfgBcs)} BCS</button>
              <button class="btn" data-s="apply-all">Apply to all BCS</button>
              <button class="btn btn-ghost" data-s="reset-cfg" ${cfg.isCustom ? '' : 'disabled'}>Restore default</button></div>
          </section>
        </div>

        <section class="card"><h2>Import questions (official previous BCS questions or your own)</h2>
          <p>The bundled questions are <b>samples</b>. To practise authentic previous BCS questions, import them from a <b>JSON</b> or <b>CSV</b> file. Give each question a <code>bcs</code> number (10–50). Set <code>verified</code> to <code>true</code> only after you have checked the question and answer against an official or trusted source. Questions are labelled <span class="badge src-verified">Official · Verified</span>, <span class="badge src-unverified">Official · Unverified</span> or <span class="badge src-imported">Imported</span> to match.</p>
          <p class="small">Columns / fields: <code>id</code> (optional), <code>bcs</code>, <code>subject</code>, <code>topic</code>, <code>question</code>, <code>option_a</code>…<code>option_d</code> (or <code>options</code> array in JSON), <code>answer</code> (A–D), <code>explanation</code>, <code>verified</code>, <code>source_note</code>. Subject may be a key (e.g. <code>math</code>) or the full English name.</p>
          <div class="actions left">
            <label class="btn btn-primary file-btn">Choose file…<input type="file" id="s-imp" accept=".json,.csv,application/json,text/csv" hidden></label>
            <button class="btn" data-s="tpl-csv">Download CSV template</button>
            <button class="btn" data-s="tpl-json">Download JSON template</button>
            <button class="btn" data-s="exp-bank">Export imported questions</button>
            <button class="btn btn-ghost danger" data-s="clear-imp" ${imported.length ? '' : 'disabled'}>Remove all imported</button>
          </div>
          <div id="s-imp-result"></div>
          <p class="muted small">Imported: <b>${imported.length}</b> question(s), ${ver} verified. ${Object.keys(bcsCounts).length ? 'By BCS: ' + Object.entries(bcsCounts).map(([b, n]) => `${C.ordinal(Number(b))}: ${n}`).join(', ') : ''}</p>
        </section>

        <div class="grid-2">
          <section class="card"><h2>Backup &amp; reports</h2>
            <p class="muted small">All data is stored in this browser (localStorage, about ${usedKb} KB used). Export a backup regularly, and use it to move your progress to another browser or device.</p>
            <div class="actions left">
              <button class="btn btn-primary" data-s="backup">Export backup (JSON)</button>
              <label class="btn file-btn">Import backup…<input type="file" id="s-restore" accept=".json,application/json" hidden></label>
              <button class="btn" data-s="report">Export performance report</button>
            </div>
          </section>
          <section class="card danger-zone"><h2>Reset progress</h2>
            <p class="muted small">This permanently deletes the selected statistics. Your imported questions are kept.</p>
            <div class="actions left">
              <button class="btn btn-danger" data-reset="exam">Reset Exam Mode data</button>
              <button class="btn btn-danger" data-reset="practice">Reset Practice Mode data</button>
              <button class="btn btn-danger" data-reset="all">Reset everything</button>
            </div>
          </section>
        </div>`;
    }

    function readCfg() {
      const v = { questions: Math.floor(Number(host.querySelector('#s-q').value)), durationMin: Number(host.querySelector('#s-d').value), correctMark: Number(host.querySelector('#s-cm').value), negativeMark: Number(host.querySelector('#s-nm').value) };
      if (!(v.questions >= 1 && v.questions <= 500)) throw new Error('Questions must be 1–500.');
      if (!(v.durationMin >= 1 && v.durationMin <= 600)) throw new Error('Time limit must be 1–600 minutes.');
      if (!(v.correctMark > 0) || !(v.negativeMark >= 0)) throw new Error('Marks must be positive (negative mark may be 0).');
      return v;
    }

    host.addEventListener('change', async (e) => {
      if (e.target.id === 's-bcs') { cfgBcs = Number(e.target.value) || cfgBcs; draw(); }
      if (e.target.id === 's-imp' && e.target.files[0]) {
        const file = e.target.files[0];
        try {
          const text = await UI.readFile(file);
          const res = QBank.parseImport(text, file.name);
          const out = host.querySelector('#s-imp-result');
          if (!res.questions.length) {
            out.innerHTML = `<div class="notice error"><b>No valid questions found</b> (${res.total} row(s) read).<ul class="small">${res.errors.slice(0, 20).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`;
            return;
          }
          const ok = await UI.confirmModal({
            title: 'Import questions?',
            body: `<p>${res.questions.length} valid question(s) of ${res.total} row(s). ${res.questions.filter(q => q.verified).length} marked verified.</p>
              ${res.errors.length ? `<p class="t-bad small">${res.errors.length} row(s) will be skipped:</p><ul class="small">${res.errors.slice(0, 8).map(x => `<li>${esc(x)}</li>`).join('')}${res.errors.length > 8 ? '<li>…</li>' : ''}</ul>` : ''}
              <p class="small muted">Questions with an existing ID are updated.</p>`,
            confirmText: 'Import'
          });
          if (!ok) return;
          const r = QBank.addImported(res.questions);
          draw();
          host.querySelector('#s-imp-result').innerHTML = `<div class="notice success">Imported: ${r.added} new, ${r.updated} updated${res.errors.length ? `, ${res.errors.length} skipped` : ''}.</div>`;
        } catch (err) {
          host.querySelector('#s-imp-result').innerHTML = `<div class="notice error">Could not read file: ${esc(err.message)}</div>`;
        }
        e.target.value = '';
      }
      if (e.target.id === 's-restore' && e.target.files[0]) {
        try {
          const text = await UI.readFile(e.target.files[0]);
          if (!await UI.confirmModal({ title: 'Restore backup?', body: '<p>This <b>replaces all current data</b> in this browser with the backup.</p>', confirmText: 'Restore', danger: true })) { e.target.value = ''; return; }
          Store.importBackup(text); QBank.rebuild(); App.setTheme(Store.state.settings.theme);
          UI.toast('Backup restored.', 'success'); draw();
        } catch (err) { UI.toast('Restore failed: ' + err.message, 'error', 6000); }
        e.target.value = '';
      }
    });

    host.addEventListener('click', async (e) => {
      const th = e.target.closest('[data-theme]'); if (th) { App.setTheme(th.dataset.theme); draw(); return; }
      const rs = e.target.closest('[data-reset]');
      if (rs) {
        const scope = rs.dataset.reset;
        const label = { exam: 'all Exam Mode results and history', practice: 'all Practice Mode attempts and the current session', all: 'ALL exams, practice attempts and bookmarks' }[scope];
        const ok = await UI.confirmModal({ title: 'Reset progress?', body: `<p>This will permanently delete ${label}. Consider exporting a backup first.</p>`, confirmText: 'Reset', danger: true, requireText: 'RESET' });
        if (ok) { Store.reset(scope); UI.toast('Progress reset.', 'success'); draw(); }
        return;
      }
      const b = e.target.closest('[data-s]'); if (!b) return;
      try {
        switch (b.dataset.s) {
          case 'save-pm': {
            const cm = Number(host.querySelector('#s-pcm').value), nm = Number(host.querySelector('#s-pnm').value);
            if (!(cm > 0) || !(nm >= 0)) throw new Error('Marks must be positive (negative mark may be 0).');
            Store.state.settings.practiceMarking = { correctMark: cm, negativeMark: nm }; Store.save(); UI.toast('Practice marking saved.', 'success'); break;
          }
          case 'save-cfg': Store.state.settings.examOverrides[cfgBcs] = readCfg(); Store.save(); UI.toast(`Saved for ${C.ordinal(cfgBcs)} BCS.`, 'success'); draw(); break;
          case 'apply-all': {
            const v = readCfg();
            if (!await UI.confirmModal({ title: 'Apply to all BCS examinations?', body: `<p>Every BCS from ${C.ordinal(C.BCS_MIN)} to ${C.ordinal(C.BCS_MAX)} will use ${v.questions} questions, ${v.durationMin} min, +${v.correctMark}/−${v.negativeMark}.</p>`, confirmText: 'Apply' })) break;
            for (let n = C.BCS_MIN; n <= C.BCS_MAX; n++) Store.state.settings.examOverrides[n] = { ...v };
            Store.save(); UI.toast('Applied to all BCS examinations.', 'success'); draw(); break;
          }
          case 'reset-cfg': delete Store.state.settings.examOverrides[cfgBcs]; Store.save(); UI.toast('Default restored.', 'success'); draw(); break;
          case 'tpl-csv': UI.download('bcs-questions-template.csv', '﻿' + Views.TEMPLATE_CSV, 'text/csv'); break;
          case 'tpl-json': UI.download('bcs-questions-template.json', Views.TEMPLATE_JSON, 'application/json'); break;
          case 'exp-bank': UI.download('bcs-imported-questions.json', JSON.stringify({ questions: Store.state.imported }, null, 2), 'application/json'); break;
          case 'clear-imp':
            if (await UI.confirmModal({ title: 'Remove all imported questions?', body: '<p>Sample questions stay. Exam records keep their own copy of the questions for review.</p>', confirmText: 'Remove', danger: true })) { QBank.clearImported(); draw(); UI.toast('Imported questions removed.'); }
            break;
          case 'backup': UI.download(`bcs-prep-backup-${new Date().toISOString().slice(0, 10)}.json`, Store.exportBackup(), 'application/json'); break;
          case 'report': Views.exportReport(); break;
        }
      } catch (err) { UI.toast(err.message, 'error'); }
    });

    draw();
  };

  /* ---------------- templates ---------------- */
  Views.TEMPLATE_CSV = [
    'id,bcs,subject,topic,question,option_a,option_b,option_c,option_d,answer,explanation,verified,source_note',
    '"MY-0001",,math,Percentage,"What is 25% of 80?","15","20","25","30",B,"25% of 80 = 0.25 × 80 = 20.",false,"Example row — replace with your own"',
    '"MY-0002",44,english,"Grammar – Voice","<paste the exact question text here>","<option A>","<option B>","<option C>","<option D>",A,"<explanation>",false,"<where you verified it, e.g. PSC question paper>"'
  ].join('\n');
  Views.TEMPLATE_JSON = JSON.stringify({
    questions: [
      { id: 'MY-0001', bcs: null, subject: 'math', topic: 'Percentage', question: 'What is 25% of 80?', options: ['15', '20', '25', '30'], answer: 'B', explanation: '25% of 80 = 0.25 × 80 = 20.', verified: false, source_note: 'Example — replace with your own' },
      { id: 'MY-0002', bcs: 44, subject: 'english', topic: 'Grammar – Voice', question: '<paste the exact question text here>', options: ['<A>', '<B>', '<C>', '<D>'], answer: 'A', explanation: '<explanation>', verified: false, source_note: '<where you verified it>' }
    ]
  }, null, 2);

  /* ---------------- performance report ---------------- */
  Views.exportReport = function () {
    const o = Stats.overall();
    const subsAll = Stats.subjectStats('all'), subsEx = Stats.subjectStats('exam'), subsPr = Stats.subjectStats('practice');
    const topics = Stats.topicStats('all').filter(t => t.attempted);
    const recs = Stats.recommendations('all');
    const exams = Store.state.exams.slice().sort((a, b) => b.submittedAt - a.submittedAt);
    const cmp = Stats.examComparison();
    const subTable = (rows) => `<table><thead><tr><th>Subject</th><th>Attempted</th><th>Correct</th><th>Wrong</th><th>Marks</th><th>Accuracy</th><th>Level</th></tr></thead><tbody>
      ${rows.map(s => `<tr><td>${esc(s.subject.en)}</td><td>${s.attempted}</td><td>${s.correct}</td><td>${s.wrong}</td><td>${UI.num(s.marks)}</td><td>${s.attempted ? UI.num(s.accuracy, 1) + '%' : '—'}</td><td>${s.attempted ? esc(s.level.label) : '—'}</td></tr>`).join('')}</tbody></table>`;
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>TIS Academy — BCS Performance Report</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;600;700&display=swap" rel="stylesheet">
<style>body{font-family:'Noto Sans Bengali',system-ui,sans-serif;color:#1c2333;max-width:960px;margin:32px auto;padding:0 20px;line-height:1.5}
h1{margin:0 0 4px}h2{margin-top:28px;border-bottom:2px solid #e4e8f0;padding-bottom:4px;font-size:18px}
table{width:100%;border-collapse:collapse;font-size:13px;margin:8px 0}th,td{border:1px solid #dfe3ea;padding:6px 8px;text-align:left}th{background:#f3f5f9}
.k{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.k div{border:1px solid #dfe3ea;border-radius:8px;padding:10px}.k b{display:block;font-size:20px}
.muted{color:#6b7385;font-size:12px}@media print{button{display:none}}</style></head><body>
<button onclick="print()" style="float:right;padding:8px 14px">Print / Save as PDF</button>
<h1>TIS Academy — BCS Performance Report</h1><div class="muted">Generated ${esc(new Date().toLocaleString())}</div>
<h2>Overview</h2><div class="k">
<div><b>${o.examsCompleted}</b>Exams completed</div><div><b>${o.avgExamPct == null ? '—' : UI.num(o.avgExamPct, 1) + '%'}</b>Average exam score</div>
<div><b>${o.best ? UI.num(o.best.summary.pct, 1) + '%' : '—'}</b>Highest exam score</div><div><b>${o.latest ? UI.num(o.latest.summary.pct, 1) + '%' : '—'}</b>Latest exam score</div>
<div><b>${o.practiceAttempted}</b>Questions practised</div><div><b>${o.all.correct}</b>Total correct</div><div><b>${o.all.wrong}</b>Total incorrect</div>
<div><b>${o.all.attempted ? UI.num(o.all.accuracy, 1) + '%' : '—'}</b>Overall accuracy</div></div>
<p class="muted">Improvement vs previous exam: ${o.improvement == null ? 'n/a' : (o.improvement >= 0 ? '+' : '') + UI.num(o.improvement, 1) + ' percentage points'}. Practice marking: +${Store.state.settings.practiceMarking.correctMark}/−${Store.state.settings.practiceMarking.negativeMark}.</p>
<h2>Recommendations</h2><ul>${recs.map(r => `<li>${esc(r.text)}</li>`).join('') || '<li>No data yet.</li>'}</ul>
<h2>Subject-wise — combined</h2>${subTable(subsAll)}
<h2>Subject-wise — Exam Mode</h2>${subTable(subsEx)}
<h2>Subject-wise — Practice Mode</h2>${subTable(subsPr)}
<h2>Topic-wise (attempted topics)</h2><table><thead><tr><th>Subject</th><th>Topic</th><th>Attempted</th><th>Correct</th><th>Accuracy</th><th>Level</th></tr></thead><tbody>
${topics.map(t => `<tr><td>${esc(C.subjectByKey[t.subject].short)}</td><td>${esc(t.topic)}</td><td>${t.attempted}</td><td>${t.correct}</td><td>${UI.num(t.accuracy, 1)}%</td><td>${esc(t.level.label)}</td></tr>`).join('') || '<tr><td colspan="6">No data</td></tr>'}</tbody></table>
<h2>BCS comparison (exams)</h2><table><thead><tr><th>BCS</th><th>Exams</th><th>Average %</th><th>Best %</th><th>Latest %</th></tr></thead><tbody>
${cmp.map(r => `<tr><td>${C.ordinal(r.bcs)}</td><td>${r.count}</td><td>${UI.num(r.avgPct, 1)}%</td><td>${UI.num(r.bestPct, 1)}%</td><td>${UI.num(r.latestPct, 1)}%</td></tr>`).join('') || '<tr><td colspan="5">No exams</td></tr>'}</tbody></table>
<h2>Exam history</h2><table><thead><tr><th>Date</th><th>BCS</th><th>Type</th><th>Correct</th><th>Wrong</th><th>Unanswered</th><th>Marks</th><th>%</th><th>Time</th></tr></thead><tbody>
${exams.map(e => `<tr><td>${esc(UI.fmtDate(e.submittedAt))}</td><td>${C.ordinal(e.bcs)}</td><td>${e.isSample ? 'Mock (sample Qs)' : 'Official Qs'}</td><td>${e.summary.correct}</td><td>${e.summary.wrong}</td><td>${e.summary.skipped}</td><td>${UI.num(e.summary.marks)} / ${UI.num(e.summary.maxMarks)}</td><td>${UI.num(e.summary.pct, 1)}%</td><td>${esc(UI.fmtDuration(e.timeTakenSec))}</td></tr>`).join('') || '<tr><td colspan="9">No exams</td></tr>'}</tbody></table>
</body></html>`;
    UI.download(`bcs-performance-report-${new Date().toISOString().slice(0, 10)}.html`, html, 'text/html');
    UI.toast('Report downloaded — open it and use Print to save as PDF.', 'success', 4500);
  };
})();
