/* We Met landing page behaviour. Plain JS, no dependencies.
   1. Icons: inline icons/<name>.svg into every [data-icon] (so currentColor works).
   2. Theme: prefers-color-scheme by default; the footer switch writes data-theme and localStorage "card-theme"
      (the same key the public card uses, so the choice carries over).
   3. How it works (860px and up): the sticky panel shows the vignettes of the step nearest the middle of the viewport.
      Uses IntersectionObserver with a 1px band at the vertical centre. Under prefers-reduced-motion the swap is instant (CSS).
   4. How it works step 3: the Relay/Direct switch sets data-mode on #lp-root ("relay" default, "direct" previews the owner option).
      It only changes the illustration, never a setting. SHOW_DIRECT_COMING_SOON controls the direct view's Coming soon chip.
   5. Phone preview slot: DESIGN-ONLY. Mounts design/card/card.html over the static fallback. Delete this block in production
      and render the real card component in its preview mode instead. */
(function () {
  'use strict';
  /* Coming soon chip in the direct view's step 3 chip slot. True until DIDI-831 ships the owner setting.
     Flip to false (or delete the span[data-slot="direct-coming-soon"] in index.html): the slot stays, same height, nothing moves. */
  var SHOW_DIRECT_COMING_SOON = true;
  var root = document.getElementById('lp-root');
  var $ = function (s, el) { return (el || root).querySelector(s); };
  var params = new URLSearchParams(location.search);
  var $$ = function (s, el) { return Array.prototype.slice.call((el || root).querySelectorAll(s)); };

  /* 1. Icons */
  var cache = {}, maskN = 0;
  function fillIcons(scope) {
    $$('[data-icon]:not([data-icon-done])', scope).forEach(function (el) {
      el.setAttribute('data-icon-done', '');
      var name = el.getAttribute('data-icon');
      if (!cache[name]) cache[name] = fetch('icons/' + name + '.svg').then(function (r) { return r.text(); });
      cache[name].then(function (svg) {
        var s = el.getAttribute('data-size');
        if (svg.indexOf('id="mask"') > -1) { var id = 'lp-mask-' + (++maskN); svg = svg.replace('id="mask"', 'id="' + id + '"').replace('url(#mask)', 'url(#' + id + ')'); }
        if (s) svg = svg.replace(/width="[\d.]+"/, 'width="' + s + '"').replace(/height="[\d.]+"/, 'height="' + s + '"');
        el.innerHTML = svg;
      });
    });
  }

  /* 2. Theme */
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  var toggle = $('[data-theme-toggle]');
  function theme() { return root.getAttribute('data-theme') || (mq && mq.matches ? 'dark' : 'light'); }
  function sync() { if (toggle) toggle.setAttribute('aria-checked', String(theme() === 'dark')); mountPhone(); }
  var stored = params.get('theme'); /* ?theme= is for the design canvas only */
  if (!stored) { try { stored = localStorage.getItem('card-theme'); } catch (e) {} }
  if (stored === 'light' || stored === 'dark') root.setAttribute('data-theme', stored);
  if (mq && mq.addEventListener) mq.addEventListener('change', sync);
  if (toggle) toggle.addEventListener('click', function () {
    var next = theme() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('card-theme', next); } catch (e) {}
    sync();
  });

  /* 3. How it works */
  var panel = $('[data-panel]'), steps = $$('.lp-step');
  if (panel && steps.length) {
    steps.forEach(function (step, i) {
      var layer = document.createElement('div');
      layer.className = 'lp-layer';
      layer.setAttribute('data-layer', i);
      if (i === 0) layer.setAttribute('data-active', 'true');
      $$('.lp-vig', step).forEach(function (v) { layer.appendChild(v.cloneNode(true)); });
      panel.appendChild(layer);
    });
    var setActive = function (i) {
      steps.forEach(function (s, k) { s.setAttribute('data-active', String(k === i)); });
      $$('[data-layer]', panel).forEach(function (l, k) { l.setAttribute('data-active', String(k === i)); });
    };
    if (window.IntersectionObserver) {
      var cb = function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) setActive(steps.indexOf(e.target)); });
      };
      var io;
      try { io = new IntersectionObserver(cb, { root: document, rootMargin: '-50% 0px -50% 0px', threshold: 0 }); }
      catch (err) { io = new IntersectionObserver(cb, { rootMargin: '-50% 0px -50% 0px', threshold: 0 }); }
      steps.forEach(function (s) { io.observe(s); });
    }
  }
  /* 4. Step 3 mode switch. Review overrides (design canvas only): ?mode=direct opens the direct state, ?soon=0 / ?soon=1
     override SHOW_DIRECT_COMING_SOON, ?static=1 shows every step's vignette inline (mockup capture). */
  var soonParam = params.get('soon');
  var showSoon = soonParam === null ? SHOW_DIRECT_COMING_SOON : soonParam === '1';
  if (!showSoon) $$('[data-slot="direct-coming-soon"]').forEach(function (el) { el.parentNode.removeChild(el); });
  if (params.has('static')) root.classList.add('lp-static');
  var modeBtns = $$('[data-mode-btn]');
  function setMode(m) {
    root.setAttribute('data-mode', m);
    modeBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-mode-btn') === m)); });
  }
  modeBtns.forEach(function (b) { b.addEventListener('click', function () { setMode(b.getAttribute('data-mode-btn')); }); });
  setMode(params.get('mode') === 'direct' ? 'direct' : 'relay');

  fillIcons();

  /* 5. Phone preview slot (DESIGN-ONLY, delete in production) */
  var slot = $('[data-phone-slot]');
  function mountPhone() {
    if (!slot || params.get('fallback') === '1') return;
    var src = '../card/card.html?plan=pro&bar=0&theme=' + theme();
    var f = $('iframe', slot);
    if (!f) {
      f = document.createElement('iframe');
      f.title = 'Example card (design-only reference)';
      f.setAttribute('tabindex', '-1');
      f.setAttribute('aria-hidden', 'true');
      f.setAttribute('data-design-only', '');
      f.setAttribute('loading', 'lazy');
      slot.appendChild(f);
    }
    if (f.getAttribute('src') !== src) f.setAttribute('src', src);
  }
  sync();

  /* Preview-only (design canvas): ?at=how|step2|step3|footer scrolls there on load. Safe to delete. */
  var at = params.get('at');
  if (at) window.addEventListener('load', function () {
    var el = at === 'how' ? $('.lp-band') : at === 'step2' ? steps[1] : at === 'step3' ? steps[2] : $('footer');
    if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - (/^step/.test(at) ? window.innerHeight / 2 - 120 : 0));
  });
})();
