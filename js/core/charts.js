/* Lightweight dependency-free SVG charts. Colours come from CSS variables. */
(function () {
  'use strict';
  const esc = (s) => UI.esc(s);

  function empty(msg) { return `<div class="chart-empty">${esc(msg || 'No data yet')}</div>`; }

  function accColor(v) {
    if (v >= 80) return 'var(--c-strong)';
    if (v >= 65) return 'var(--c-good)';
    if (v >= 50) return 'var(--c-average)';
    return 'var(--c-weak)';
  }

  // Horizontal bars, values 0..max. rows: [{label, value, note, color}]
  function hbar(rows, { max = 100, unit = '%', emptyMsg } = {}) {
    if (!rows.length) return empty(emptyMsg);
    return `<div class="hbar">${rows.map(r => {
      const w = Math.max(0, Math.min(100, (r.value / max) * 100));
      const color = r.color || accColor(r.value);
      return `<div class="hbar-row" title="${esc(r.label)}: ${UI.num(r.value, 1)}${unit}">
        <div class="hbar-label">${esc(r.label)}</div>
        <div class="hbar-track"><div class="hbar-fill" style="width:${w}%;background:${color}"></div></div>
        <div class="hbar-val">${r.na ? '—' : UI.num(r.value, 1) + unit}${r.note ? `<small>${esc(r.note)}</small>` : ''}</div>
      </div>`;
    }).join('')}</div>`;
  }

  // Donut. segs: [{label, value, color}]
  function donut(segs, { center = '', sub = '' } = {}) {
    const total = segs.reduce((a, s) => a + s.value, 0);
    if (!total) return empty();
    const R = 60, r = 40, cx = 75, cy = 75;
    let a0 = -Math.PI / 2, paths = '';
    for (const s of segs) {
      if (!s.value) continue;
      const frac = s.value / total;
      if (frac >= 0.9999) {
        paths += `<circle cx="${cx}" cy="${cy}" r="${(R + r) / 2}" fill="none" stroke="${s.color}" stroke-width="${R - r}"><title>${esc(s.label)}: ${s.value}</title></circle>`;
        break;
      }
      const a1 = a0 + frac * Math.PI * 2;
      const large = frac > 0.5 ? 1 : 0;
      const p = (ang, rad) => [cx + rad * Math.cos(ang), cy + rad * Math.sin(ang)].map(n => n.toFixed(2)).join(' ');
      paths += `<path d="M ${p(a0, R)} A ${R} ${R} 0 ${large} 1 ${p(a1, R)} L ${p(a1, r)} A ${r} ${r} 0 ${large} 0 ${p(a0, r)} Z" fill="${s.color}"><title>${esc(s.label)}: ${s.value} (${UI.num(frac * 100, 1)}%)</title></path>`;
      a0 = a1;
    }
    return `<div class="donut">
      <svg viewBox="0 0 150 150" role="img" aria-label="Distribution chart">${paths}
        <text x="75" y="73" text-anchor="middle" class="donut-center">${esc(center)}</text>
        <text x="75" y="91" text-anchor="middle" class="donut-sub">${esc(sub)}</text>
      </svg>
      <ul class="legend">${segs.map(s => `<li><i style="background:${s.color}"></i>${esc(s.label)} <b>${s.value}</b> <span class="muted">(${UI.num(total ? s.value / total * 100 : 0, 1)}%)</span></li>`).join('')}</ul>
    </div>`;
  }

  // Line chart. pts: [{label, value, tip}]; yMin/yMax fixed range.
  function line(pts, { yMin = 0, yMax = 100, unit = '%', emptyMsg, color = 'var(--c-primary)', refLine = null } = {}) {
    if (!pts.length) return empty(emptyMsg);
    const W = 640, H = 230, L = 44, Rr = 14, T = 14, B = 36;
    const iw = W - L - Rr, ih = H - T - B;
    const lo = Math.min(yMin, ...pts.map(p => p.value)), hi = Math.max(yMax, ...pts.map(p => p.value));
    const span = hi - lo || 1;
    const x = (i) => L + (pts.length === 1 ? iw / 2 : (i / (pts.length - 1)) * iw);
    const y = (v) => T + ih - ((v - lo) / span) * ih;
    let grid = '';
    for (let k = 0; k <= 4; k++) {
      const v = lo + (span * k) / 4, yy = y(v);
      grid += `<line x1="${L}" x2="${W - Rr}" y1="${yy}" y2="${yy}" class="grid"/><text x="${L - 6}" y="${yy + 4}" text-anchor="end" class="axis">${UI.num(v, 0)}${unit}</text>`;
    }
    if (lo < 0) grid += `<line x1="${L}" x2="${W - Rr}" y1="${y(0)}" y2="${y(0)}" class="zero"/>`;
    if (refLine != null) grid += `<line x1="${L}" x2="${W - Rr}" y1="${y(refLine)}" y2="${y(refLine)}" class="ref"/>`;
    const step = Math.ceil(pts.length / 10);
    const labels = pts.map((p, i) => (i % step === 0 || i === pts.length - 1) ? `<text x="${x(i)}" y="${H - 12}" text-anchor="middle" class="axis">${esc(p.label)}</text>` : '').join('');
    const d = pts.map((p, i) => `${i ? 'L' : 'M'} ${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
    const dots = pts.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.value)}" r="4" fill="${color}" class="dot"><title>${esc(p.tip || p.label + ': ' + UI.num(p.value, 1) + unit)}</title></circle>`).join('');
    return `<svg class="linechart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Line chart">${grid}<path d="${d}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>${dots}${labels}</svg>`;
  }

  // Vertical bars. pts: [{label, value, max, tip, color}]
  function vbar(pts, { unit = '', emptyMsg } = {}) {
    if (!pts.length) return empty(emptyMsg);
    const W = 640, H = 230, L = 44, Rr = 10, T = 14, B = 36;
    const iw = W - L - Rr, ih = H - T - B;
    let hi = Math.max(1, ...pts.map(p => Math.max(p.value, p.max || 0)));
    if (pts.every(p => Number.isInteger(p.value))) hi = Math.max(4, Math.ceil(hi / 4) * 4); // whole-number ticks for counts
    const lo = Math.min(0, ...pts.map(p => p.value));
    const span = hi - lo;
    const y = (v) => T + ih - ((v - lo) / span) * ih;
    const bw = Math.min(42, (iw / pts.length) * 0.6);
    let grid = '';
    for (let k = 0; k <= 4; k++) { const v = lo + span * k / 4; grid += `<line x1="${L}" x2="${W - Rr}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" class="axis">${UI.num(v, 0)}${unit}</text>`; }
    const step = Math.ceil(pts.length / 12);
    const bars = pts.map((p, i) => {
      const cx = L + (i + 0.5) * (iw / pts.length);
      const y0 = y(0), y1 = y(p.value);
      const top = Math.min(y0, y1), h = Math.max(1, Math.abs(y1 - y0));
      return `<rect x="${cx - bw / 2}" y="${top}" width="${bw}" height="${h}" rx="3" fill="${p.color || 'var(--c-primary)'}"><title>${esc(p.tip || p.label + ': ' + p.value)}</title></rect>` +
        ((i % step === 0) ? `<text x="${cx}" y="${H - 12}" text-anchor="middle" class="axis">${esc(p.label)}</text>` : '');
    }).join('');
    return `<svg class="linechart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Bar chart">${grid}<line x1="${L}" x2="${W - Rr}" y1="${y(0)}" y2="${y(0)}" class="zero"/>${bars}</svg>`;
  }

  function progress(value, { cls = '' } = {}) {
    const w = Math.max(0, Math.min(100, value));
    return `<div class="progress ${cls}"><div class="progress-fill" style="width:${w}%"></div></div>`;
  }

  window.Charts = { hbar, donut, line, vbar, progress, accColor, empty };
})();
