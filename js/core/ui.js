/* UI helpers: escaping, formatting, toasts, modal confirm, downloads. */
(function () {
  'use strict';

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const LETTERS = ['A', 'B', 'C', 'D'];
  const letter = (i) => (i == null || i < 0 ? '—' : LETTERS[i]);

  // Round to 2 dp and strip trailing zeros (e.g. 12.50 -> 12.5, -0 -> 0).
  function num(x, dp = 2) {
    if (x == null || isNaN(x)) return '0';
    const v = Math.round(x * Math.pow(10, dp)) / Math.pow(10, dp);
    return String(Object.is(v, -0) ? 0 : v);
  }
  function pct(n, d) { return d > 0 ? (n / d) * 100 : 0; }
  function pctStr(n, d) { return d > 0 ? num(pct(n, d), 1) + '%' : '—'; }

  function fmtClock(sec) {
    sec = Math.max(0, Math.round(sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    const p = (n) => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
  }
  function fmtDuration(sec) {
    sec = Math.max(0, Math.round(sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    if (h) return `${h}h ${m}m ${s}s`;
    if (m) return `${m}m ${s}s`;
    return `${s}s`;
  }
  function fmtDate(ts, withTime = true) {
    if (!ts) return '—';
    const d = new Date(ts);
    const opts = { day: '2-digit', month: 'short', year: 'numeric' };
    if (withTime) Object.assign(opts, { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleString(undefined, opts);
  }

  function toast(msg, type = 'info', ms = 3200) {
    let host = document.getElementById('toast-host');
    if (!host) { host = document.createElement('div'); host.id = 'toast-host'; document.body.appendChild(host); }
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.setAttribute('role', 'status');
    t.textContent = msg;
    host.appendChild(t);
    setTimeout(() => { t.classList.add('toast-out'); setTimeout(() => t.remove(), 250); }, ms);
  }

  // Promise-based modal. Returns true on confirm, false on cancel.
  function confirmModal({ title, body = '', confirmText = 'Confirm', cancelText = 'Cancel', danger = false, requireText = null }) {
    return new Promise((resolve) => {
      const wrap = document.createElement('div');
      wrap.className = 'modal-backdrop';
      wrap.innerHTML = `
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <h3 id="modal-title">${esc(title)}</h3>
          <div class="modal-body">${body}</div>
          ${requireText ? `<label class="field"><span>Type <b>${esc(requireText)}</b> to confirm</span><input type="text" class="input" id="modal-req" autocomplete="off"></label>` : ''}
          <div class="modal-actions">
            ${cancelText ? `<button class="btn btn-ghost" data-m="cancel">${esc(cancelText)}</button>` : ''}
            <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-m="ok" ${requireText ? 'disabled' : ''}>${esc(confirmText)}</button>
          </div>
        </div>`;
      document.body.appendChild(wrap);
      const ok = wrap.querySelector('[data-m="ok"]');
      const req = wrap.querySelector('#modal-req');
      if (req) { req.addEventListener('input', () => { ok.disabled = req.value.trim() !== requireText; }); setTimeout(() => req.focus(), 30); }
      else setTimeout(() => ok.focus(), 30);
      const close = (v) => { document.removeEventListener('keydown', onKey); wrap.remove(); resolve(v); };
      const onKey = (e) => { if (e.key === 'Escape') close(false); };
      document.addEventListener('keydown', onKey);
      wrap.addEventListener('click', (e) => {
        if (e.target === wrap) return close(false);
        const m = e.target.closest('[data-m]');
        if (!m) return;
        close(m.dataset.m === 'ok');
      });
    });
  }

  function download(filename, content, mime = 'application/octet-stream') {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
    if (window.AndroidBridge && window.AndroidBridge.saveFile) {        // inside the Android app
      const r = new FileReader();
      r.onload = () => { window.AndroidBridge.saveFile(filename, String(r.result).split(',')[1] || '', blob.type || mime); };
      r.readAsDataURL(blob);
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
  }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsText(file, 'utf-8');
    });
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  const uid = (p = 'id') => p + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);

  function levelBadge(lv) {
    return `<span class="badge ${lv.cls}">${esc(lv.label)}</span>`;
  }

  function sourceBadge(q) {
    if (q.source === 'sample') return '<span class="badge src-sample" title="Sample practice question — not an official BCS question">Sample</span>';
    if (q.verified) return '<span class="badge src-verified" title="Imported and marked verified by you">Official · Verified</span>';
    if (q.bcs) return '<span class="badge src-unverified" title="Imported with a BCS number but not marked verified">Official · Unverified</span>';
    return '<span class="badge src-imported">Imported</span>';
  }

  window.UI = { esc, letter, LETTERS, num, pct, pctStr, fmtClock, fmtDuration, fmtDate, toast, confirmModal, download, readFile, shuffle, uid, levelBadge, sourceBadge };
})();
