/* Mobile-app (PWA) features: offline service worker, install button,
   update notice, persistent storage and keep-screen-awake during exams. */
(function () {
  'use strict';
  let deferredPrompt = null;
  const isApp = () => !!window.AndroidBridge || /TISBCSApp/.test(navigator.userAgent);
  const APK_LOCAL = 'downloads/TIS-BCS-Prep.apk';
  const APK_RELEASE = 'https://github.com/tariqulislam4015/bcs-prep/releases/latest/download/TIS-BCS-Prep.apk';
  let apkUrl = APK_LOCAL;
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
    const hadController = !!navigator.serviceWorker.controller; // first visit: no reload needed
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading || !hadController) return;
      // never reload mid-exam; the new version is used next time the app opens
      if (window.Store && Store.state.activeExam) { UI.toast('Update installed — it will apply after your exam.', 'info'); return; }
      reloading = true; location.reload();
    });
  }

  /* ---------- install button ---------- */
  function setupInstall() {
    const btn = document.getElementById('install-btn');
    if (!btn) return;
    if (isStandalone() || isApp()) { btn.hidden = true; return; }
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
    if (window.AndroidBridge && window.AndroidBridge.keepAwake) { window.AndroidBridge.keepAwake(!!on); return; }
    wantAwake = on;
    if (on) acquire(); else if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && wantAwake) acquire(); });

  /* ---------- Android APK download links ---------- */
  // Uses the APK published next to the LIVE site; falls back to the latest GitHub Release.
  function setupApkLinks() {
    if (isApp()) { document.documentElement.classList.add('in-app'); return; }
    let checked = false;
    const apply = () => { checked = true; document.querySelectorAll('[data-apk]').forEach(a => { if (a.getAttribute('href') !== apkUrl) a.href = apkUrl; if (a.hidden) a.hidden = false; }); };
    if (location.protocol.startsWith('http')) {
      fetch(APK_LOCAL, { method: 'HEAD', cache: 'no-store' })
        .then(r => { if (!r.ok) apkUrl = APK_RELEASE; })
        .catch(() => { apkUrl = APK_RELEASE; })
        .finally(apply);
    } else { apkUrl = APK_RELEASE; apply(); }
    // views re-render; keep newly drawn buttons pointing at the right file
    new MutationObserver(() => { if (checked) apply(); }).observe(document.body, { childList: true, subtree: true });
  }
  const apkButton = (cls = '') => isApp() ? '' : `<a class="btn apk-btn ${cls}" data-apk href="${APK_LOCAL}" download="TIS-BCS-Prep.apk" hidden>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.5 9.5H6.5a1 1 0 0 0-1 1V17a1.5 1.5 0 0 0 1.5 1.5h.5V21a1 1 0 0 0 2 0v-2.5h5V21a1 1 0 0 0 2 0v-2.5h.5A1.5 1.5 0 0 0 18.5 17v-6.5a1 1 0 0 0-1-1zM3.5 9.5a1 1 0 0 0-1 1v5a1 1 0 0 0 2 0v-5a1 1 0 0 0-1-1zm17 0a1 1 0 0 0-1 1v5a1 1 0 0 0 2 0v-5a1 1 0 0 0-1-1zM15.6 4.1l1-1.6a.3.3 0 0 0-.5-.3l-1 1.7a6.3 6.3 0 0 0-6.2 0l-1-1.7a.3.3 0 0 0-.5.3l1 1.6A5.4 5.4 0 0 0 6.5 8.5h11a5.4 5.4 0 0 0-1.9-4.4zM9.5 6.7a.7.7 0 1 1 0-1.4.7.7 0 0 1 0 1.4zm5 0a.7.7 0 1 1 0-1.4.7.7 0 0 1 0 1.4z"/></svg>
      <span>Download Android App (APK)</span></a>`;

  window.PWA = { keepAwake, isStandalone, isApp, apkButton };
  document.addEventListener('DOMContentLoaded', () => {
    if (!isApp()) registerSW();
    setupInstall(); persistStorage(); setupApkLinks();
    if (isStandalone()) document.documentElement.classList.add('standalone');
  });
})();
