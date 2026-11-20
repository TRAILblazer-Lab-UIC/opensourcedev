/* My List page: renders saved platforms as a build plan with print, Markdown, CSV, and share-link export.
   Reads same-origin data/items/<slug>.json. Shared lists arrive in the URL hash (#list=a,b,c) and are never saved without a click. */
(function () {
  'use strict';
  var items = [];
  var shared = null;
  function $(id) { return document.getElementById(id); }
  function status(msg) { $('list-status').textContent = msg; }

  function sharedFromHash() {
    var m = location.hash.match(/^#list=(.{1,8000})$/);
    if (!m) return null;
    var raw;
    try { raw = decodeURIComponent(m[1]); } catch (e) { raw = m[1]; }
    var out = raw.split(',').filter(function (s) { return window.FAE.SLUG.test(s); }).slice(0, 200);
    return out.length ? out : null;
  }
  function load(slugs) {
    return Promise.all(slugs.map(function (s) {
      return fetch('data/items/' + s + '.json', { credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; });
    })).then(function (arr) { return arr.filter(Boolean); });
  }
  function render() {
    var ol = $('list-items');
    ol.textContent = '';
    $('list-empty').hidden = items.length > 0;
    var tpl = $('plan-tpl');
    items.forEach(function (it) {
      var li = tpl.content.firstElementChild.cloneNode(true);
      var a = li.querySelector('.plan-title a');
      a.textContent = it.n;
      a.href = 'platforms/' + it.s + '.html';
      li.querySelector('.plan-tagline').textContent = it.t || '';
      li.querySelector('.plan-meta').textContent = it.meta || '';
      var ul = li.querySelector('.plan-steps');
      (it.steps || []).forEach(function (st, i) {
        var row = document.createElement('li');
        var box = document.createElement('input');
        box.type = 'checkbox';
        box.id = 'p-' + it.s + '-' + i;
        var lab = document.createElement('label');
        lab.htmlFor = box.id;
        lab.textContent = ' ' + st.replace(/\*\*/g, '');
        row.appendChild(box);
        row.appendChild(lab);
        ul.appendChild(row);
      });
      if (!(it.steps || []).length) {
        var none = document.createElement('li');
        none.textContent = 'Open the tool page for setup details.';
        ul.appendChild(none);
      }
      if (it.url) li.querySelector('.plan-url').textContent = 'Website: ' + it.url;
      var rm = li.querySelector('.remove-btn');
      rm.setAttribute('aria-label', 'Remove ' + it.n + ' from My List');
      if (shared) rm.hidden = true;
      rm.addEventListener('click', function () {
        window.FAE.toggle(it.s);
        items = items.filter(function (x) { return x.s !== it.s; });
        render();
        status(it.n + ' removed.');
        var first = document.querySelector('.plan-title a');
        (first || $('print-list')).focus();
      });
      ol.appendChild(li);
    });
    window.FAE.postHeight();
  }
  function download(name, mime, text) {
    var blob = new Blob([text], { type: mime + ';charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function base() { return location.href.replace(/mylist\.html.*$/, ''); }
  function toMarkdown() {
    var out = ['# My OS Developer Field Guide list', ''];
    items.forEach(function (it) {
      out.push('## ' + it.n, '', it.t || '', '', it.meta || '', '');
      (it.steps || []).forEach(function (s) { out.push('- [ ] ' + s); });
      out.push('', 'Field guide page: ' + base() + 'platforms/' + it.s + '.html');
      if (it.url) out.push('Website: ' + it.url);
      out.push('');
    });
    return out.join('\n');
  }
  function csvCell(v) {
    var s = String(v == null ? '' : v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; /* block spreadsheet formula injection */
    return '"' + s.replace(/"/g, '""') + '"';
  }
  function toCSV() {
    var rows = [['Name', 'Summary', 'Price and openness', 'Field guide page', 'Website', 'Getting started']];
    items.forEach(function (it) {
      rows.push([it.n, it.t, it.meta || '', base() + 'platforms/' + it.s + '.html', it.url || '', (it.steps || []).join(' | ')]);
    });
    return rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n');
  }
  window.addEventListener('hashchange', function () { location.reload(); });
  document.addEventListener('DOMContentLoaded', function () {
    shared = sharedFromHash();
    var slugs = shared || window.FAE.read();
    if (shared) $('shared-banner').hidden = false;
    load(slugs).then(function (arr) { items = arr; render(); });
    $('print-list').addEventListener('click', function () { window.print(); });
    $('dl-md').addEventListener('click', function () {
      if (!items.length) return status('Your list is empty.');
      download('my-homegrown-ai-list.md', 'text/markdown', toMarkdown());
      status('Markdown file downloaded.');
    });
    $('dl-csv').addEventListener('click', function () {
      if (!items.length) return status('Your list is empty.');
      download('my-homegrown-ai-list.csv', 'text/csv', '﻿' + toCSV());
      status('Spreadsheet file downloaded.');
    });
    $('copy-link').addEventListener('click', function () {
      if (!items.length) return status('Your list is empty.');
      var link = base() + 'mylist.html#list=' + items.map(function (i) { return i.s; }).join(',');
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(link).then(function () { status('Share link copied.'); }, function () { status('Copy this link: ' + link); });
      } else { status('Copy this link: ' + link); }
    });
    $('clear-list').addEventListener('click', function () {
      if (shared) { location.hash = ''; location.reload(); return; }
      window.FAE.write([]);
      items = [];
      render();
      status('Your list is cleared.');
    });
    $('keep-shared').addEventListener('click', function () {
      var mine = window.FAE.read();
      items.forEach(function (it) { if (mine.indexOf(it.s) === -1) mine.push(it.s); });
      window.FAE.write(mine);
      shared = null;
      $('shared-banner').hidden = true;
      try { history.replaceState(null, '', location.pathname); } catch (e) { /* ignore */ }
      render();
      status('Saved to your list.');
    });
  });
})();
