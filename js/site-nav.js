/*
  Site top bar: one shared component for every page.

  Usage: put this tag where the bar should appear (right after <body>):
    <script src="js/site-nav.js"></script>
  Optional attributes:
    data-active="tech-school.html"   highlight this link (defaults to the current page's file name)
    data-base="../"                  prefix for links when the page lives in a sub-folder
    data-position="fixed"            on desktop, pin the bar over the page instead of taking up space
    data-position="fixed-all"        pin the bar at every screen width
    data-account="off"               no Sign up button or account badge (page has its own sign-in)

  The bar's HTML and CSS live here, so editing this file updates the bar everywhere.
  Styling copies career-consultation.html and is scoped to #nav.kz-nav so each page's
  older .nav rules cannot change it.
*/
(function () {
  var script = document.currentScript;
  var base = (script && script.getAttribute('data-base')) || '';
  var current = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  var active = ((script && script.getAttribute('data-active')) || current).toLowerCase();
  var position = (script && script.getAttribute('data-position')) || '';
  var fixed = position === 'fixed';
  var fixedAll = position === 'fixed-all';
  // data-account="off": leave out Sign up and the account badge (pages with their own sign-in)
  var account = !(script && script.getAttribute('data-account') === 'off');

  var LINKS = [
    { href: 'career-consultation.html', label: 'Consulting' },
    { href: 'finishing-school.html', label: 'Finishing School' },
    { href: 'tech-school.html', label: 'Tech School' },
    { href: 'b-school.html', label: 'B-School' },
    { href: 'placements.html', label: 'Placements' },
    { href: 'jobs.html', label: 'Jobs' },
    { href: 'internships.html', label: 'Internships' },
    { href: 'Resume/', label: 'Resume Builder', resume: true },
    { href: 'our-story.html', label: 'Our Story' }
  ];

  var S = '#nav.kz-nav';
  // G: rules for narrow desktop windows, used only when the page is not scaled by the head 'Desktop fit' script
  // (a scaled page already has the full 1920px design width, so the bar keeps its normal spacing).
  var G = ':where(html:not(.kz-fit)) ' + S;
  var CSS = [
    S + ',' + S + ' *{box-sizing:border-box;margin:0;padding:0}',
    /* Transparent frosted-glass bar: the page shows through, blurred so the links stay readable */
    S + '{position:sticky;top:0;z-index:1000;width:100%;background:rgba(255,255,255,.55);',
    '-webkit-backdrop-filter:saturate(160%) blur(16px);backdrop-filter:saturate(160%) blur(16px);',
    'border-bottom:1px solid rgba(10,21,48,.06);font-family:"Inter",ui-sans-serif,system-ui,sans-serif;',
    'line-height:1.45;transform:none;translate:none;transition:background .3s ease,border-color .3s ease}',
    /* Over a dark section the glass tints dark and the text turns white */
    S + '.kz-notrans,' + S + '.kz-notrans *{transition:none!important}',
    S + '.kz-dark{background:rgba(6,10,24,.35);border-bottom-color:rgba(255,255,255,.08)}',
    S + '.kz-dark .kz-links a{color:rgba(255,255,255,.82)}',
    S + '.kz-dark .kz-links a:hover,' + S + '.kz-dark .kz-links a.active{color:#7FA6FF}',
    S + '.kz-dark .kz-cta{background:#fff;color:#02050E}',
    S + '.kz-dark .kz-cta:hover{background:#1947FF;color:#fff}',
    S + '.kz-dark .kz-brand img{filter:brightness(0) invert(1)}',
    S + '.kz-dark .kz-burger span{background:#fff}',
    S + ' .kz-inner{max-width:100%;margin:0 auto;padding:0 40px;height:64px;display:flex;align-items:center;justify-content:space-between;gap:32px}',
    S + ' .kz-left,' + S + ' .kz-right{display:flex;align-items:center;flex:1}',
    S + ' .kz-left{justify-content:flex-start;min-width:max-content}',
    S + ' .kz-right{justify-content:flex-end;gap:0}',
    S + ' .kz-brand{display:flex;align-items:center;text-decoration:none}',
    S + ' .kz-brand img{height:36px;width:auto;display:block}',
    S + ' .kz-links{display:flex;align-items:center;justify-content:center;gap:32px}',
    S + ' .kz-links a{font-size:14px;font-weight:500;color:#474F66;text-decoration:none;transition:color .2s;white-space:nowrap;background:none;border:0}',
    S + ' .kz-links a:hover,' + S + ' .kz-links a.active{color:#1947FF;font-weight:700}',
    S + ' .kz-menu-head,' + S + ' .kz-arrow{display:none}',
    S + ' .kz-cta{display:inline-flex;align-items:center;gap:8px;background:#02050E;color:#fff;font-size:14px;font-weight:600;',
    'padding:10px 20px;border-radius:99px;text-decoration:none;transition:background .2s,transform .2s;white-space:nowrap;border:0;box-shadow:none}',
    S + ' .kz-cta:hover{background:#1947FF;color:#fff;transform:translateY(-1px)}',
    /* Sign up button (hidden once signed in: the account badge takes its place) */
    S + ' .kz-login{display:inline-flex;align-items:center;gap:7px;margin-right:10px;padding:9px 16px;border-radius:99px;',
    'border:1px solid rgba(10,21,48,.16);background:transparent;color:#02050E;font:inherit;font-size:14px;font-weight:600;',
    'text-decoration:none;white-space:nowrap;cursor:pointer;transition:border-color .2s,color .2s,background .2s}',
    S + ' .kz-login:hover{border-color:#1947FF;color:#1947FF;background:rgba(25,71,255,.05)}',
    S + ' .kz-login svg{flex-shrink:0}',
    S + ' .kz-right:has(#nav-user-badge[style*="block"]) .kz-login,' + S + '.kz-signed-in .kz-login{display:none}',
    S + '.kz-dark .kz-login{color:#fff;border-color:rgba(255,255,255,.35)}',
    S + '.kz-dark .kz-login:hover{color:#fff;border-color:#fff;background:rgba(255,255,255,.08)}',
    S + ' .kz-burger{display:none;flex-direction:column;gap:5px;background:transparent;border:none;cursor:pointer;padding:8px;margin-left:10px;z-index:1002}',
    S + ' .kz-burger span{display:block;width:22px;height:2px;border-radius:2px;background:#02050E;transition:all .25s ease}',
    S + ' .kz-burger.active span:nth-child(1){transform:translateY(7px) rotate(45deg)}',
    S + ' .kz-burger.active span:nth-child(2){opacity:0}',
    S + ' .kz-burger.active span:nth-child(3){transform:translateY(-7px) rotate(-45deg)}',
    S + ' a:focus-visible,' + S + ' button:focus-visible{outline:2px solid #1947FF;outline-offset:3px}',

    /* Signed-in candidate badge (shown by js/auth-modal.js) */
    S + ' .nav-user-badge{position:relative;margin-left:12px}',
    S + ' .nav-user-btn{display:inline-flex;align-items:center;justify-content:center;background:transparent;border:2px solid transparent;padding:2px;border-radius:50%;cursor:pointer;transition:all .2s ease}',
    S + ' .nav-user-btn:hover{border-color:rgba(96,165,250,.5);transform:scale(1.05)}',
    S + ' .nav-user-avatar{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#2563EB,#7C3AED);color:#fff;font-size:14px;font-weight:800;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(37,99,235,.4)}',
    S + ' .nav-user-name,' + S + ' .nav-user-chevron{display:none!important}',
    S + ' .nav-user-menu{position:absolute;top:calc(100% + 10px);right:0;min-width:230px;background:#0E121D;border:1px solid rgba(255,255,255,.14);border-radius:14px;padding:8px;box-shadow:0 16px 40px rgba(0,0,0,.6);display:none;z-index:300;text-align:left}',
    S + ' .nav-user-badge.open .nav-user-menu{display:block}',
    S + ' .nav-user-menu-header{padding:10px 12px 8px}',
    S + ' .nav-user-menu-header strong{display:block;font-size:14px;color:#fff;font-weight:700}',
    S + ' .nav-user-menu-header span{display:block;font-size:12px;color:#94A3B8;margin-top:2px;word-break:break-all}',
    S + ' .nav-user-menu-divider{height:1px;background:rgba(255,255,255,.08);margin:6px 0}',
    S + ' .nav-user-menu-item{display:flex;align-items:center;gap:10px;width:100%;padding:9px 12px;border-radius:8px;border:none;background:none;color:#E2E8F0;font-size:13px;font-weight:600;text-decoration:none;font-family:inherit;cursor:pointer}',
    S + ' .nav-user-menu-item:hover{background:rgba(255,255,255,.08);color:#fff}',
    S + ' .nav-user-menu-item.logout{color:#F87171}',

    /* data-position="fixed": pages whose desktop hero already leaves room for an overlaid bar */
    '@media (min-width:981px){' + S + '.kz-fixed{position:fixed;top:0;left:0;right:0}}',
    S + '.kz-fixed-all{position:fixed;top:0;left:0;right:0}',

    /* Narrower desktops: nine links, so tighten spacing before the mobile menu kicks in */
    '@media (min-width:981px) and (max-width:1280px){' + G + ' .kz-links{gap:16px}' + G + ' .kz-links a{font-size:13px}}',
    /* Common laptops (1366px): with Sign up and Talk to us side by side the bar ran past the edge */
    '@media (min-width:1181px) and (max-width:1440px){' + G + ' .kz-inner{padding:0 24px;gap:20px}' + G + ' .kz-left,' + G + ' .kz-right{flex:0 0 auto}' + G + ' .kz-links{flex:1 1 auto;min-width:0;gap:18px}}',
    '@media (min-width:1181px) and (max-width:1300px){' + G + ' .kz-links{gap:13px}' + G + ' .kz-login{padding:8px 12px;margin-right:8px}' + G + ' .kz-cta{padding:9px 16px}}',
    '@media (min-width:981px) and (max-width:1180px){' + G + ' .kz-inner{padding:0 20px;gap:14px}' + G + ' .kz-links{gap:11px}' + G + ' .kz-links a{font-size:12.5px}' + G + ' .kz-brand img{height:30px}' + G + ' .kz-cta{padding:8px 14px;font-size:13px}' +
      /* Small laptops and landscape tablets (1024px): the side groups shrink to their content so the links fit */
      G + ' .kz-left,' + G + ' .kz-right{flex:0 0 auto}' + G + ' .kz-links{flex:1 1 auto;min-width:0}' +
      G + ' .kz-login span{display:none}' + G + ' .kz-login{padding:7px 9px;margin-right:8px}}',

    /* Mobile: hamburger + dropdown panel */
    '@media (max-width:980px){',
    /* The dropdown panel stays solid white, so its links use the light-theme colours */
    S + '.kz-dark .kz-links a{color:#02050E}',
    S + '.kz-dark .kz-links a:hover,' + S + '.kz-dark .kz-links a.active{color:#1947FF}',
    S + ' .kz-inner{position:relative;padding:0 16px;height:64px}',
    S + ' .kz-brand img{height:32px}',
    S + ' .kz-cta{padding:8px 14px;font-size:13px}',
    S + ' .kz-login{padding:7px 12px;font-size:13px;margin-right:8px}',
    S + ' .kz-burger{display:flex}',
    S + ' .kz-links{display:flex;flex-direction:column;align-items:stretch;justify-content:flex-start;position:absolute;top:64px;left:0;right:0;width:100%;',
    'background:#fff;padding:12px 16px 20px;gap:3px;border-bottom:2px solid rgba(25,71,255,.15);',
    'box-shadow:0 20px 40px -4px rgba(15,23,42,.18),0 0 0 1px rgba(15,23,42,.05);max-height:calc(100vh - 72px);max-height:calc(100dvh - 72px);',
    'overflow-y:auto;-webkit-overflow-scrolling:touch;z-index:99999;opacity:0;visibility:hidden;transform:translateY(-8px);pointer-events:none;',
    'transition:opacity .22s cubic-bezier(.16,1,.3,1),transform .22s cubic-bezier(.16,1,.3,1),visibility .22s ease}',
    S + ' .kz-links.mobile-active{opacity:1;visibility:visible;transform:translateY(0);pointer-events:auto}',
    S + ' .kz-menu-head{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:800;letter-spacing:.1em;color:#1947FF;text-transform:uppercase;padding:6px 12px 10px;margin-bottom:4px;border-bottom:1px solid rgba(15,23,42,.08)}',
    S + ' .kz-menu-head::before{content:"";display:inline-block;width:6px;height:6px;border-radius:50%;background:#1947FF;box-shadow:0 0 8px #1947FF}',
    S + ' .kz-links a{display:flex;align-items:center;justify-content:space-between;padding:11px 14px;font-size:15px;font-weight:600;color:#02050E;border-radius:10px;transition:all .15s ease}',
    S + ' .kz-links a:hover,' + S + ' .kz-links a:active{background:#f8fafc;color:#1947FF}',
    S + ' .kz-links a.active{background:rgba(25,71,255,.08);color:#1947FF;font-weight:700}',
    S + ' .kz-arrow{display:inline-block;font-size:13px;color:#94a3b8;transition:transform .15s ease}',
    S + ' .kz-links a:hover .kz-arrow,' + S + ' .kz-links a.active .kz-arrow{color:#1947FF;transform:translateX(3px)}',
    '}',
    /* Small phones: icon-only Sign up button so the bar still fits */
    '@media (max-width:420px){' + S + ' .kz-login span{display:none}' + S + ' .kz-login{padding:7px 9px}}',
    /* 360px Android phones: trim side padding so logo, buttons and menu never push the page sideways */
    /* Phones: no "Talk to us" button in the bar, just the logo, Sign up and the menu */
    '@media (max-width:768px){' + S + ' .kz-cta{display:none}}',
    '@media (max-width:380px){' + S + ' .kz-inner{padding:0 12px;gap:10px}' + S + ' .kz-brand img{height:28px}' + S + ' .kz-login{margin-right:6px}' + S + ' .kz-burger{margin-left:4px}}'
  ].join('');

  if (!document.getElementById('kz-nav-style')) {
    var style = document.createElement('style');
    style.id = 'kz-nav-style';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  // Inter is the bar's font; load it on pages that don't already
  if (!document.querySelector('link[href*="family=Inter"]')) {
    var font = document.createElement('link');
    font.rel = 'stylesheet';
    font.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
    document.head.appendChild(font);
  }

  var linksHtml = LINKS.map(function (l) {
    var isActive = l.href.toLowerCase() === active;
    var attrs = 'href="' + base + l.href + '"' + (isActive ? ' class="active" aria-current="page"' : '');
    if (l.resume) attrs += ' data-resume-builder';
    return '<a ' + attrs + '><span>' + l.label + '</span><span class="kz-arrow" aria-hidden="true">' + (l.resume ? '↗' : '→') + '</span></a>';
  }).join('');

  var html =
    '<nav class="kz-nav kz-notrans' + (fixed ? ' kz-fixed' : '') + (fixedAll ? ' kz-fixed-all' : '') + '" id="nav" aria-label="Main">' +
      '<div class="kz-inner">' +
        '<div class="kz-left">' +
          '<a href="' + base + 'index.html" class="kz-brand"><img src="' + base + 'kompetenzen logo-02.webp" alt="Kompetenzen" width="150" height="36" /></a>' +
        '</div>' +
        '<div class="kz-links" id="kz-nav-links">' +
          '<div class="kz-menu-head">Our Services &amp; Programs</div>' +
          linksHtml +
        '</div>' +
        '<div class="kz-right">' +
          (account ?
          '<a href="' + base + 'index.html#signup" class="kz-login" id="kz-login" aria-label="Sign up">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' +
            '<span>Sign up</span>' +
          '</a>' : '') +
          '<a href="https://wa.me/918590886009" target="_blank" rel="noopener" class="kz-cta">Talk to us</a>' +
          (account ?
          '<div id="nav-user-badge" class="nav-user-badge" style="display:none;">' +
            '<button type="button" class="nav-user-btn" id="nav-user-toggle-btn" aria-label="Candidate account menu">' +
              '<div class="nav-user-avatar" id="nav-user-avatar">C</div>' +
              '<span class="nav-user-name" id="nav-user-name">Candidate</span>' +
            '</button>' +
            '<div class="nav-user-menu" id="nav-user-menu">' +
              '<div class="nav-user-menu-header"><strong id="nav-user-menu-name">Candidate</strong><span id="nav-user-menu-email"></span></div>' +
              '<div class="nav-user-menu-divider"></div>' +
              '<a href="' + base + 'create-profile.html" class="nav-user-menu-item" id="nav-user-profile-link"><span>My Candidate Profile</span></a>' +
              '<button type="button" class="nav-user-menu-item logout" id="nav-user-signout"><span>Sign Out / Switch</span></button>' +
            '</div>' +
          '</div>' : '') +
          '<button class="kz-burger" id="kz-hamburger" type="button" aria-label="Menu" aria-expanded="false" aria-controls="kz-nav-links">' +
            '<span></span><span></span><span></span>' +
          '</button>' +
        '</div>' +
      '</div>' +
    '</nav>';

  if (script && script.parentNode) {
    script.insertAdjacentHTML('beforebegin', html);
  } else {
    document.body.insertAdjacentHTML('afterbegin', html);
  }

  var nav = document.getElementById('nav');
  var burger = document.getElementById('kz-hamburger');
  var links = document.getElementById('kz-nav-links');

  function closeMenu() {
    burger.classList.remove('active');
    links.classList.remove('mobile-active');
    burger.setAttribute('aria-expanded', 'false');
  }

  burger.addEventListener('click', function (e) {
    e.stopPropagation();
    var open = !links.classList.contains('mobile-active');
    burger.classList.toggle('active', open);
    links.classList.toggle('mobile-active', open);
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  links.addEventListener('click', function (e) {
    if (e.target.closest('a')) closeMenu();
  });

  document.addEventListener('click', function (e) {
    if (!nav.contains(e.target)) closeMenu();
    var badge = nav.querySelector('#nav-user-badge');
    if (badge && !badge.contains(e.target)) badge.classList.remove('open');
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeMenu();
  });

  // Light/dark text: look at what is directly behind the bar and switch when it is dark
  function parseColor(str) {
    var m = str && str.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?/);
    if (!m) return null;
    var a = m[4] === undefined ? 1 : parseFloat(m[4]);
    return a < 0.5 ? null : [+m[1], +m[2], +m[3]];
  }
  function bgBehind(x, y) {
    var stack = document.elementsFromPoint ? document.elementsFromPoint(x, y) : [];
    for (var i = 0; i < stack.length; i++) {
      var el = stack[i];
      if (nav.contains(el)) continue;
      var cs = getComputedStyle(el);
      var c = parseColor(cs.backgroundColor);
      if (!c && cs.backgroundImage && cs.backgroundImage !== 'none') {
        var hex = cs.backgroundImage.match(/rgba?\([^)]+\)/);
        c = hex && parseColor(hex[0]);
      }
      if (c) return c;
    }
    return parseColor(getComputedStyle(document.body).backgroundColor) || [255, 255, 255];
  }
  var ticking = false;
  function updateTone() {
    ticking = false;
    var y = nav.offsetHeight / 2;
    var w = window.innerWidth;
    var samples = [w * 0.2, w * 0.5, w * 0.8].map(function (x) { return bgBehind(x, y); });
    var lum = samples.reduce(function (sum, c) {
      return sum + (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]);
    }, 0) / samples.length;
    nav.classList.toggle('kz-dark', lum < 110);
  }
  function requestTone() {
    if (!ticking) { ticking = true; requestAnimationFrame(updateTone); }
  }
  window.addEventListener('scroll', requestTone, { passive: true });
  window.addEventListener('resize', requestTone);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', requestTone);
  } else {
    requestTone();
  }
  // Settle the tone without animating on first paint, then allow smooth fades while scrolling
  function settle() {
    updateTone();
    setTimeout(function () { nav.classList.remove('kz-notrans'); }, 60);
  }
  if (document.readyState === 'complete') settle();
  else window.addEventListener('load', settle);

  // Sign up: open the popup from js/auth-modal.js on its Sign Up form when the page has it,
  // otherwise go to the home page, which opens it from the #signup link
  if (!account) return;

  nav.querySelector('#kz-login').addEventListener('click', function (e) {
    if (typeof window.openAuthModal === 'function') {
      e.preventDefault();
      closeMenu();
      window.openAuthModal('signup');
    }
  });

  // Hide Sign up straight away for signed-in visitors (same storage keys as auth-modal.js),
  // before auth-modal.js has shown the account badge
  try {
    var stored = localStorage.getItem('kompetenzen_user') || localStorage.getItem('kompetenzen_google_user') || localStorage.getItem('user');
    var u = stored && JSON.parse(stored);
    if (u && (u.email || u.name)) nav.classList.add('kz-signed-in');
  } catch (err) {}

  // Account badge buttons: use the page / auth-modal handlers when present
  nav.querySelector('#nav-user-toggle-btn').addEventListener('click', function (e) {
    if (typeof window.toggleNavUserDropdown === 'function') return window.toggleNavUserDropdown(e);
    e.stopPropagation();
    nav.querySelector('#nav-user-badge').classList.toggle('open');
  });
  nav.querySelector('#nav-user-signout').addEventListener('click', function (e) {
    if (typeof window.handleSignOut === 'function') window.handleSignOut(e);
  });
})();
