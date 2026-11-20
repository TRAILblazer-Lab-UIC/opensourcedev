/* Tool page: remember checklist ticks per tool in this browser only. */
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    var slug = (location.pathname.split('/').pop() || '').replace(/\.html$/, '');
    if (!window.FAE || !window.FAE.SLUG.test(slug)) return;
    var key = 'fae-check-' + slug;
    var saved = {};
    try { saved = JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch (e) { saved = {}; }
    document.querySelectorAll('.checklist input[type=checkbox]').forEach(function (box) {
      box.checked = !!saved[box.id];
      box.addEventListener('change', function () {
        saved[box.id] = box.checked;
        try { localStorage.setItem(key, JSON.stringify(saved)); } catch (e) { /* ignore */ }
      });
    });
  });
})();
