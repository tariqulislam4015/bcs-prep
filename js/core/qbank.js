/* Question bank: sample + imported questions, lookup, filtering, import parsing. */
(function () {
  'use strict';
  const C = window.BCS_CONFIG;

  let cache = null; // { list, byId }

  function normalizeSample(r) {
    return {
      id: r.id, bcs: null, subject: r.s, topic: r.t || 'General',
      question: r.q, options: r.o.slice(0, 4), answer: r.a,
      explanation: r.e || '', source: 'sample', verified: false
    };
  }

  function rebuild() {
    const map = new Map();
    for (const r of (window.BCS_SAMPLE_QUESTIONS || [])) map.set(r.id, normalizeSample(r));
    for (const q of (Store.state.imported || [])) map.set(q.id, q); // imported may override same id
    const list = Array.from(map.values());
    const order = Object.fromEntries(C.SUBJECTS.map((s, i) => [s.key, i]));
    list.sort((a, b) => (order[a.subject] - order[b.subject]) || String(a.id).localeCompare(String(b.id)));
    cache = { list, byId: map };
  }
  function ensure() { if (!cache) rebuild(); return cache; }

  const all = () => ensure().list;
  const get = (id) => ensure().byId.get(id);

  function topics(subject) {
    const set = new Map();
    for (const q of all()) if (!subject || q.subject === subject) set.set(q.topic, (set.get(q.topic) || 0) + 1);
    return Array.from(set.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([name, count]) => ({ name, count }));
  }

  function countBySubject() {
    const out = Object.fromEntries(C.SUBJECTS.map(s => [s.key, 0]));
    for (const q of all()) if (out[q.subject] != null) out[q.subject]++;
    return out;
  }

  // Distinct BCS numbers that have imported questions.
  function bcsCounts() {
    const m = {};
    for (const q of all()) if (q.bcs) m[q.bcs] = (m[q.bcs] || 0) + 1;
    return m;
  }

  function forBcs(bcs) { return all().filter(q => q.bcs === bcs); }
  function generalPool() { return all().filter(q => !q.bcs); }

  /* -------- filtering (used by Question Bank and Practice setup) -------- */
  function filter(f = {}) {
    const term = (f.search || '').trim().toLowerCase();
    const attempts = Store.state.practice.attempts;
    const bm = new Set(Store.state.bookmarks);
    return all().filter(q => {
      if (f.bcs === 'sample' && q.source !== 'sample') return false;
      if (f.bcs === 'none' && q.bcs) return false;
      if (typeof f.bcs === 'number' && q.bcs !== f.bcs) return false;
      if (f.subject && q.subject !== f.subject) return false;
      if (f.topic && q.topic !== f.topic) return false;
      if (f.source === 'sample' && q.source !== 'sample') return false;
      if (f.source === 'verified' && !(q.source !== 'sample' && q.verified)) return false;
      if (f.source === 'unverified' && !(q.source !== 'sample' && !q.verified)) return false;
      const at = attempts[q.id];
      if (f.status === 'attempted' && !at) return false;
      if (f.status === 'unattempted' && at) return false;
      if (f.status === 'correct' && !(at && at.ok === true)) return false;
      if (f.status === 'wrong' && !(at && at.ok === false)) return false;
      if (f.status === 'bookmarked' && !bm.has(q.id)) return false;
      if (term) {
        const hay = (q.question + ' ' + q.options.join(' ') + ' ' + q.topic + ' ' + q.id + ' ' + q.explanation).toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }

  /* --------------------------- import --------------------------- */
  function resolveSubject(v) {
    if (!v) return null;
    const s = String(v).trim().toLowerCase();
    for (const sub of C.SUBJECTS) {
      if (sub.key === s || sub.en.toLowerCase() === s || sub.bn === String(v).trim() || sub.short.toLowerCase() === s) return sub.key;
    }
    // loose matches
    const aliases = { 'bangla': 'bangla', 'bengali': 'bangla', 'english': 'english', 'bangladesh': 'bdaffairs', 'international': 'intaffairs',
      'science': 'science', 'general science': 'science', 'computer': 'ict', 'ict': 'ict', 'math': 'math', 'mathematics': 'math',
      'mental': 'mental', 'mental ability': 'mental', 'geography': 'geo', 'ethics': 'ethics' };
    for (const k of Object.keys(aliases)) if (s.startsWith(k)) return aliases[k];
    return null;
  }

  function resolveAnswer(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return (v >= 0 && v <= 3) ? v : null;
    const s = String(v).trim().toUpperCase();
    const map = { A: 0, B: 1, C: 2, D: 3, 'ক': 0, 'খ': 1, 'গ': 2, 'ঘ': 3 };
    if (map[s] != null) return map[s];
    if (/^[0-3]$/.test(s)) return Number(s);
    return null;
  }

  function toBool(v) {
    if (typeof v === 'boolean') return v;
    return /^(true|yes|1|y)$/i.test(String(v || '').trim());
  }

  // Minimal RFC-4180 CSV parser (quotes, escaped quotes, newlines in fields).
  function parseCSV(text) {
    const rows = []; let row = [], field = '', i = 0, inQ = false;
    text = text.replace(/^﻿/, '');
    while (i < text.length) {
      const c = text[i];
      if (inQ) {
        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
        else field += c;
      } else {
        if (c === '"') inQ = true;
        else if (c === ',') { row.push(field); field = ''; }
        else if (c === '\n' || c === '\r') {
          if (c === '\r' && text[i + 1] === '\n') i++;
          row.push(field); rows.push(row); row = []; field = '';
        } else field += c;
      }
      i++;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows.filter(r => r.some(x => String(x).trim() !== ''));
  }

  function csvToObjects(text) {
    const rows = parseCSV(text);
    if (!rows.length) return [];
    const head = rows[0].map(h => h.trim().toLowerCase());
    return rows.slice(1).map(r => Object.fromEntries(head.map((h, i) => [h, r[i] != null ? r[i] : ''])));
  }

  // Accepts objects using either full keys or compact keys.
  function validate(raw, idx) {
    const errs = [];
    const question = (raw.question ?? raw.q ?? '').toString().trim();
    let options = raw.options ?? raw.o;
    if (!Array.isArray(options)) options = [raw.option_a ?? raw.a_text ?? raw.optiona, raw.option_b ?? raw.optionb, raw.option_c ?? raw.optionc, raw.option_d ?? raw.optiond];
    options = (options || []).map(x => (x == null ? '' : String(x).trim()));
    const answer = resolveAnswer(raw.answer ?? raw.correct ?? raw.correct_answer ?? raw.a);
    const subject = resolveSubject(raw.subject ?? raw.s);
    let bcs = raw.bcs ?? raw.bcs_exam ?? '';
    bcs = String(bcs).replace(/[^0-9]/g, '');
    bcs = bcs ? Number(bcs) : null;

    if (!question) errs.push('missing question');
    if (options.length !== 4 || options.some(o => !o)) errs.push('needs exactly 4 non-empty options');
    if (answer == null) errs.push('answer must be A–D (or 0–3)');
    if (!subject) errs.push('unknown subject "' + (raw.subject ?? raw.s ?? '') + '"');
    if (bcs != null && (bcs < C.BCS_MIN || bcs > C.BCS_MAX)) errs.push(`BCS must be ${C.BCS_MIN}–${C.BCS_MAX}`);
    if (errs.length) return { error: `Row ${idx + 1}: ${errs.join('; ')}` };

    const id = String(raw.id || '').trim() || `IMP-${bcs || 'X'}-${hash(question + options.join('|'))}`;
    return {
      q: {
        id, bcs, subject, topic: String(raw.topic ?? raw.t ?? '').trim() || 'General',
        question, options, answer,
        explanation: String(raw.explanation ?? raw.e ?? '').trim(),
        source: bcs ? 'official' : 'imported',
        verified: toBool(raw.verified),
        sourceNote: String(raw.source_note ?? raw.reference ?? '').trim()
      }
    };
  }

  function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return (h >>> 0).toString(36); }

  function parseImport(text, filename = '') {
    let rows;
    if (/\.csv$/i.test(filename) || (!/^\s*[[{]/.test(text))) rows = csvToObjects(text);
    else {
      const parsed = JSON.parse(text);
      rows = Array.isArray(parsed) ? parsed : (parsed.questions || []);
    }
    const questions = [], errors = [];
    rows.forEach((r, i) => { const v = validate(r, i); if (v.error) errors.push(v.error); else questions.push(v.q); });
    return { questions, errors, total: rows.length };
  }

  function addImported(questions) {
    const existing = new Map(Store.state.imported.map(q => [q.id, q]));
    let added = 0, updated = 0;
    for (const q of questions) { if (existing.has(q.id)) updated++; else added++; existing.set(q.id, q); }
    Store.state.imported = Array.from(existing.values());
    Store.save(); rebuild();
    return { added, updated };
  }

  function clearImported() { Store.state.imported = []; Store.save(); rebuild(); }

  window.QBank = { all, get, topics, countBySubject, bcsCounts, forBcs, generalPool, filter, parseImport, addImported, clearImported, rebuild, parseCSV };
})();
