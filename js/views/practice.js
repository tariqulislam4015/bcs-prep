/* Practice Mode: untimed; answers and explanations hidden until requested.
   An attempt is recorded once per question (when you reveal or move on with a
   selected option). Re-viewing never adds attempts; use "Retry" to re-attempt. */
(function () {
  'use strict';
  const C = window.BCS_CONFIG, esc = UI.esc;

  Views.startPractice = function ({ ids, label }) {
    if (!ids || !ids.length) { UI.toast('No questions match your selection.', 'warn'); return; }
    Store.state.practiceSession = { id: UI.uid('ps'), label: label || 'Practice', ids, idx: 0, sel: {}, reveal: {}, startedAt: Date.now() };
    Store.save();
    App.go('#/practice/run');
  };

  /* ============================ SETUP ============================ */
  Views.practiceSetup = function (host) {
    const f = { source: (App.selectedBcs && QBank.forBcs(App.selectedBcs).length) ? 'bcs' : 'all', bcs: App.selectedBcs, subject: '', topic: '', status: '', order: 'seq', limit: '' };
    const ps = Store.state.practiceSession;

    function pool() {
      const base = { subject: f.subject || undefined, topic: f.topic || undefined, status: f.status || undefined };
      if (f.source === 'bcs') return f.bcs ? QBank.filter({ ...base, bcs: Number(f.bcs) }) : [];
      if (f.source === 'sample') return QBank.filter({ ...base, source: 'sample' });
      return QBank.filter(base);
    }

    function draw() {
      const o = Stats.overall().practice;
      const pm = Store.state.settings.practiceMarking;
      const unatt = QBank.all().length - Object.keys(Store.state.practice.attempts).length;
      const bcsRows = Stats.bcsStats('practice');
      host.innerHTML = `
        <div class="page-head"><h1>Practice Mode</h1><p class="muted">No timer. Answers and explanations stay hidden until you ask for them.</p></div>
        ${ps ? `<div class="card resume"><div><b>Continue: ${esc(ps.label)}</b><div class="muted small">Question ${ps.idx + 1} of ${ps.ids.length}</div></div>
          <div class="actions"><button class="btn btn-ghost" data-p="discard">Close session</button><a class="btn btn-primary" href="#/practice/run">Resume</a></div></div>` : ''}

        <div class="grid-2">
          <section class="card">
            <h2>Start a practice session</h2>
            <fieldset class="field"><legend>Questions from</legend>
              <div class="seg">
                ${[['bcs', 'Selected BCS'], ['all', 'Whole bank'], ['sample', 'Sample questions']].map(([k, l]) => `<button class="seg-btn ${f.source === k ? 'active' : ''}" data-src="${k}">${l}</button>`).join('')}
              </div>
            </fieldset>
            ${f.source === 'bcs' ? `<label class="field"><span>BCS examination <b class="req">*</b></span><select class="input" id="p-bcs">${App.bcsOptions(f.bcs)}</select></label>
              ${f.bcs && !QBank.forBcs(Number(f.bcs)).length ? `<p class="notice small">No questions are tagged with the ${C.ordinal(Number(f.bcs))} BCS yet. Import official questions in Settings, or practise from the whole bank / sample questions.</p>` : ''}` : ''}
            <div class="form-grid">
              <label class="field"><span>Subject</span><select class="input" id="p-sub">${App.subjectOptions(f.subject)}</select></label>
              <label class="field"><span>Topic</span><select class="input" id="p-top">${App.topicOptions(f.subject || null, f.topic)}</select></label>
              <label class="field"><span>Show</span><select class="input" id="p-st">
                ${[['', 'All questions'], ['unattempted', 'Not yet attempted'], ['wrong', 'Previously wrong'], ['correct', 'Previously correct'], ['attempted', 'Previously attempted'], ['bookmarked', 'Bookmarked']].map(([k, l]) => `<option value="${k}" ${f.status === k ? 'selected' : ''}>${l}</option>`).join('')}
              </select></label>
              <label class="field"><span>Order</span><select class="input" id="p-ord"><option value="seq" ${f.order === 'seq' ? 'selected' : ''}>In order</option><option value="rand" ${f.order === 'rand' ? 'selected' : ''}>Random</option></select></label>
              <label class="field"><span>Maximum questions (blank = all)</span><input class="input" id="p-lim" type="number" min="1" value="${esc(f.limit)}"></label>
            </div>
            <div class="actions"><span class="muted" id="p-count"></span><button class="btn btn-primary btn-lg" data-p="start">Start practice</button></div>
          </section>

          <section class="card">
            <h2>Practice performance</h2>
            <div class="mini-stats">
              ${mini('Attempted', o.attempted)}${mini('Correct', o.correct, 't-good')}${mini('Wrong', o.wrong, 't-bad')}
              ${mini('Unattempted', unatt)}${mini('Marks', UI.num(o.marks))}${mini('Accuracy', o.attempted ? UI.num(o.accuracy, 1) + '%' : '—')}
            </div>
            <p class="muted small">Marking: +${pm.correctMark} / −${pm.negativeMark} (change in Settings). Each question counts once, using your latest attempt.</p>
            <h3>BCS-wise (practice)</h3>
            ${bcsRows.length ? `<table class="table compact"><thead><tr><th>BCS</th><th class="num">Attempted</th><th class="num">Correct</th><th class="num">Wrong</th><th class="num">Marks</th><th class="num">Accuracy</th></tr></thead>
              <tbody>${bcsRows.map(r => `<tr><td>${r.bcs ? C.ordinal(r.bcs) + ' BCS' : 'Sample / untagged'}</td><td class="num">${r.attempted}</td><td class="num">${r.correct}</td><td class="num">${r.wrong}</td><td class="num">${UI.num(r.marks)}</td><td class="num">${UI.num(r.accuracy, 1)}%</td></tr>`).join('')}</tbody></table>`
              : Charts.empty('No practice attempts yet.')}
            <p class="small"><a class="link" href="#/analysis">Subject &amp; topic analysis →</a></p>
          </section>
        </div>`;
      updateCount();
    }
    function updateCount() {
      const n = pool().length, lim = Number(f.limit) || n;
      const el = host.querySelector('#p-count');
      if (el) el.textContent = f.source === 'bcs' && !f.bcs ? 'Select a BCS examination' : `${Math.min(n, lim)} question(s) selected`;
    }

    host.addEventListener('click', async (e) => {
      const s = e.target.closest('[data-src]');
      if (s) { f.source = s.dataset.src; draw(); return; }
      const p = e.target.closest('[data-p]'); if (!p) return;
      if (p.dataset.p === 'discard') {
        if (await UI.confirmModal({ title: 'Close this practice session?', body: '<p>Recorded attempts stay saved. Only the session position is cleared.</p>', confirmText: 'Close session' })) {
          Store.state.practiceSession = null; Store.save(); App.go('#/practice');
        }
      }
      if (p.dataset.p === 'start') {
        if (f.source === 'bcs' && !f.bcs) { UI.toast('Please select a BCS examination first.', 'warn'); return; }
        let ids = pool().map(q => q.id);
        if (f.order === 'rand') ids = UI.shuffle(ids);
        const lim = Number(f.limit); if (lim > 0) ids = ids.slice(0, lim);
        const parts = [f.source === 'bcs' ? C.ordinal(Number(f.bcs)) + ' BCS' : f.source === 'sample' ? 'Sample questions' : 'Whole bank'];
        if (f.subject) parts.push(C.subjectByKey[f.subject].short);
        if (f.topic) parts.push(f.topic);
        if (f.status) parts.push(f.status);
        Views.startPractice({ ids, label: parts.join(' · ') });
      }
    });
    host.addEventListener('change', (e) => {
      const id = e.target.id;
      if (id === 'p-bcs') { f.bcs = e.target.value ? Number(e.target.value) : null; if (f.bcs) App.selectedBcs = f.bcs; draw(); }
      else if (id === 'p-sub') { f.subject = e.target.value; f.topic = ''; draw(); }
      else if (id === 'p-top') { f.topic = e.target.value; updateCount(); }
      else if (id === 'p-st') { f.status = e.target.value; updateCount(); }
      else if (id === 'p-ord') { f.order = e.target.value; }
    });
    host.addEventListener('input', (e) => { if (e.target.id === 'p-lim') { f.limit = e.target.value; updateCount(); } });
    draw();
  };

  function mini(l, v, cls = '') { return `<div class="mini"><b class="${cls}">${esc(v)}</b><span>${esc(l)}</span></div>`; }

  /* ============================ RUN ============================ */
  Views.practiceRun = function (host) {
    const ps = Store.state.practiceSession;
    if (!ps) { App.go('#/practice'); return; }
    ps.ids = ps.ids.filter(id => QBank.get(id)); // drop removed questions
    if (!ps.ids.length) { Store.state.practiceSession = null; Store.save(); UI.toast('These questions are no longer available.', 'warn'); App.go('#/practice'); return; }
    if (ps.idx >= ps.ids.length) ps.idx = 0;
    const P = Store.state.practice;
    P.tries = P.tries || {};

    host.innerHTML = `
      <div class="page-head row"><div><h1>Practice</h1><p class="muted">${esc(ps.label)}</p></div>
        <div class="actions"><a class="btn btn-ghost" href="#/practice">End session</a></div></div>
      <div class="exam-layout">
        <div class="exam-main" id="pq"></div>
        <aside class="exam-side card">
          <div class="side-head"><b>Session</b><button class="btn btn-sm side-toggle" data-side-toggle aria-expanded="false">Show all ▾</button></div>
          <div id="p-sess" class="mini-stats tight"></div>
          <div class="palette" id="p-pal"></div>
          <ul class="legend small"><li><i class="p-correct"></i>Correct (revealed)</li><li><i class="p-wrong"></i>Wrong (revealed)</li><li><i class="p-attempted"></i>Attempted (answer hidden)</li><li><i class="p-unvisited"></i>Not attempted</li></ul>
        </aside>
      </div>`;
    const qEl = host.querySelector('#pq');

    const cur = () => ps.ids[ps.idx];
    const rv = (id) => (ps.reveal[id] = ps.reveal[id] || { ans: false, exp: false, viewedOnly: false });

    function lock(id) {
      if (P.attempts[id]) return false;
      const sel = ps.sel[id];
      if (sel == null) return false;
      const q = QBank.get(id);
      const ok = sel === q.answer;
      P.tries[id] = (P.tries[id] || 0) + 1;
      P.attempts[id] = { sel, ok, s: q.subject, t: q.topic, bcs: q.bcs || null, at: Date.now(), tries: P.tries[id] };
      P.log.push({ qid: id, ok, at: Date.now() });
      if (P.log.length > 5000) P.log.splice(0, P.log.length - 5000);
      delete ps.sel[id];
      return true;
    }

    function drawQ() {
      const id = cur(), q = QBank.get(id), at = P.attempts[id], r = rv(id);
      const sel = at ? at.sel : ps.sel[id];
      const locked = !!at || r.viewedOnly;
      const showAns = r.ans;
      const tries = P.tries[id] || 0;
      let statusLine = '';
      if (at && !showAns) statusLine = `<div class="pstatus info">Your answer <b>${UI.letter(at.sel)}</b> is recorded${tries > 1 ? ` (attempt ${tries})` : ''}. Click <b>Show Answer</b> to check it, or <b>Retry</b> to answer again.</div>`;
      else if (at && showAns) statusLine = at.ok ? `<div class="pstatus good">Correct! +${Store.state.settings.practiceMarking.correctMark}</div>` : `<div class="pstatus bad">Incorrect. You chose ${UI.letter(at.sel)}; the correct answer is ${UI.letter(q.answer)}. −${Store.state.settings.practiceMarking.negativeMark}</div>`;
      else if (r.viewedOnly) statusLine = `<div class="pstatus info">You revealed this question without answering, so it is <b>not counted</b> as an attempt. Click <b>Retry</b> to answer it.</div>`;

      qEl.innerHTML = `
        <article class="qcard card">
          <div class="q-meta">
            <span class="q-num">Question ${ps.idx + 1} of ${ps.ids.length}</span>
            <span class="badge subj">${esc(C.subjectByKey[q.subject].short)}</span>
            <span class="muted small">${esc(q.topic)}</span>
            ${q.bcs ? `<span class="badge">${C.ordinal(q.bcs)} BCS</span>` : ''}
            ${UI.sourceBadge(q)}
            <span class="spacer"></span>
            <button class="icon-btn bm ${App.isBookmarked(id) ? 'on' : ''}" data-a="bm" title="Bookmark this question" aria-label="Bookmark">★</button>
          </div>
          <h2 class="q-text">${esc(q.question)}</h2>
          <div class="options ${locked ? 'locked' : ''}" role="radiogroup">
            ${q.options.map((o, i) => {
              let cls = '';
              if (showAns && i === q.answer) cls = 'correct';
              else if (showAns && sel === i && i !== q.answer) cls = 'wrong';
              else if (sel === i) cls = 'selected';
              return `<button class="opt ${cls}" data-opt="${i}" role="radio" aria-checked="${sel === i}" ${locked ? 'aria-disabled="true"' : ''}>
                <span class="opt-letter">${UI.LETTERS[i]}</span><span class="opt-text">${esc(o)}</span>
                ${showAns && i === q.answer ? '<span class="opt-tag">Correct answer</span>' : ''}${showAns && sel === i && i !== q.answer ? '<span class="opt-tag">Your answer</span>' : ''}</button>`;
            }).join('')}
          </div>
          ${statusLine}
          <div class="q-actions">
            <button class="btn btn-outline" data-a="ans" ${showAns ? 'disabled' : ''}>${showAns ? 'Answer shown' : 'Show Answer'}</button>
            <button class="btn btn-outline" data-a="exp" ${r.exp ? 'disabled' : ''}>${r.exp ? 'Explanation shown' : 'Show Explanation'}</button>
            ${(at || r.viewedOnly) ? '<button class="btn btn-warn" data-a="retry">↺ Retry question</button>' : ''}
            <span class="spacer"></span>
            <button class="btn" data-a="prev" ${ps.idx === 0 ? 'disabled' : ''}>← Previous</button>
            <button class="btn btn-primary" data-a="next" ${ps.idx === ps.ids.length - 1 ? 'disabled' : ''}>Next →</button>
          </div>
          ${r.exp ? `<div class="explain"><b>Explanation:</b> ${q.explanation ? esc(q.explanation) : '<span class="muted">No explanation available for this question.</span>'}</div>` : ''}
          <p class="muted small kbd-hint">Selecting an option does not reveal anything. Your answer is recorded when you click Show Answer / Show Explanation or move to another question.</p>
        </article>`;
    }

    function drawSide() {
      const pm = Store.state.settings.practiceMarking;
      let c = 0, w = 0, a = 0;
      for (const id of ps.ids) { const at = P.attempts[id]; if (at) { a++; if (at.ok) c++; else w++; } }
      const marks = c * pm.correctMark - w * pm.negativeMark;
      host.querySelector('#p-sess').innerHTML = mini('Attempted', `${a}/${ps.ids.length}`) + mini('Correct', c, 't-good') + mini('Wrong', w, 't-bad') +
        mini('Unattempted', ps.ids.length - a) + mini('Marks', UI.num(marks)) + mini('Accuracy', a ? UI.num(c / a * 100, 1) + '%' : '—');
      host.querySelector('#p-pal').innerHTML = ps.ids.map((id, i) => {
        const at = P.attempts[id], r = ps.reveal[id];
        let st = 'unvisited';
        if (at) st = (r && r.ans) ? (at.ok ? 'correct' : 'wrong') : 'attempted';
        else if (ps.sel[id] != null) st = 'selected';
        return `<button class="pal p-${st} ${i === ps.idx ? 'current' : ''}" data-go="${i}">${i + 1}</button>`;
      }).join('');
    }

    function redraw() { Store.save(); drawQ(); drawSide(); }

    function go(i) {
      if (i < 0 || i >= ps.ids.length) return;
      if (lock(cur())) UI.toast('Answer recorded.', 'info', 1400);
      ps.idx = i; redraw();
      const c = host.querySelector('#p-pal .current'); if (c) c.scrollIntoView({ block: 'nearest' });
    }

    host.addEventListener('click', (e) => {
      const id = cur(), r = rv(id);
      const opt = e.target.closest('[data-opt]');
      if (opt) {
        if (P.attempts[id] || r.viewedOnly) { UI.toast('This question is already answered. Use “Retry question” to answer again.', 'info'); return; }
        ps.sel[id] = Number(opt.dataset.opt); redraw(); return;
      }
      const g = e.target.closest('[data-go]'); if (g) return go(Number(g.dataset.go));
      const a = e.target.closest('[data-a]'); if (!a) return;
      switch (a.dataset.a) {
        case 'prev': go(ps.idx - 1); break;
        case 'next': go(ps.idx + 1); break;
        case 'ans':
        case 'exp':
          if (!P.attempts[id]) { if (!lock(id)) r.viewedOnly = true; }
          if (a.dataset.a === 'ans') r.ans = true; else r.exp = true;
          redraw(); break;
        case 'retry':
          delete P.attempts[id]; delete ps.sel[id]; delete ps.reveal[id];
          redraw(); UI.toast('Question reset — choose your answer again.', 'info', 1800); break;
        case 'bm': { const on = App.toggleBookmark(id); UI.toast(on ? 'Bookmarked' : 'Bookmark removed', 'info', 1400); drawQ(); break; }
      }
    });

    function onKey(e) {
      if (document.querySelector('.modal-backdrop') || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      const m = { A: 0, B: 1, C: 2, D: 3, '1': 0, '2': 1, '3': 2, '4': 3 }[e.key.toUpperCase()];
      if (m != null) { const b = host.querySelector(`[data-opt="${m}"]`); if (b) b.click(); }
      else if (e.key === 'ArrowRight') go(ps.idx + 1);
      else if (e.key === 'ArrowLeft') go(ps.idx - 1);
    }
    document.addEventListener('keydown', onKey);
    redraw();
    return () => { document.removeEventListener('keydown', onKey); if (Store.state.practiceSession === ps && lock(cur())) Store.save(); };
  };
})();
