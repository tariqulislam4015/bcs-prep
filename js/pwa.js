/* Mobile-app (PWA) features: offline service worker, install button,
   update notice, persistent storage and keep-screen-awake during exams. */
(function () {
  'use strict';
  let deferredPrompt = null;
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  /* ---------- service worker + update notice ---------- */
  function registerSW() {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      const offer = (worker) => {
        const bar = document.getElementById('update-bar');
        if (!bar) return;
        bar.hidden = false;
        bar.querySelector('button').onclick = () => { worker.postMessage('SKIP_WAITING'); bar.hidden = true; };
      };
      if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w); });
      });
      // check for a new version when the app regains focus
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
    }).catch((e) => console.warn('Service worker registration failed', e));

    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      // never reload mid-exam; the new version is used next time the app opens
      if (window.Store && Store.state.activeExam) { UI.toast('Update installed — it will apply after your exam.', 'info'); return; }
      reloading = true; location.reload();
    });
  }

  /* ---------- install button ---------- */
  function setupInstall() {
    const btn = document.getElementById('install-btn');
    if (!btn) return;
    if (isStandalone()) { btn.hidden = true; return; }
    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; btn.hidden = false; });
    window.addEventListener('appinstalled', () => { btn.hidden = true; deferredPrompt = null; UI.toast('App installed! Open it from your home screen.', 'success', 5000); });
    if (isIOS()) btn.hidden = false; // iOS has no install prompt — show instructions instead
    btn.addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        await deferredPrompt.userChoice.catch(() => null);
        deferredPrompt = null; btn.hidden = true;
      } else {
        UI.confirmModal({
          title: 'Install as an app',
          body: isIOS()
            ? '<ol class="plain"><li>Open this page in <b>Safari</b>.</li><li>Tap the <b>Share</b> button (□↑).</li><li>Choose <b>Add to Home Screen</b> → <b>Add</b>.</li></ol>'
            : '<ol class="plain"><li><b>Android (Chrome):</b> tap the ⋮ menu → <b>Install app</b> / <b>Add to Home screen</b>.</li><li><b>PC / Laptop (Chrome or Edge):</b> click the install icon (⊕) in the address bar, or menu → <b>Install TIS BCS Prep</b>.</li></ol><p class="muted small">Installation needs the live https:// link (e.g. GitHub Pages), not a file opened from your disk.</p>',
          confirmText: 'OK', cancelText: ''
        });
      }
    });
  }

  /* ---------- keep data safe on mobile ---------- */
  function persistStorage() {
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persisted().then((p) => { if (!p) navigator.storage.persist().catch(() => {}); }).catch(() => {});
    }
  }

  /* ---------- keep the screen on during an exam ---------- */
  let wakeLock = null, wantAwake = false;
  async function acquire() {
    try { if ('wakeLock' in navigator && wantAwake && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch (e) { /* not supported / denied */ }
  }
  function keepAwake(on) {
    wantAwake = on;
    if (on) acquire(); else if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && wantAwake) acquire(); });

  window.PWA = { keepAwake, isStandalone };
  document.addEventListener('DOMContentLoaded', () => {
    registerSW(); setupInstall(); persistStorage();
    if (isStandalone()) document.documentElement.classList.add('standalone');
  });
})();
