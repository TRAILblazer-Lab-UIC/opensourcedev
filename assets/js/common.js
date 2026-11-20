/* Open Developer's Field Guide: shared helpers. My List storage, star buttons, list count, and iframe auto-height.
   No network calls except same-origin data files. All DOM text is set with textContent. */
(function () {
  'use strict';
  var KEY = 'osdfg-mylist-v1';
  var THEME_KEY = 'osdfg-theme';
  /* Light is the default. A saved choice of dark is applied as early as possible. */
  var themeNow = null;
  function savedTheme() {
    if (themeNow) return themeNow;
    try { themeNow = localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'; } catch (e) { themeNow = 'light'; }
    return themeNow;
  }
  function applyTheme(t) {
    if (t === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
    document.querySelectorAll('[data-theme-toggle]').forEach(function (b) {
      b.setAttribute('aria-pressed', t === 'dark' ? 'true' : 'false');
      b.textContent = t === 'dark' ? 'Light mode' : 'Dark mode';
    });
  }
  applyTheme(savedTheme());
  var SLUG = /^[a-z0-9][a-z0-9-]{0,80}$/;

  function read() {
    try {
      var raw = window.localStorage.getItem(KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.filter(function (s) { return typeof s === 'string' && SLUG.test(s); }) : [];
    } catch (e) { return memory.slice(); }
  }
  var memory = [];
  function write(arr) {
    memory = arr.slice();
    try { window.localStorage.setItem(KEY, JSON.stringify(arr)); } catch (e) { /* storage blocked: keep in memory */ }
    updateCount();
    document.dispatchEvent(new CustomEvent('fae:list-changed'));
  }
  function has(slug) { return read().indexOf(slug) !== -1; }
  function toggle(slug) {
    if (!SLUG.test(slug)) return false;
    var arr = read();
    var i = arr.indexOf(slug);
    if (i === -1) arr.push(slug); else arr.splice(i, 1);
    write(arr);
    return i === -1;
  }
  function updateCount() {
    var n = read().length;
    document.querySelectorAll('[data-list-count]').forEach(function (el) {
      el.textContent = n ? '(' + n + ')' : '';
    });
  }
  function syncStar(btn) {
    var on = has(btn.getAttribute('data-star'));
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    var lab = btn.querySelector('.star-label');
    var name = btn.getAttribute('data-name');
    if (lab) lab.textContent = on ? 'Saved to My List' : 'Add to My List';
    if (name) btn.setAttribute('aria-label', (on ? 'Remove ' : 'Save ') + name + (on ? ' from My List' : ' to My List'));
  }
  function wireStars(scope) {
    (scope || document).querySelectorAll('[data-star]').forEach(function (btn) {
      if (btn.dataset.wired) { syncStar(btn); return; }
      btn.dataset.wired = '1';
      syncStar(btn);
      btn.addEventListener('click', function () {
        toggle(btn.getAttribute('data-star'));
        syncStar(btn);
        announce(has(btn.getAttribute('data-star')) ? 'Saved to My List.' : 'Removed from My List.');
      });
    });
  }
  var live;
  function announce(msg) {
    if (!live) {
      live = document.createElement('div');
      live.className = 'visually-hidden';
      live.setAttribute('role', 'status');
      live.setAttribute('aria-live', 'polite');
      document.body.appendChild(live);
    }
    live.textContent = '';
    window.setTimeout(function () { live.textContent = msg; }, 50);
  }
  /* Embedded in WordPress: tell the parent page our height. Only a number is sent. */
  function postHeight() {
    if (window.parent === window) return;
    var h = Math.ceil(document.documentElement.scrollHeight);
    try { window.parent.postMessage({ type: 'fae-height', height: h }, '*'); } catch (e) { /* ignore */ }
  }
  window.FAE = { read: read, write: write, has: has, toggle: toggle, wireStars: wireStars, announce: announce, SLUG: SLUG, postHeight: postHeight };
  document.addEventListener('DOMContentLoaded', function () {
    if (window.parent !== window) document.documentElement.classList.add('embedded');
    applyTheme(savedTheme());
    document.querySelectorAll('[data-theme-toggle]').forEach(function (b) {
      b.addEventListener('click', function () {
        var next = savedTheme() === 'dark' ? 'light' : 'dark';
        themeNow = next;
        try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* keep for this page only */ }
        applyTheme(next);
      });
    });
    updateCount();
    wireStars(document);
    postHeight();
    if (window.ResizeObserver) new ResizeObserver(postHeight).observe(document.body);
  });
  document.addEventListener('fae:list-changed', function () { wireStars(document); });
})();
