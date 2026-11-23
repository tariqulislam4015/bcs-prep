/* Question Bank: search, filter, bookmark, reveal, launch practice from a filter. */
(function () {
  'use strict';
  const C = window.BCS_CONFIG, esc = UI.esc;
  const PAGE = 25;

  Views.bank = function (host) {
    const f = { search: '', bcs: '', subject: '', topic: '', source: '', status: '' };
    let page = 0;
    const open = new Set();

    function currentFilter() {
      const o = { search: f.search, subject: f.subject || undefined, topic: f.topic || undefined, source: f.source || undefined, status: f.status || undefined };
      if (f.bcs === 'none') o.bcs = 'none'; else if (f.bcs) o.bcs = Number(f.bcs);
      return o;
    }

    function shell() {
      const counts = QBank.bcsCounts();
      host.innerHTML = `
        <div class="page-head row"><div><h1>Question bank</h1><p class="muted">${QBank.all().length} questions · ${Store.state.bookmarks.length} bookmarked</p></div>
          <div class="actions"><button class="btn" data-b="random">Random 20 from results</button><button class="btn btn-primary" data-b="practice">Practise results</button></div></div>
        <div class="card filters-card">
          <input type="search" class="input" id="b-search" placeholder="Search question, option, topic or ID…" value="${esc(f.search)}">
          <div class="form-grid tight">
            <select class="input" id="b-bcs"><option value="">All BCS / sources</option><option value="none" ${f.bcs === 'none' ? 'selected' : ''}>Not tagged to a BCS (sample/practice)</option>
              ${Array.from({ length: C.BCS_MAX - C.BCS_MIN + 1 }, (_, i) => C.BCS_MIN + i).map(n => `<option value="${n}" ${String(f.bcs) === String(n) ? 'selected' : ''}>${C.ordinal(n)} BCS${counts[n] ? ` (${counts[n]})` : ' (0)'}</option>`).join('')}</select>
            <select class="input" id="b-sub">${App.subjectOptions(f.subject)}</select>
            <select class="input" id="b-top">${App.topicOptions(f.subject || null, f.topic)}</select>
            <select class="input" id="b-src">
              ${[['', 'Any source'], ['previous', 'Previous BCS papers'], ['sample', 'Sample questions'], ['verified', 'Imported · verified'], ['unverified', 'Imported · unverified']].map(([k, l]) => `<option value="${k}" ${f.source === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
            <select class="input" id="b-st">
              ${[['', 'Any status'], ['bookmarked', 'Bookmarked'], ['attempted', 'Attempted (practice)'], ['unattempted', 'Not attempted'], ['correct', 'Answered correctly'], ['wrong', 'Answered wrongly']].map(([k, l]) => `<option value="${k}" ${f.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
          </div>
        </div>
        <div id="b-list"></div>`;
    }

    function list() {
      const res = QBank.filter(currentFilter());
      const pages = Math.max(1, Math.ceil(res.length / PAGE));
      if (page >= pages) page = pages - 1;
      const slice = res.slice(page * PAGE, page * PAGE + PAGE);
      const at = Store.state.practice.attempts;
      host.querySelector('#b-list').innerHTML = `
        <div class="muted small list-meta">${res.length} result(s)${res.length > PAGE ? ` · page ${page + 1} of ${pages}` : ''}</div>
        ${slice.length ? slice.map(q => {
          const a = at[q.id], isOpen = open.has(q.id);
          return `<article class="bank-item card">
            <div class="q-meta"><code class="qid">${esc(q.id)}</code><span class="badge subj">${esc(C.subjectByKey[q.subject].short)}</span><span class="muted small">${esc(q.topic)}</span>
              ${q.bcs ? `<span class="badge">${q.paperLabel ? esc(q.paperLabel) : C.ordinal(q.bcs) + ' BCS'}</span>` : ''}${UI.sourceBadge(q)}
              ${a ? `<span class="badge ${a.ok ? 'st-correct' : 'st-wrong'}">Practice: ${a.ok ? 'correct' : 'wrong'}</span>` : ''}
              <span class="spacer"></span>
              <button class="icon-btn bm ${App.isBookmarked(q.id) ? 'on' : ''}" data-bm="${esc(q.id)}" title="Bookmark">★</button></div>
            <p class="q-text">${esc(q.question)}</p>
            <div class="options static compact">${q.options.map((o, i) => `<div class="opt ${isOpen && i === q.answer ? 'correct' : ''}"><span class="opt-letter">${UI.LETTERS[i]}</span><span class="opt-text">${esc(o)}</span></div>`).join('')}</div>
            ${isOpen ? `<div class="explain"><b>Answer: ${UI.letter(q.answer)}.</b> ${esc(q.explanation || '')}${q.sourceNote ? `<div class="muted small">Source: ${esc(q.sourceNote)}</div>` : ''}</div>` : ''}
            <div class="q-actions"><button class="btn btn-sm btn-outline" data-open="${esc(q.id)}">${isOpen ? 'Hide answer' : 'Show answer & explanation'}</button>
              <button class="btn btn-sm" data-one="${esc(q.id)}">Practise this</button></div>
          </article>`;
        }).join('') : Charts.empty('No questions match these filters.')}
        ${pages > 1 ? `<div class="pager"><button class="btn btn-sm" data-pg="-1" ${page === 0 ? 'disabled' : ''}>← Prev</button><span>${page + 1} / ${pages}</span><button class="btn btn-sm" data-pg="1" ${page >= pages - 1 ? 'disabled' : ''}>Next →</button></div>` : ''}`;
    }

    host.addEventListener('input', (e) => { if (e.target.id === 'b-search') { f.search = e.target.value; page = 0; list(); } });
    host.addEventListener('change', (e) => {
      const map = { 'b-bcs': 'bcs', 'b-sub': 'subject', 'b-top': 'topic', 'b-src': 'source', 'b-st': 'status' };
      const k = map[e.target.id]; if (!k) return;
      f[k] = e.target.value; page = 0;
      if (k === 'subject') { f.topic = ''; host.querySelector('#b-top').innerHTML = App.topicOptions(f.subject || null, ''); }
      list();
    });
    host.addEventListener('click', (e) => {
      const bm = e.target.closest('[data-bm]');
      if (bm) { const on = App.toggleBookmark(bm.dataset.bm); bm.classList.toggle('on', on); UI.toast(on ? 'Bookmarked' : 'Bookmark removed', 'info', 1400); if (f.status === 'bookmarked') list(); return; }
      const o = e.target.closest('[data-open]');
      if (o) { const id = o.dataset.open; open.has(id) ? open.delete(id) : open.add(id); list(); return; }
      const one = e.target.closest('[data-one]');
      if (one) { Views.startPractice({ ids: [one.dataset.one], label: 'Single question ' + one.dataset.one }); return; }
      const pg = e.target.closest('[data-pg]');
      if (pg) { page += Number(pg.dataset.pg); list(); window.scrollTo(0, 0); return; }
      const b = e.target.closest('[data-b]'); if (!b) return;
      const ids = QBank.filter(currentFilter()).map(q => q.id);
      if (!ids.length) return UI.toast('No questions match these filters.', 'warn');
      if (b.dataset.b === 'practice') Views.startPractice({ ids, label: 'Question bank selection (' + ids.length + ')' });
      if (b.dataset.b === 'random') Views.startPractice({ ids: UI.shuffle(ids).slice(0, 20), label: 'Random from question bank' });
    });

    shell(); list();
  };
})();
