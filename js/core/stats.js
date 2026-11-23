/* Statistics engine: scoring, subject/topic aggregation, levels, recommendations.
   All numbers shown in the app are computed here from raw saved records. */
(function () {
  'use strict';
  const C = window.BCS_CONFIG;

  // Score a list of {ok: true|false|null} with a marking scheme.
  function score(items, cm, nm) {
    let correct = 0, wrong = 0, skipped = 0;
    for (const it of items) { if (it.ok === true) correct++; else if (it.ok === false) wrong++; else skipped++; }
    const marks = correct * cm - wrong * nm;
    return { correct, wrong, skipped, attempted: correct + wrong, total: items.length, marks: round2(marks) };
  }
  const round2 = (x) => Math.round(x * 100) / 100;

  // Build a completed exam record summary from answers.
  function summarizeExam(rec) {
    const { correctMark: cm, negativeMark: nm } = rec.config;
    const s = score(rec.items, cm, nm);
    const maxMarks = rec.items.length * cm;
    return {
      ...s,
      maxMarks: round2(maxMarks),
      pct: maxMarks > 0 ? round2((s.marks / maxMarks) * 100) : 0,
      accuracy: s.attempted > 0 ? round2((s.correct / s.attempted) * 100) : 0
    };
  }

  /* ---------- flatten records into scored items ---------- */
  function examItems() {
    const out = [];
    for (const ex of Store.state.exams) {
      const { correctMark: cm, negativeMark: nm } = ex.config;
      for (const it of ex.items) {
        out.push({ s: it.s, t: it.t, bcs: ex.bcs, ok: it.ok, marks: it.ok === true ? cm : it.ok === false ? -nm : 0 });
      }
    }
    return out;
  }
  function practiceItems() {
    const { correctMark: cm, negativeMark: nm } = Store.state.settings.practiceMarking;
    return Object.entries(Store.state.practice.attempts).map(([qid, a]) => ({
      qid, s: a.s, t: a.t, bcs: a.bcs || null, ok: a.ok, marks: a.ok ? cm : -nm
    }));
  }
  function itemsFor(mode) {
    if (mode === 'exam') return examItems();
    if (mode === 'practice') return practiceItems();
    return examItems().concat(practiceItems());
  }

  function agg(items) {
    let correct = 0, wrong = 0, skipped = 0, marks = 0;
    for (const it of items) { if (it.ok === true) correct++; else if (it.ok === false) wrong++; else skipped++; marks += it.marks; }
    const attempted = correct + wrong;
    return { correct, wrong, skipped, attempted, marks: round2(marks), accuracy: attempted ? round2(correct / attempted * 100) : 0 };
  }

  function level(acc, attempted) {
    if (attempted < C.MIN_ATTEMPTS_FOR_LEVEL) return { label: 'Not enough data', cls: 'lvl-none', rank: -1 };
    const lv = C.LEVELS.find(l => acc >= l.min);
    return { ...lv, rank: C.LEVELS.length - C.LEVELS.indexOf(lv) };
  }

  function subjectStats(mode = 'all') {
    const items = itemsFor(mode);
    const avail = QBank.countBySubject();
    // practice-unattempted = available questions never attempted in Practice
    const attemptedIds = new Set(Object.keys(Store.state.practice.attempts));
    const unattempted = Object.fromEntries(C.SUBJECTS.map(s => [s.key, 0]));
    for (const q of QBank.all()) if (!attemptedIds.has(q.id) && unattempted[q.subject] != null) unattempted[q.subject]++;
    return C.SUBJECTS.map(sub => {
      const a = agg(items.filter(i => i.s === sub.key));
      return { key: sub.key, subject: sub, available: avail[sub.key] || 0, practiceUnattempted: unattempted[sub.key], ...a, level: level(a.accuracy, a.attempted) };
    });
  }

  function topicStats(mode = 'all', subject = null) {
    const items = itemsFor(mode).filter(i => !subject || i.s === subject);
    const avail = {};
    for (const q of QBank.all()) if (!subject || q.subject === subject) { const k = q.subject + '||' + q.topic; avail[k] = (avail[k] || 0) + 1; }
    const groups = {};
    for (const it of items) { const k = it.s + '||' + it.t; (groups[k] = groups[k] || []).push(it); }
    const keys = new Set([...Object.keys(avail), ...Object.keys(groups)]);
    return Array.from(keys).map(k => {
      const [s, t] = k.split('||');
      const a = agg(groups[k] || []);
      return { subject: s, topic: t, available: avail[k] || 0, ...a, level: level(a.accuracy, a.attempted) };
    }).sort((x, y) => x.subject.localeCompare(y.subject) || x.topic.localeCompare(y.topic));
  }

  function bcsStats(mode = 'all') {
    const groups = {};
    for (const it of itemsFor(mode)) { const k = it.bcs || 'sample'; (groups[k] = groups[k] || []).push(it); }
    return Object.entries(groups).map(([k, arr]) => ({ bcs: k === 'sample' ? null : Number(k), ...agg(arr) }))
      .sort((a, b) => (a.bcs || 0) - (b.bcs || 0));
  }

  // Per-BCS exam comparison (exam records only).
  function examComparison() {
    const by = {};
    for (const ex of Store.state.exams) (by[ex.bcs] = by[ex.bcs] || []).push(ex);
    return Object.entries(by).map(([bcs, list]) => {
      list.sort((a, b) => a.submittedAt - b.submittedAt);
      const pcts = list.map(e => e.summary.pct);
      return {
        bcs: Number(bcs), count: list.length,
        avgPct: round2(pcts.reduce((x, y) => x + y, 0) / pcts.length),
        bestPct: Math.max(...pcts), latestPct: pcts[pcts.length - 1],
        avgAccuracy: round2(list.reduce((x, e) => x + e.summary.accuracy, 0) / list.length),
        bestMarks: Math.max(...list.map(e => e.summary.marks)),
        latest: list[list.length - 1]
      };
    }).sort((a, b) => a.bcs - b.bcs);
  }

  function overall() {
    const exams = Store.state.exams.slice().sort((a, b) => a.submittedAt - b.submittedAt);
    const ex = agg(examItems());
    const pr = agg(practiceItems());
    const all = agg(examItems().concat(practiceItems()));
    const pcts = exams.map(e => e.summary.pct);
    const latest = exams[exams.length - 1] || null;
    const prev = exams[exams.length - 2] || null;
    const best = exams.length ? exams.reduce((b, e) => (e.summary.pct > b.summary.pct ? e : b)) : null;
    return {
      exam: ex, practice: pr, all,
      examsCompleted: exams.length,
      avgExamPct: pcts.length ? round2(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null,
      avgExamMarks: exams.length ? round2(exams.reduce((a, e) => a + e.summary.marks, 0) / exams.length) : null,
      best, latest, prev,
      improvement: latest && prev ? round2(latest.summary.pct - prev.summary.pct) : null,
      practiceAttempted: Object.keys(Store.state.practice.attempts).length,
      totalAvailable: QBank.all().length
    };
  }

  // Human-readable recommendations based on actual data.
  function recommendations(mode = 'all') {
    const subs = subjectStats(mode);
    const topics = topicStats(mode);
    const recs = [];
    const rated = subs.filter(s => s.level.rank >= 0);
    const untouched = subs.filter(s => s.attempted === 0);

    const tips = {
      bangla: 'Revise literature (authors & works) and grammar (সন্ধি, সমাস, বানান).',
      english: 'Improve English grammar (voice, agreement, prepositions) and literature authors.',
      bdaffairs: 'Revise Bangladesh Affairs: Liberation War, constitution and key dates.',
      intaffairs: 'Revise international organizations, headquarters and treaties.',
      science: 'Review basic physics units, human biology and chemistry facts.',
      ict: 'Practise number systems, networking basics and computer fundamentals.',
      math: 'Focus more on Mathematics — practise percentage, ratio, profit-loss and algebra drills.',
      mental: 'Practise series, coding-decoding and direction problems under time limits.',
      geo: 'Revise Bangladesh geography, climate change agreements and disaster facts.',
      ethics: 'Revise governance concepts and Bangladesh integrity institutions.'
    };

    rated.filter(s => s.level.label === 'Weak').sort((a, b) => a.accuracy - b.accuracy)
      .forEach(s => recs.push({ type: 'weak', text: `${s.subject.short} is weak (${s.accuracy}% accuracy). ${tips[s.key]}` }));
    rated.filter(s => s.level.label === 'Average')
      .forEach(s => recs.push({ type: 'average', text: `${s.subject.short} is average (${s.accuracy}%). ${tips[s.key]}` }));
    rated.filter(s => s.level.label === 'Good')
      .forEach(s => recs.push({ type: 'good', text: `${s.subject.short} is good (${s.accuracy}%) — a little more revision can make it a strength.` }));
    rated.filter(s => s.level.label === 'Strong')
      .forEach(s => recs.push({ type: 'strong', text: `Maintain your performance in ${s.subject.short} (${s.accuracy}%).` }));

    const weakTopics = topics.filter(t => t.attempted >= 3 && t.accuracy < 50).sort((a, b) => a.accuracy - b.accuracy).slice(0, 5);
    weakTopics.forEach(t => recs.push({ type: 'topic', text: `Weak topic: ${C.subjectByKey[t.subject].short} → ${t.topic} (${t.correct}/${t.attempted} correct).` }));

    if (untouched.length && untouched.length < subs.length) {
      recs.push({ type: 'info', text: `Not yet attempted: ${untouched.map(s => s.subject.short).join(', ')}. Practise these to get a complete picture.` });
    }
    const insufficient = subs.filter(s => s.attempted > 0 && s.level.rank < 0);
    if (insufficient.length) recs.push({ type: 'info', text: `Attempt at least ${C.MIN_ATTEMPTS_FOR_LEVEL} questions in ${insufficient.map(s => s.subject.short).join(', ')} for a reliable rating.` });
    return recs;
  }

  function performanceSummary(sum) {
    const p = sum.pct;
    let verdict;
    if (p >= 70) verdict = 'Excellent performance — comfortably above typical preliminary cut-off levels.';
    else if (p >= 60) verdict = 'Very good performance. Keep sharpening weaker subjects.';
    else if (p >= 50) verdict = 'Satisfactory. Reduce wrong answers to protect against negative marking.';
    else if (p >= 35) verdict = 'Below target. Focus on weak subjects and answer only when reasonably sure.';
    else verdict = 'Needs significant improvement. Start with subject-wise practice before attempting full exams.';
    const negLoss = sum.wrong > 0 ? ` Negative marking cost you ${round2(sum.wrong * (sum.nm || 0.5))} marks.` : '';
    return verdict + negLoss;
  }

  window.Stats = { score, summarizeExam, subjectStats, topicStats, bcsStats, examComparison, overall, recommendations, level, agg, performanceSummary, itemsFor };
})();
