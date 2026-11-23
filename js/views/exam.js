/* Exam Mode: setup → timed run → submit → result + review. Also exam history. */
(function () {
  'use strict';
  const C = window.BCS_CONFIG, esc = UI.esc;

  /* ---------------- question selection ---------------- */
  // Distribute n questions across subjects following the 200-mark blueprint
  // (largest-remainder method), capped by availability, leftover redistributed.
  function buildSampleSet(n) {
    const pool = {};
    for (const q of QBank.generalPool()) (pool[q.subject] = pool[q.subject] || []).push(q.id);
    const total = C.SUBJECTS.reduce((a, s) => a + s.marks, 0);
    const quota = {}, rema = [];
    let used = 0;
    for (const s of C.SUBJECTS) {
      const exact = (n * s.marks) / total;
      quota[s.key] = Math.min(Math.floor(exact), (pool[s.key] || []).length);
      used += quota[s.key];
      rema.push({ k: s.key, r: exact - Math.floor(exact), w: s.marks });
    }
    rema.sort((a, b) => b.r - a.r || b.w - a.w);
    // fill remainder by fractional part first, then by weight, respecting availability
    let guard = 0;
    while (used < n && guard++ < 10000) {
      let progressed = false;
      for (const x of rema) {
        if (used >= n) break;
        if (quota[x.k] < (pool[x.k] || []).length) { quota[x.k]++; used++; progressed = true; }
      }
      if (!progressed) break;
    }
    const ids = [];
    for (const s of C.SUBJECTS) ids.push(...UI.shuffle(pool[s.key] || []).slice(0, quota[s.key]));
    return { ids, quota };
  }

  function scaledDuration(cfg, n) {
    if (n === cfg.questions) return cfg.durationMin;
    return Math.max(1, Math.round((cfg.durationMin * n) / cfg.questions));
  }

  /* ============================ SETUP ============================ */
  Views.examSetup = function (host) {
    if (Store.state.activeExam) { App.go('#/exam/run'); return; }
    let bcs = App.selectedBcs;

    function draw() {
      const cfg = bcs ? App.examConfig(bcs) : null;
      const papers = bcs ? QBank.papersFor(bcs) : [];
      const general = QBank.generalPool();
      host.innerHTML = `
        <div class="page-head"><h1>Exam Mode</h1><p class="muted">A realistic, timed BCS preliminary simulation.</p></div>
        <div class="card">
          <label class="field"><span>BCS examination <b class="req">*</b></span>
            <select id="ex-bcs" class="input input-lg">${App.bcsOptions(bcs)}</select></label>
          ${bcs ? setupBody(cfg, papers, general) : '<p class="muted">Select a BCS examination to configure the exam.</p>'}
        </div>`;
      host.querySelector('#ex-bcs').addEventListener('change', (e) => { bcs = e.target.value ? Number(e.target.value) : null; App.selectedBcs = bcs; draw(); });
      if (!bcs) return;

      const srcRadios = host.querySelectorAll('input[name="src"]');
      const nEl = host.querySelector('#ex-n'), dEl = host.querySelector('#ex-d');
      const srcVal = () => host.querySelector('input[name="src"]:checked').value;
      const paperOf = (v) => papers.find(p => 'paper:' + p.id === v);
      const maxFor = () => { const p = paperOf(srcVal()); return p ? p.count : general.length; };
      const refresh = (resetN) => {
        const max = maxFor();
        nEl.max = max;
        if (resetN) nEl.value = Math.min(cfg.questions, max);
        const n = Math.max(1, Math.min(max, Number(nEl.value) || 1));
        dEl.value = scaledDuration(cfg, n);
        host.querySelector('#ex-max').textContent = max;
        updateBlueprint();
      };
      const updateBlueprint = () => {
        const bp = host.querySelector('#ex-bp');
        if (!bp) return;
        const p = paperOf(srcVal());
        if (p) {
          const by = {}; for (const q of QBank.forPaper(bcs, p.id)) by[q.subject] = (by[q.subject] || 0) + 1;
          bp.innerHTML = `<p class="muted small">Questions appear in the original order of the question paper. If you choose fewer, a random selection is used.</p>
            <table class="table compact"><thead><tr><th>Subject</th><th class="num">Questions</th></tr></thead><tbody>
            ${C.SUBJECTS.filter(s => by[s.key]).map(s => `<tr><td>${esc(s.en)}</td><td class="num">${by[s.key]}</td></tr>`).join('')}</tbody></table>`;
          return;
        }
        const n = Math.max(1, Math.min(general.length, Number(nEl.value) || 1));
        const { quota } = buildSampleSet(n);
        bp.innerHTML = `<table class="table compact"><thead><tr><th>Subject</th><th class="num">Blueprint (of 200)</th><th class="num">This mock</th></tr></thead><tbody>
          ${C.SUBJECTS.map(s => `<tr><td>${esc(s.en)}</td><td class="num">${s.marks}</td><td class="num">${quota[s.key]}</td></tr>`).join('')}
          </tbody></table>`;
      };
      srcRadios.forEach(r => r.addEventListener('change', () => refresh(true)));
      nEl.addEventListener('input', () => refresh(false));
      refresh(true);

      host.querySelector('#ex-start').addEventListener('click', async () => {
        const src = srcVal(); const paper = paperOf(src);
        const max = maxFor();
        const n = Math.floor(Number(nEl.value));
        const dur = Number(dEl.value);
        const cm = Number(host.querySelector('#ex-cm').value);
        const nm = Number(host.querySelector('#ex-nm').value);
        if (!(n >= 1 && n <= max)) return UI.toast(`Number of questions must be between 1 and ${max}.`, 'error');
        if (!(dur >= 1 && dur <= 600)) return UI.toast('Time limit must be between 1 and 600 minutes.', 'error');
        if (!(cm > 0) || !(nm >= 0)) return UI.toast('Marks must be positive (negative mark may be 0).', 'error');
        const ok = await UI.confirmModal({
          title: 'Start examination?',
          body: `<p><b>${paper ? esc(paper.label) : C.ordinal(bcs) + ' BCS — sample mock'}</b></p>
                 <ul class="plain"><li>${n} questions · ${dur} minutes</li><li>Correct +${cm} · Wrong −${nm} · Unanswered 0</li>
                 <li>The timer keeps running if you leave or refresh the page. The exam submits automatically when time runs out.</li></ul>`,
          confirmText: 'Start now'
        });
        if (!ok) return;
        let ids;
        if (paper) {
          const all = QBank.forPaper(bcs, paper.id);
          const pick = n >= all.length ? all : UI.shuffle(all).slice(0, n).sort((a, b) => (a.qno || 0) - (b.qno || 0));
          ids = pick.map(q => q.id);
        } else ids = buildSampleSet(n).ids;
        const now = Date.now();
        Store.state.activeExam = {
          id: UI.uid('exam'), bcs, source: paper ? 'official' : 'sample', isSample: !paper, paperLabel: paper ? paper.label : null,
          qids: ids, config: { questions: ids.length, durationMin: dur, correctMark: cm, negativeMark: nm },
          startedAt: now, endAt: now + dur * 60000, answers: {}, marked: [], visited: [ids[0]], idx: 0
        };
        Store.save();
        App.go('#/exam/run');
      });
    }

    function setupBody(cfg, papers, general) {
      const has = papers.length > 0;
      return `
        <div class="info-row"><span><b>${C.ordinal(bcs)} BCS</b> configured pattern: ${cfg.questions} questions · ${cfg.durationMin} min · +${cfg.correctMark} / −${cfg.negativeMark}</span>
          <a class="link" href="#/settings">Change defaults</a></div>
        <p class="muted small">${esc(cfg.note)}</p>
        <fieldset class="field"><legend>Question paper</legend>
          ${papers.map((p, i) => `<label class="radio"><input type="radio" name="src" value="paper:${esc(p.id)}" ${i === 0 ? 'checked' : ''}>
            <span><b>${esc(p.label)}</b> <span class="muted">— ${p.count} questions${p.id === '__imported' ? '' : ' (previous BCS paper)'}</span></span></label>`).join('')}
          <label class="radio"><input type="radio" name="src" value="sample" ${has ? '' : 'checked'}>
            <span>Sample mock exam in the ${C.ordinal(bcs)} BCS pattern <span class="muted">(${general.length} sample/practice questions)</span></span></label>
          ${has ? '<p class="muted small">Previous-paper questions come from the BCS Preliminary Solve Sheet. A few questions with formulas or figures could not be extracted, so a paper may have slightly fewer questions than the original.</p>'
                : '<p class="notice small">No questions are available for this BCS yet, so the exam uses <b>sample practice questions</b> and is labelled a mock.</p>'}
        </fieldset>
        <div class="form-grid">
          <label class="field"><span>Number of questions (max <span id="ex-max"></span>)</span><input id="ex-n" type="number" min="1" class="input"></label>
          <label class="field"><span>Time limit (minutes)</span><input id="ex-d" type="number" min="1" max="600" class="input"></label>
          <label class="field"><span>Mark per correct answer</span><input id="ex-cm" type="number" step="0.25" min="0.25" value="${cfg.correctMark}" class="input"></label>
          <label class="field"><span>Negative mark per wrong answer</span><input id="ex-nm" type="number" step="0.05" min="0" value="${cfg.negativeMark}" class="input"></label>
        </div>
        <p class="muted small">If the bank has fewer questions than the pattern, the time limit is scaled in proportion. You can still edit it.</p>
        <details class="details"><summary>Subject distribution</summary><div id="ex-bp"></div></details>
        <div class="actions"><a class="btn btn-ghost" href="#/">Cancel</a><button id="ex-start" class="btn btn-primary btn-lg">Start examination</button></div>`;
    }
    draw();
  };

  /* ============================ RUN ============================ */
  Views.examRun = function (host) {
    const ax = Store.state.activeExam;
    if (!ax) { UI.toast('No exam in progress.', 'info'); App.go('#/'); return; }
    if (Date.now() >= ax.endAt) { submit(true); return; }

    let timer = null;
    const total = ax.qids.length;

    host.innerHTML = `
      <div class="exam-top card">
        <div class="exam-title"><b>${ax.paperLabel ? esc(ax.paperLabel) : C.ordinal(ax.bcs) + ' BCS'} ${ax.isSample ? '— Mock (sample questions)' : '— Preliminary'}</b>
          <span class="muted small">+${ax.config.correctMark} / −${ax.config.negativeMark} · ${total} questions</span></div>
        <div class="exam-progress"><div id="ex-prog-text" class="small"></div><div id="ex-prog"></div></div>
        <div class="timer" id="ex-timer" aria-live="off" title="Time remaining">--:--</div>
        <button class="btn btn-danger" id="ex-submit">Submit exam</button>
      </div>
      <div class="exam-layout">
        <div class="exam-main" id="ex-q"></div>
        <aside class="exam-side card">
          <div class="side-head"><b>Questions</b><span class="muted small" id="ex-counts"></span><button class="btn btn-sm side-toggle" data-side-toggle aria-expanded="false">Show all ▾</button></div>
          <div class="palette" id="ex-palette"></div>
          <ul class="legend small">
            <li><i class="p-answered"></i>Answered</li><li><i class="p-unanswered"></i>Not answered</li>
            <li><i class="p-marked"></i>Marked for review</li><li><i class="p-marked-ans"></i>Answered &amp; marked</li>
            <li><i class="p-unvisited"></i>Not visited</li>
          </ul>
        </aside>
      </div>`;

    const qEl = host.querySelector('#ex-q'), palEl = host.querySelector('#ex-palette');

    function status(id) {
      const ans = ax.answers[id] != null, mk = ax.marked.includes(id), vis = ax.visited.includes(id);
      if (ans && mk) return 'marked-ans';
      if (mk) return 'marked';
      if (ans) return 'answered';
      return vis ? 'unanswered' : 'unvisited';
    }

    function drawQuestion() {
      const id = ax.qids[ax.idx];
      const q = QBank.get(id);
      if (!q) { qEl.innerHTML = `<div class="card">Question ${esc(id)} is no longer in the bank.</div>`; return; }
      const sel = ax.answers[id];
      const mk = ax.marked.includes(id);
      qEl.innerHTML = `
        <article class="qcard card">
          <div class="q-meta">
            <span class="q-num">Question ${ax.idx + 1} of ${total}</span>
            <span class="badge subj">${esc(C.subjectByKey[q.subject].short)}</span>
            ${UI.sourceBadge(q)}
            ${mk ? '<span class="badge p-marked-badge">Marked for review</span>' : ''}
          </div>
          <h2 class="q-text">${esc(q.question)}</h2>
          <div class="options" role="radiogroup" aria-label="Answer options">
            ${q.options.map((o, i) => `<button class="opt ${sel === i ? 'selected' : ''}" role="radio" aria-checked="${sel === i}" data-opt="${i}">
              <span class="opt-letter">${UI.LETTERS[i]}</span><span class="opt-text">${esc(o)}</span></button>`).join('')}
          </div>
          <div class="q-actions">
            <button class="btn btn-ghost" data-a="clear" ${sel == null ? 'disabled' : ''}>Clear response</button>
            <button class="btn ${mk ? 'btn-warn' : 'btn-outline'}" data-a="mark">${mk ? 'Unmark review' : 'Mark for review'}</button>
            <span class="spacer"></span>
            <button class="btn" data-a="prev" ${ax.idx === 0 ? 'disabled' : ''}>← Previous</button>
            <button class="btn btn-primary" data-a="next">${ax.idx === total - 1 ? 'Review & submit' : 'Next →'}</button>
          </div>
          <p class="muted small kbd-hint">Keyboard: A–D or 1–4 to choose · ← → to move · M to mark</p>
        </article>`;
    }

    function drawPalette() {
      palEl.innerHTML = ax.qids.map((id, i) => `<button class="pal p-${status(id)} ${i === ax.idx ? 'current' : ''}" data-go="${i}" aria-label="Question ${i + 1}: ${status(id)}">${i + 1}</button>`).join('');
      const answered = ax.qids.filter(id => ax.answers[id] != null).length;
      const marked = ax.marked.length;
      host.querySelector('#ex-counts').textContent = `${answered} answered · ${total - answered} left · ${marked} marked`;
      host.querySelector('#ex-prog-text').textContent = `${answered}/${total} answered (${UI.num(answered / total * 100, 0)}%)`;
      host.querySelector('#ex-prog').innerHTML = Charts.progress(answered / total * 100);
    }

    function go(i) {
      if (i < 0 || i >= total) return;
      ax.idx = i;
      const id = ax.qids[i];
      if (!ax.visited.includes(id)) ax.visited.push(id);
      Store.save(); drawQuestion(); drawPalette();
      const cur = palEl.querySelector('.current'); if (cur) cur.scrollIntoView({ block: 'nearest' });
    }

    function choose(i) {
      const id = ax.qids[ax.idx];
      ax.answers[id] = i; // one answer per question: replaces any previous choice
      Store.save(); drawQuestion(); drawPalette();
    }

    function tick() {
      const left = Math.max(0, Math.round((ax.endAt - Date.now()) / 1000));
      const t = host.querySelector('#ex-timer');
      if (t) { t.textContent = UI.fmtClock(left); t.classList.toggle('warn', left <= 300); t.classList.toggle('crit', left <= 60); }
      if (left <= 0) { clearInterval(timer); UI.toast('Time is up — your exam has been submitted automatically.', 'warn', 6000); submit(true); }
    }

    async function confirmSubmit() {
      const answered = ax.qids.filter(id => ax.answers[id] != null).length;
      const marked = ax.marked.length;
      const ok = await UI.confirmModal({
        title: 'Submit examination?',
        body: `<div class="summary-grid">
          <div><b>${total}</b><span>Total</span></div><div><b class="t-good">${answered}</b><span>Answered</span></div>
          <div><b class="t-bad">${total - answered}</b><span>Unanswered</span></div><div><b class="t-warn">${marked}</b><span>Marked</span></div></div>
          <p>Time remaining: <b>${UI.fmtClock((ax.endAt - Date.now()) / 1000)}</b>. You cannot change answers after you submit.</p>`,
        confirmText: 'Submit final answers', danger: true, cancelText: 'Return to exam'
      });
      if (ok) submit(false);
    }

    host.addEventListener('click', (e) => {
      const opt = e.target.closest('[data-opt]'); if (opt) return choose(Number(opt.dataset.opt));
      const g = e.target.closest('[data-go]'); if (g) return go(Number(g.dataset.go));
      const a = e.target.closest('[data-a]');
      if (a) {
        const id = ax.qids[ax.idx];
        if (a.dataset.a === 'prev') go(ax.idx - 1);
        else if (a.dataset.a === 'next') { if (ax.idx === total - 1) confirmSubmit(); else go(ax.idx + 1); }
        else if (a.dataset.a === 'clear') { delete ax.answers[id]; Store.save(); drawQuestion(); drawPalette(); }
        else if (a.dataset.a === 'mark') {
          const k = ax.marked.indexOf(id); if (k >= 0) ax.marked.splice(k, 1); else ax.marked.push(id);
          Store.save(); drawQuestion(); drawPalette();
        }
      }
    });
    host.querySelector('#ex-submit').addEventListener('click', confirmSubmit);

    function onKey(e) {
      if (document.querySelector('.modal-backdrop') || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      const k = e.key.toUpperCase();
      const m = { A: 0, B: 1, C: 2, D: 3, '1': 0, '2': 1, '3': 2, '4': 3 };
      if (m[k] != null) { choose(m[k]); e.preventDefault(); }
      else if (e.key === 'ArrowRight') go(ax.idx + 1);
      else if (e.key === 'ArrowLeft') go(ax.idx - 1);
      else if (k === 'M') host.querySelector('[data-a="mark"]').click();
    }
    document.addEventListener('keydown', onKey);
    const onUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onUnload);

    drawQuestion(); drawPalette(); tick();
    timer = setInterval(tick, 1000);

    return () => { clearInterval(timer); document.removeEventListener('keydown', onKey); window.removeEventListener('beforeunload', onUnload); };
  };

  function submit(auto) {
    const ax = Store.state.activeExam;
    if (!ax) return;
    const now = Date.now();
    const items = ax.qids.map(id => {
      const q = QBank.get(id);
      const sel = ax.answers[id] != null ? ax.answers[id] : null;
      const it = { id, s: q ? q.subject : 'bangla', t: q ? q.topic : 'Unknown', a: q ? q.answer : -1, sel, ok: sel == null ? null : (q ? sel === q.answer : false) };
      // keep a copy of non-bundled questions so the review still works if imports are removed later
      if (q && q.source !== 'sample' && !q.bundled) it.snap = { question: q.question, options: q.options, explanation: q.explanation, topic: q.topic, source: q.source, verified: q.verified, bcs: q.bcs };
      return it;
    });
    const rec = {
      id: ax.id, bcs: ax.bcs, source: ax.source, isSample: ax.isSample, config: ax.config,
      startedAt: ax.startedAt, submittedAt: Math.min(now, ax.endAt),
      timeTakenSec: Math.round((Math.min(now, ax.endAt) - ax.startedAt) / 1000),
      autoSubmitted: !!auto, marked: ax.marked.slice(), paperLabel: ax.paperLabel || null, items
    };
    rec.summary = Stats.summarizeExam(rec);
    Store.state.exams.push(rec);
    Store.state.activeExam = null;
    Store.save();
    App.go('#/result/' + rec.id);
  }

  /* ============================ RESULT ============================ */
  Views.examResult = function (host, id) {
    const rec = Store.state.exams.find(e => e.id === id);
    if (!rec) { host.innerHTML = `<div class="card"><h2>Result not found</h2><a class="btn" href="#/">Back to dashboard</a></div>`; return; }
    const s = rec.summary, cfg = rec.config;
    let filter = 'all', subj = '';

    const bySub = C.SUBJECTS.map(sub => {
      const its = rec.items.filter(i => i.s === sub.key);
      const sc = Stats.score(its, cfg.correctMark, cfg.negativeMark);
      return { sub, n: its.length, ...sc, acc: sc.attempted ? sc.correct / sc.attempted * 100 : 0 };
    }).filter(r => r.n > 0);

    const prevSame = Store.state.exams.filter(e => e.bcs === rec.bcs && e.submittedAt < rec.submittedAt).sort((a, b) => b.submittedAt - a.submittedAt)[0];
    const diff = prevSame ? s.pct - prevSame.summary.pct : null;

    host.innerHTML = `
      <div class="page-head row">
        <div><h1>Result — ${rec.paperLabel ? esc(rec.paperLabel) : C.ordinal(rec.bcs) + ' BCS'} ${rec.isSample ? '<span class="badge src-sample">Mock · sample questions</span>' : ''}</h1>
          <p class="muted">Submitted ${UI.fmtDate(rec.submittedAt)}${rec.autoSubmitted ? ' (auto-submitted when time ran out)' : ''}</p></div>
        <div class="actions">
          <button class="btn" data-r="practice-wrong">Practise wrong &amp; unanswered</button>
          <button class="btn btn-primary" data-r="retake">Take another exam</button>
        </div>
      </div>

      <section class="score-hero card">
        <div class="score-big"><div class="score-num">${UI.num(s.marks)}<span>/ ${UI.num(s.maxMarks)}</span></div><div class="muted">Marks obtained</div></div>
        <div class="score-stats">
          ${stat('Total questions', s.total)}${stat('Correct', s.correct, 't-good')}${stat('Incorrect', s.wrong, 't-bad')}${stat('Unanswered', s.skipped, 't-muted')}
          ${stat('Percentage', UI.num(s.pct, 2) + '%')}${stat('Accuracy', s.attempted ? UI.num(s.accuracy, 2) + '%' : '—')}
          ${stat('Time taken', UI.fmtDuration(rec.timeTakenSec))}${stat('Time limit', cfg.durationMin + ' min')}
        </div>
      </section>

      <div class="grid-2">
        <section class="card"><h2>Answer distribution</h2>
          ${Charts.donut([{ label: 'Correct', value: s.correct, color: 'var(--c-strong)' }, { label: 'Incorrect', value: s.wrong, color: 'var(--c-weak)' }, { label: 'Unanswered', value: s.skipped, color: 'var(--c-neutral)' }], { center: UI.num(s.pct, 1) + '%', sub: 'score' })}
        </section>
        <section class="card"><h2>Performance summary</h2>
          <p>${esc(Stats.performanceSummary({ ...s, nm: cfg.negativeMark }))}</p>
          <ul class="plain small">
            <li>Marking: +${cfg.correctMark} correct, −${cfg.negativeMark} wrong, 0 unanswered.</li>
            <li>Calculation: ${s.correct} × ${cfg.correctMark} − ${s.wrong} × ${cfg.negativeMark} = <b>${UI.num(s.marks)}</b></li>
            ${diff != null ? `<li>Compared with your previous ${C.ordinal(rec.bcs)} BCS exam: <b class="${diff >= 0 ? 't-good' : 't-bad'}">${diff >= 0 ? '+' : ''}${UI.num(diff, 2)} percentage points</b></li>` : ''}
            ${rec.marked.length ? `<li>${rec.marked.length} question(s) were still marked for review at submission.</li>` : ''}
          </ul>
        </section>
      </div>

      <section class="card"><h2>Subject-wise result</h2>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>Subject</th><th class="num">Questions</th><th class="num">Correct</th><th class="num">Wrong</th><th class="num">Unanswered</th><th class="num">Marks</th><th class="num">Accuracy</th></tr></thead>
          <tbody>${bySub.map(r => `<tr><td>${esc(r.sub.en)}</td><td class="num">${r.n}</td><td class="num t-good">${r.correct}</td><td class="num t-bad">${r.wrong}</td><td class="num">${r.skipped}</td><td class="num"><b>${UI.num(r.marks)}</b> / ${UI.num(r.n * cfg.correctMark)}</td><td class="num">${r.attempted ? UI.num(r.acc, 1) + '%' : '—'}</td></tr>`).join('')}</tbody>
        </table></div>
        ${Charts.hbar(bySub.filter(r => r.attempted).map(r => ({ label: r.sub.short, value: r.acc, note: `${r.correct}/${r.attempted}` })), { emptyMsg: 'No questions attempted.' })}
      </section>

      <section class="card">
        <div class="card-head"><h2>Detailed answer review</h2>
          <div class="filters">
            <div class="seg" role="tablist">
              ${[['all', 'All', s.total], ['correct', 'Correct', s.correct], ['wrong', 'Incorrect', s.wrong], ['skipped', 'Unanswered', s.skipped]].map(([k, l, n]) => `<button class="seg-btn ${k === 'all' ? 'active' : ''}" data-f="${k}">${l} <span class="count">${n}</span></button>`).join('')}
            </div>
            <select class="input input-sm" id="rv-sub">${App.subjectOptions('', 'All subjects')}</select>
          </div>
        </div>
        <div id="review"></div>
      </section>`;

    function drawReview() {
      const list = rec.items.map((it, i) => ({ it, i })).filter(({ it }) =>
        (filter === 'all' || (filter === 'correct' && it.ok === true) || (filter === 'wrong' && it.ok === false) || (filter === 'skipped' && it.ok === null)) &&
        (!subj || it.s === subj));
      host.querySelector('#review').innerHTML = list.length ? list.map(({ it, i }) => reviewCard(it, i)).join('') : Charts.empty('No questions match this filter.');
    }
    function reviewCard(it, i) {
      const q = it.snap ? { ...it.snap, subject: it.s, id: it.id } : QBank.get(it.id);
      if (!q) return `<div class="rv card-inner">Q${i + 1}: question no longer available.</div>`;
      const st = it.ok === true ? ['correct', 'Correct'] : it.ok === false ? ['wrong', 'Wrong'] : ['skipped', 'Unanswered'];
      return `<article class="rv rv-${st[0]}">
        <div class="q-meta"><span class="q-num">Q${i + 1}</span><span class="badge st-${st[0]}">${st[1]}</span>
          <span class="badge subj">${esc(C.subjectByKey[it.s].short)}</span><span class="muted small">${esc(it.t)}</span>
          <button class="icon-btn bm ${App.isBookmarked(it.id) ? 'on' : ''}" data-bm="${esc(it.id)}" title="Bookmark">★</button></div>
        <p class="q-text">${esc(q.question)}</p>
        <div class="options static">${q.options.map((o, k) => {
          const cls = k === it.a ? 'correct' : (k === it.sel ? 'wrong' : '');
          const tag = k === it.a && k === it.sel ? 'Your answer · Correct' : k === it.a ? 'Correct answer' : k === it.sel ? 'Your answer' : '';
          return `<div class="opt ${cls}"><span class="opt-letter">${UI.LETTERS[k]}</span><span class="opt-text">${esc(o)}</span>${tag ? `<span class="opt-tag">${tag}</span>` : ''}</div>`;
        }).join('')}</div>
        <div class="rv-foot small">Your answer: <b>${UI.letter(it.sel)}</b> · Correct answer: <b>${UI.letter(it.a)}</b></div>
        <div class="explain"><b>Explanation:</b> ${q.explanation ? esc(q.explanation) : '<span class="muted">No explanation provided.</span>'}</div>
      </article>`;
    }

    host.addEventListener('click', (e) => {
      const f = e.target.closest('[data-f]');
      if (f) { filter = f.dataset.f; host.querySelectorAll('[data-f]').forEach(b => b.classList.toggle('active', b === f)); drawReview(); return; }
      const bm = e.target.closest('[data-bm]');
      if (bm) { const on = App.toggleBookmark(bm.dataset.bm); bm.classList.toggle('on', on); UI.toast(on ? 'Bookmarked' : 'Bookmark removed'); return; }
      const r = e.target.closest('[data-r]');
      if (!r) return;
      if (r.dataset.r === 'retake') { App.selectedBcs = rec.bcs; App.go('#/exam/setup'); }
      if (r.dataset.r === 'practice-wrong') {
        const ids = rec.items.filter(i => i.ok !== true && QBank.get(i.id)).map(i => i.id);
        if (!ids.length) return UI.toast('No wrong or unanswered questions — well done!', 'info');
        Views.startPractice({ ids, label: `${C.ordinal(rec.bcs)} BCS exam — wrong & unanswered` });
      }
    });
    host.querySelector('#rv-sub').addEventListener('change', (e) => { subj = e.target.value; drawReview(); });
    drawReview();
  };

  function stat(label, value, cls = '') { return `<div class="stat"><div class="stat-val ${cls}">${esc(value)}</div><div class="stat-label">${esc(label)}</div></div>`; }

  /* ============================ HISTORY ============================ */
  Views.history = function (host) {
    function draw() {
      const list = Store.state.exams.slice().sort((a, b) => b.submittedAt - a.submittedAt);
      host.innerHTML = `
        <div class="page-head row"><div><h1>Examination history</h1><p class="muted">${list.length} completed exam(s).</p></div>
          <div class="actions"><button class="btn" id="h-csv" ${list.length ? '' : 'disabled'}>Export CSV</button></div></div>
        <div class="card">${list.length ? `<div class="table-wrap"><table class="table">
          <thead><tr><th>Date</th><th>BCS</th><th>Type</th><th class="num">Qs</th><th class="num">Correct</th><th class="num">Wrong</th><th class="num">Unans.</th><th class="num">Marks</th><th class="num">%</th><th class="num">Accuracy</th><th>Time</th><th></th></tr></thead>
          <tbody>${list.map(e => `<tr>
            <td>${UI.fmtDate(e.submittedAt)}</td><td>${e.paperLabel ? esc(e.paperLabel) : C.ordinal(e.bcs)}</td><td>${e.isSample ? '<span class="badge src-sample">Mock</span>' : '<span class="badge src-previous">Previous paper</span>'}</td>
            <td class="num">${e.summary.total}</td><td class="num t-good">${e.summary.correct}</td><td class="num t-bad">${e.summary.wrong}</td><td class="num">${e.summary.skipped}</td>
            <td class="num"><b>${UI.num(e.summary.marks)}</b> / ${UI.num(e.summary.maxMarks)}</td><td class="num">${UI.num(e.summary.pct, 1)}%</td><td class="num">${UI.num(e.summary.accuracy, 1)}%</td>
            <td>${UI.fmtDuration(e.timeTakenSec)}</td>
            <td class="nowrap"><a class="link" href="#/result/${e.id}">View</a> · <button class="link danger" data-del="${e.id}">Delete</button></td></tr>`).join('')}</tbody></table></div>`
          : Charts.empty('No examinations yet.')}</div>`;
      const csv = host.querySelector('#h-csv');
      if (csv) csv.addEventListener('click', () => {
        const rows = [['date', 'bcs', 'type', 'questions', 'correct', 'wrong', 'unanswered', 'marks', 'max_marks', 'percentage', 'accuracy', 'time_taken_sec', 'duration_min', 'correct_mark', 'negative_mark']];
        for (const e of list) rows.push([new Date(e.submittedAt).toISOString(), e.bcs, e.isSample ? 'mock' : 'official', e.summary.total, e.summary.correct, e.summary.wrong, e.summary.skipped, e.summary.marks, e.summary.maxMarks, e.summary.pct, e.summary.accuracy, e.timeTakenSec, e.config.durationMin, e.config.correctMark, e.config.negativeMark]);
        UI.download('bcs-exam-history.csv', '﻿' + rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n'), 'text/csv');
      });
    }
    host.addEventListener('click', async (e) => {
      const d = e.target.closest('[data-del]'); if (!d) return;
      if (!await UI.confirmModal({ title: 'Delete this exam record?', body: '<p>Its marks will be removed from all statistics. This cannot be undone.</p>', confirmText: 'Delete', danger: true })) return;
      Store.state.exams = Store.state.exams.filter(x => x.id !== d.dataset.del); Store.save(); draw(); UI.toast('Exam record deleted.');
    });
    draw();
  };
})();
