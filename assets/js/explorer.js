/* OS Developer Field Guide: faceted search, idea tiles, category buttons, and the specimen of the day.
   Data: data/platforms.json (same origin). DOM text uses textContent only. State lives in the URL hash. */
(function () {
  'use strict';
  var FACET_ORDER = [
    ['cat', 'Kind of gadget'], ['open', 'How open is it?'], ['price', 'Price'], ['us', 'Easy to buy in the US'],
    ['code', 'Code you need to know'], ['cap', 'What it can do'], ['lang', 'Code languages'], ['ide', 'Tools to program it'],
    ['lift', 'Effort to get going'], ['os', 'What runs on it']
  ];
  var PAGE = 24;
  var data, labels, icons, recipes;
  var state = { q: '', beg: false, sort: 'match', f: {}, recipe: '', shown: PAGE };
  var els = {};

  function $(id) { return document.getElementById(id); }

  function svgIcon(name, cls) {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('class', cls || 'icon');
    var p = document.createElementNS(ns, 'path');
    p.setAttribute('d', icons[name] || icons.chip);
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', 'currentColor');
    p.setAttribute('stroke-width', '1.8');
    p.setAttribute('stroke-linecap', 'round');
    p.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(p);
    return svg;
  }

  /* ---------- URL state ---------- */
  function readHash() {
    var h = location.hash.replace(/^#/, '');
    if (!h || h === 'finder') return;
    h.split('&').forEach(function (part) {
      var kv = part.split('=');
      var k = decodeURIComponent(kv[0] || '');
      var v = decodeURIComponent(kv[1] || '');
      if (k === 'q') state.q = v.slice(0, 100);
      else if (k === 'beg') state.beg = v === '1';
      else if (k === 'sort' && /^(match|value|cap|price|new|az)$/.test(v)) state.sort = v;
      else if (k === 'idea' && Object.prototype.hasOwnProperty.call(recipes, v)) state.recipe = v;
      else if (k.indexOf('f.') === 0 && Object.prototype.hasOwnProperty.call(labels, k.slice(2))) {
        state.f[k.slice(2)] = v.split(',').filter(function (x) { return Object.prototype.hasOwnProperty.call(labels[k.slice(2)], x); });
      }
    });
  }
  function writeHash() {
    var parts = [];
    if (state.q) parts.push('q=' + encodeURIComponent(state.q));
    if (state.beg) parts.push('beg=1');
    if (state.sort !== 'match') parts.push('sort=' + state.sort);
    if (state.recipe) parts.push('idea=' + state.recipe);
    Object.keys(state.f).forEach(function (k) { if (state.f[k].length) parts.push('f.' + k + '=' + state.f[k].join(',')); });
    var h = parts.length ? '#' + parts.join('&') : '';
    try { history.replaceState(null, '', location.pathname + location.search + h); } catch (e) { /* ignore */ }
  }

  /* ---------- facets ---------- */
  function buildFacets() {
    var box = $('facets');
    var counts = {};
    data.forEach(function (it) {
      FACET_ORDER.forEach(function (fo) {
        var k = fo[0];
        counts[k] = counts[k] || {};
        (it[k] || []).forEach(function (v) { counts[k][v] = (counts[k][v] || 0) + 1; });
      });
    });
    FACET_ORDER.forEach(function (fo) {
      var k = fo[0];
      var det = document.createElement('details');
      det.className = 'facet';
      if (state.f[k] && state.f[k].length) det.open = true;
      var sum = document.createElement('summary');
      sum.textContent = fo[1];
      det.appendChild(sum);
      var fs = document.createElement('fieldset');
      var lg = document.createElement('legend');
      lg.className = 'visually-hidden';
      lg.textContent = fo[1];
      fs.appendChild(lg);
      Object.keys(labels[k]).forEach(function (v) {
        if (!counts[k][v]) return;
        var id = 'f-' + k + '-' + v;
        var row = document.createElement('div');
        row.className = 'check';
        var inp = document.createElement('input');
        inp.type = 'checkbox';
        inp.id = id;
        inp.value = v;
        inp.dataset.facet = k;
        inp.checked = !!(state.f[k] && state.f[k].indexOf(v) !== -1);
        var lab = document.createElement('label');
        lab.htmlFor = id;
        lab.textContent = labels[k][v] + ' ';
        var c = document.createElement('span');
        c.className = 'facet-count';
        c.dataset.count = k + ':' + v;
        lab.appendChild(c);
        row.appendChild(inp);
        row.appendChild(lab);
        fs.appendChild(row);
        inp.addEventListener('change', function () {
          var arr = state.f[k] || [];
          if (inp.checked) arr.push(v); else arr = arr.filter(function (x) { return x !== v; });
          state.f[k] = arr;
          state.shown = PAGE;
          render();
        });
      });
      det.appendChild(fs);
      box.appendChild(det);
    });
  }
  function setFacet(k, v, on) {
    var arr = state.f[k] || [];
    arr = on ? (arr.indexOf(v) === -1 ? arr.concat([v]) : arr) : arr.filter(function (x) { return x !== v; });
    state.f[k] = arr;
    var cb = $('f-' + k + '-' + v);
    if (cb) cb.checked = on;
  }

  /* ---------- matching ---------- */
  function norm(s) { return String(s || '').toLowerCase(); }
  function textMatch(it, words) {
    if (!words.length) return 1;
    var hay = norm(it.n + ' ' + it.t + ' ' + it.mk + ' ' + it.k);
    var score = 0;
    for (var i = 0; i < words.length; i++) {
      if (hay.indexOf(words[i]) === -1) return 0;
      score += norm(it.n).indexOf(words[i]) !== -1 ? 3 : 1;
    }
    return score;
  }
  function hasAll(it, needs) {
    for (var i = 0; i < needs.length; i++) if ((it.cap || []).indexOf(needs[i]) === -1) return false;
    return true;
  }
  function passes(it, skip) {
    if (state.beg && !it.beg) return false;
    if (state.recipe && !hasAll(it, recipes[state.recipe].needs)) return false;
    var keys = Object.keys(state.f);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (k === skip) continue;
      var want = state.f[k];
      if (!want || !want.length) continue;
      var have = it[k] || [];
      var ok = false;
      for (var j = 0; j < want.length; j++) if (have.indexOf(want[j]) !== -1) { ok = true; break; }
      if (!ok) return false;
    }
    return true;
  }

  /* ---------- render ---------- */
  function sorter(a, b) {
    var x = a.it, y = b.it;
    switch (state.sort) {
      case 'az': return x.n.localeCompare(y.n);
      case 'value': return (y.val || 0) - (x.val || 0) || (y.capv - x.capv);
      case 'cap': return y.capv - x.capv;
      case 'price': return (x.p || 1e9) - (y.p || 1e9);
      case 'new': return (y.yr || 0) - (x.yr || 0);
      default: return (b.tm - a.tm) || (y.pop - x.pop);
    }
  }
  function render() {
    writeHash();
    var words = norm(state.q).split(/\s+/).filter(Boolean);
    var list = [];
    data.forEach(function (it) {
      var tm = textMatch(it, words);
      if (!tm || !passes(it)) return;
      list.push({ it: it, tm: tm });
    });
    list.sort(sorter);
    updateCounts(words);
    var ul = els.cards;
    ul.textContent = '';
    var frag = document.createDocumentFragment();
    list.slice(0, state.shown).forEach(function (r) { frag.appendChild(card(r.it)); });
    ul.appendChild(frag);
    window.FAE.wireStars(ul);
    els.count.textContent = list.length === 1 ? '1 species found' : list.length + ' species found';
    els.more.hidden = list.length <= state.shown;
    var notes = [];
    if (state.recipe) notes.push('Showing gear that can build: ' + recipes[state.recipe].title + '.');
    if (state.beg) notes.push('Showing newcomer friendly gear.');
    els.note.hidden = !notes.length;
    els.note.textContent = notes.join(' ');
    els.beg.setAttribute('aria-pressed', state.beg ? 'true' : 'false');
    document.querySelectorAll('[data-cat-btn]').forEach(function (b) {
      b.setAttribute('aria-pressed', (state.f.cat || []).indexOf(b.getAttribute('data-cat-btn')) !== -1 ? 'true' : 'false');
    });
    document.querySelectorAll('[data-idea]').forEach(function (b) {
      b.setAttribute('aria-pressed', state.recipe === b.getAttribute('data-idea') ? 'true' : 'false');
    });
    var mf = document.querySelector('#more-filters > summary');
    if (mf) { var n = activeFilterCount(); mf.textContent = n ? 'More filters (' + n + ' on)' : 'More filters'; }
    window.FAE.postHeight();
  }
  function updateCounts(words) {
    FACET_ORDER.forEach(function (fo) {
      var k = fo[0], c = {};
      data.forEach(function (it) {
        if (!textMatch(it, words) || !passes(it, k)) return;
        (it[k] || []).forEach(function (v) { c[v] = (c[v] || 0) + 1; });
      });
      document.querySelectorAll('[data-count^="' + k + ':"]').forEach(function (el) {
        var v = el.dataset.count.split(':')[1];
        el.textContent = '(' + (c[v] || 0) + ')';
      });
    });
  }
  function tag(iconName, text, cls, title) {
    var li = document.createElement('li');
    li.className = 'tag ' + (cls || '');
    if (iconName) li.appendChild(svgIcon(iconName, 'tag-icon'));
    var sp = document.createElement('span');
    sp.textContent = text;
    li.appendChild(sp);
    if (title) li.title = title;
    return li;
  }
  function meter(label, v, max, cls) {
    var wrap = document.createElement('div');
    wrap.className = 'mini-meter ' + (cls || '');
    var l = document.createElement('span');
    l.className = 'mm-label';
    l.textContent = label;
    var bar = document.createElement('span');
    bar.className = 'mm-bar';
    var fill = document.createElement('span');
    fill.className = 'mm-fill mm-w' + Math.round(10 * Math.max(0, Math.min(v || 0, max)) / max);
    bar.appendChild(fill);
    var n = document.createElement('span');
    n.className = 'mm-num';
    n.textContent = v ? (max === 5 ? v + ' of 5' : String(v)) : 'n/a';
    wrap.appendChild(l); wrap.appendChild(bar); wrap.appendChild(n);
    return wrap;
  }
  function money(p) { return '$' + (p < 100 ? p.toFixed(2).replace(/\.00$/, '') : Math.round(p)); }
  function card(it) {
    var node = els.tpl.content.firstElementChild.cloneNode(true);
    var a = node.querySelector('.card-title a');
    a.textContent = it.n;
    a.href = 'platforms/' + it.s + '.html';
    node.querySelector('.card-maker').textContent = it.mk;
    node.querySelector('.card-tagline').textContent = it.t;
    var tags = node.querySelector('.card-tags');
    (it.open || []).forEach(function (o) { tags.appendChild(tag('open-' + o, labels.open[o], 'tag-open open-' + o)); });
    (it.cat || []).forEach(function (c) { tags.appendChild(tag('cat-' + c, labels.cat[c], 'tag-plain')); });
    if (it.p) tags.appendChild(tag(null, 'From ' + money(it.p), 'tag-price'));
    (it.us || []).forEach(function (u) { if (u !== 'unknown') tags.appendChild(tag('flag', labels.us[u], 'tag-us us-' + u)); });
    if (it.beg) tags.appendChild(tag('sparkle', 'Newcomer friendly', 'tag-beginner'));
    var m = node.querySelector('.card-meters');
    m.appendChild(meter('Capacity', it.capv, 100, 'mm-cap'));
    m.appendChild(meter('Value', it.val, 5, 'mm-val'));
    var star = node.querySelector('.star-btn');
    star.setAttribute('data-star', it.s);
    star.setAttribute('data-name', it.n);
    star.insertBefore(svgIcon('star', 'star-icon'), star.firstChild);
    return node;
  }
  function activeFilterCount() {
    var n = 0;
    Object.keys(state.f).forEach(function (k) { if (k !== 'cat') n += (state.f[k] || []).length; });
    return n;
  }

  /* ---------- specimen of the day ---------- */
  function specimen() {
    var box = $('specimen');
    if (!box || !data.length) return;
    var day = Math.floor(Date.now() / 86400000);
    var it = data[day % data.length];
    var c = card(it);
    c.classList.add('specimen-card');
    if (it.fm) {
      var fm = document.createElement('p');
      fm.className = 'field-marks';
      fm.textContent = 'Field marks: ' + it.fm;
      c.querySelector('.card-body').appendChild(fm);
    }
    box.appendChild(c);
    window.FAE.wireStars(box);
  }

  /* ---------- wiring ---------- */
  function goToResults() {
    var b = $('finder');
    if (b) b.scrollIntoView({ block: 'start' });
    var h = $('result-count');
    if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  }
  function wire() {
    var t;
    els.q.value = state.q;
    els.q.addEventListener('input', function () {
      window.clearTimeout(t);
      t = window.setTimeout(function () { state.q = els.q.value.trim().slice(0, 100); state.shown = PAGE; render(); }, 200);
    });
    els.beg.addEventListener('click', function () { state.beg = !state.beg; state.shown = PAGE; render(); });
    var so = $('sort');
    so.value = state.sort;
    so.addEventListener('change', function () { state.sort = so.value; render(); });
    els.more.addEventListener('click', function () {
      var first = state.shown;
      state.shown += PAGE;
      render();
      var next = els.cards.children[first];
      if (next) { var link = next.querySelector('a'); if (link) link.focus(); }
    });
    document.querySelectorAll('[data-cat-btn]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.preventDefault();
        var v = b.getAttribute('data-cat-btn');
        var on = (state.f.cat || []).indexOf(v) === -1;
        if (b.classList.contains('cat-tile')) { state.f.cat = []; document.querySelectorAll('#facets input[data-facet="cat"]').forEach(function (i) { i.checked = false; }); on = true; }
        setFacet('cat', v, on);
        state.shown = PAGE;
        render();
        if (b.classList.contains('cat-tile')) goToResults();
      });
    });
    document.querySelectorAll('[data-idea]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.preventDefault();
        var v = b.getAttribute('data-idea');
        state.recipe = state.recipe === v ? '' : v;
        state.shown = PAGE;
        render();
        if (state.recipe) goToResults();
      });
    });
    $('clear-filters').addEventListener('click', function () {
      state.f = {}; state.q = ''; state.beg = false; state.recipe = '';
      els.q.value = '';
      document.querySelectorAll('#facets input').forEach(function (i) { i.checked = false; });
      state.shown = PAGE;
      render();
      window.FAE.announce('All filters cleared.');
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    els = { cards: $('cards'), count: $('result-count'), more: $('more'), note: $('filter-note'), beg: $('beginner-toggle'), q: $('q'), tpl: $('card-tpl') };
    fetch('data/platforms.json?v=' + encodeURIComponent(document.documentElement.getAttribute('data-v') || ''), { credentials: 'same-origin' })
      .then(function (r) { if (!r.ok) throw new Error('load'); return r.json(); })
      .then(function (j) {
        data = j.items; labels = j.labels; icons = j.icons || {}; recipes = j.recipes || {};
        readHash();
        buildFacets();
        wire();
        specimen();
        render();
      })
      .catch(function () { els.count.textContent = 'The field guide could not load. Please refresh the page.'; });
  });
})();
