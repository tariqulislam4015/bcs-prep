/* Author / mentor profile: photo, name, degree, channel and contact links.
   Edit PROFILE below to change any detail. */
(function () {
  'use strict';
  const esc = (s) => UI.esc(s);

  const PROFILE = {
    name: 'তারিকুল ইসলাম (সুমন)',
    nameEn: 'Tariqul Islam (Sumon)',
    degree: 'MSc Mathematics',
    photo: 'assets/profile.jpg',
    academy: 'TIS Academy',
    tagline: 'Teach Idea For Success',
    academyLogo: 'assets/tis-logo.jpg',
    links: [
      { type: 'youtube',  label: 'TIS Academy', sub: 'YouTube channel', url: 'https://www.youtube.com/@tis.academy24' },
      { type: 'facebook', label: 'Facebook', sub: 'tariqul.islam.422531', url: 'https://www.facebook.com/tariqul.islam.422531/' },
      { type: 'whatsapp', label: 'WhatsApp', sub: '+880 1755-489719', url: 'https://wa.me/8801755489719' },
      { type: 'github',   label: 'GitHub', sub: 'tariqulislam4015', url: 'https://github.com/tariqulislam4015' }
    ]
  };

  // Simple brand-coloured glyphs (no external files needed, works offline).
  const ICONS = {
    youtube: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="1.5" y="4.5" width="21" height="15" rx="4.5" fill="#FF0000"/><path d="M10 8.6v6.8l5.8-3.4z" fill="#fff"/></svg>',
    facebook: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#1877F2"/><path d="M13.3 19v-6h2l.3-2.4h-2.3V9.2c0-.7.2-1.2 1.2-1.2h1.2V5.9c-.2 0-1-.1-1.8-.1-1.8 0-3 1.1-3 3.1v1.7H9v2.4h2V19z" fill="#fff"/></svg>',
    whatsapp: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#25D366"/><path d="M12 5.6a6.3 6.3 0 0 0-5.4 9.6l-.8 2.9 3-.8A6.3 6.3 0 1 0 12 5.6z" fill="none" stroke="#fff" stroke-width="1.3"/><path d="M9.8 9c.2-.4.4-.4.6-.4h.4c.1 0 .3 0 .4.3l.5 1.2c0 .1.1.3 0 .4l-.3.4c-.1.1-.2.2-.1.4.4.7 1 1.3 1.8 1.7.2.1.3.1.4 0l.5-.6c.1-.1.2-.1.4-.1l1.2.6c.2.1.2.2.2.3 0 .4-.2 1-.6 1.2-.5.3-1.1.4-2.3-.1a7 7 0 0 1-3.2-3c-.5-.9-.4-1.6-.1-2z" fill="#fff"/></svg>',
    github: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#24292f"/><path d="M9.5 8.5 6 12l3.5 3.5M14.5 8.5 18 12l-3.5 3.5M13 7.5l-2 9" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  function linkRow(l, i) {
    return `<a class="pf-link pf-${l.type}" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer" style="--d:${0.55 + i * 0.12}s" aria-label="${esc(l.label)} — ${esc(l.url)}">
      <span class="pf-ico">${ICONS[l.type]}</span>
      <span class="pf-txt"><b>${esc(l.label)}</b><small>${esc(l.url.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</small></span>
      <span class="pf-go" aria-hidden="true">↗</span>
    </a>`;
  }

  // variant: 'card' (dashboard), 'full' (about page), 'mini' (sidebar)
  Views.profileCard = function (variant = 'card') {
    const P = PROFILE;
    if (variant === 'mini') {
      return `<a class="pf-mini" href="#/about" title="About the author">
        <img src="${P.photo}" alt="" width="36" height="36"><span><b>${esc(P.name)}</b><small>${esc(P.degree)}</small></span></a>`;
    }
    return `<section class="profile pf-${variant}" aria-label="About the author">
      <div class="pf-academy"><img src="${P.academyLogo}" alt="${esc(P.academy)} logo" width="44" height="44"><span><b>${esc(P.academy)}</b><small>${esc(P.tagline)}</small></span></div>
      <div class="pf-photo-wrap"><div class="pf-ring" aria-hidden="true"></div><img class="pf-photo" src="${P.photo}" alt="${esc(P.nameEn)}" width="200" height="200"></div>
      <h2 class="pf-name" lang="bn">${esc(P.name)}</h2>
      <div class="pf-degree"><span class="pf-line"></span><span class="pf-deg-txt">${esc(P.degree)}</span><span class="pf-line"></span></div>
      <div class="pf-links">${P.links.map(linkRow).join('')}</div>
    </section>`;
  };

  Views.about = function (host) {
    host.innerHTML = `
      <div class="about-wrap">
        ${Views.profileCard('full')}
        <section class="card about-app">
          <h2>About this app</h2>
          <p><b>TIS Academy — BCS Preparation &amp; MCQ Platform</b> lets you sit realistic, timed BCS preliminary exams, practise at your own pace, and see exactly which subjects and topics need more work.</p>
          <ul class="plain">
            <li>Exam Mode with a timer, question palette and negative marking</li>
            <li>Practice Mode: answers and explanations stay hidden until you ask</li>
            <li>Subject-wise and topic-wise analysis with recommendations</li>
            <li>Works offline and installs as an app on your phone or PC</li>
          </ul>
          <p class="muted small">Your results are saved only on this device. Use Settings → Export backup to keep a copy.</p>
          ${window.PWA && !PWA.isApp() ? `<div class="apk-card"><div><b>📱 Android app (APK)</b><span class="muted small">After downloading, open the file and allow “Install unknown apps” if your phone asks.</span></div>${PWA.apkButton()}</div>` : ''}
          <div class="actions left"><a class="btn btn-primary" href="#/">Start preparing</a><a class="btn" href="https://www.youtube.com/@tis.academy24" target="_blank" rel="noopener noreferrer">Watch lessons on YouTube ↗</a></div>
        </section>
      </div>`;
  };

  window.TIS_PROFILE = PROFILE;
})();
