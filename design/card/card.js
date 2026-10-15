/* We Met contact card behaviour. Plain JS, no dependencies.
   Backend hook: set window.WeMetCard = { submit(type, data) { return fetch(...) } } before this script,
   where type is 'exchange' ({ name, email, phone }) or 'details' ({ email, jobTitle, company, note }).
   It must return a Promise; a rejection shows the error alert and keeps the typed values. */
(function () {
  'use strict';
  var root = document.getElementById('wm-root');
  var $ = function (s, el) { return (el || root).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || root).querySelectorAll(s)); };
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var params = new URLSearchParams(location.search);
  var data = JSON.parse(document.getElementById('card-data').textContent || '{}');

  /* ---------- Icons: inline icons/<name>.svg into every [data-icon] ---------- */
  var iconCache = {}, maskN = 0;
  function loadIcon(name) {
    if (!iconCache[name]) iconCache[name] = fetch('icons/' + name + '.svg').then(function (r) { return r.text(); });
    return iconCache[name];
  }
  function fillIcons(scope) {
    Array.prototype.slice.call((scope || document).querySelectorAll('[data-icon]:not([data-icon-done])')).forEach(function (el) {
      el.setAttribute('data-icon-done', '');
      loadIcon(el.getAttribute('data-icon')).then(function (svg) {
        var s = el.getAttribute('data-size');
        if (svg.indexOf('id="mask"') > -1) { var id = 'wm-mask-' + (++maskN); svg = svg.replace('id="mask"', 'id="' + id + '"').replace('url(#mask)', 'url(#' + id + ')'); }
        if (s) svg = svg.replace(/width="\d+"/, 'width="' + s + '"').replace(/height="\d+"/, 'height="' + s + '"');
        el.innerHTML = svg;
      });
    });
  }
  fillIcons(document);

  /* Preview params, used by the design canvas only. Safe to delete in production. */
  var cases = (params.get('case') || '').split(',');
  if (cases.indexOf('no-photo') > -1) data.photo = '';
  if (cases.indexOf('no-role') > -1) data.role = '';
  if (cases.indexOf('no-about') > -1) data.about = null;
  if (cases.indexOf('no-services') > -1) data.services = null;
  if (cases.indexOf('no-alt') > -1) data.alternate = null;
  if (cases.indexOf('two-links') > -1 && data.links) data.links = { website: data.links.website, linkedin: data.links.linkedin };
  if (params.get('plan')) data.plan = params.get('plan');
  var demoState = params.get('state');
  var demoFail = demoState === 'error';
  /* End preview params. */

  var str = function (v) { return String(v == null ? '' : v).trim(); };
  var get = function (path) { return path.split('.').reduce(function (o, k) { return o && o[k]; }, data); };
  var name = str(data.name), first = name.split(/\s+/)[0] || '';
  var initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0].toUpperCase(); }).join('');

  /* ---------- Fill ---------- */
  $$('[data-bind]').forEach(function (el) { var v = str(get(el.getAttribute('data-bind'))); el.textContent = v; el.hidden = !v; });
  $('[data-greeting]').textContent = first ? "I'm " + first : name;
  $('.wm-id').setAttribute('aria-label', name);
  var photo = str(data.photo);
  $$('[data-bind-photo]').forEach(function (img) { if (photo) { img.src = photo; img.alt = name; } img.hidden = !photo; });
  $$('[data-initials]').forEach(function (el) { el.textContent = initials; el.hidden = !!photo; });
  var free = data.plan !== 'pro';
  $$('[data-plan-free]').forEach(function (el) { el.hidden = !free; });

  var alt = data.alternate && str(data.alternate.url);
  var altEl = $('[data-alternate]');
  if (alt) { altEl.href = alt; altEl.textContent = str(data.alternate.label) || 'Book a time'; } else altEl.hidden = true;

  var paras = (data.about && Array.isArray(data.about.paragraphs) ? data.about.paragraphs : []).map(str).filter(Boolean);
  var aboutEl = $('[data-section="about"]');
  aboutEl.hidden = !paras.length;
  if (paras.length) {
    $('[data-about-first]').textContent = paras[0];
    var rest = $('[data-about-rest]');
    paras.slice(1).forEach(function (t) { var p = document.createElement('p'); p.className = 'wm-p'; p.textContent = t; rest.appendChild(p); });
    var more = $('[data-more]');
    more.hidden = paras.length < 2;
    more.addEventListener('click', function () {
      var open = rest.hidden;
      rest.hidden = !open;
      more.setAttribute('aria-expanded', String(open));
      more.textContent = open ? 'Show less' : 'Show more';
    });
  }

  var items = (data.services && Array.isArray(data.services.items) ? data.services.items : []).filter(function (s) { return s && str(s.title); });
  var svcEl = $('[data-section="services"]');
  svcEl.hidden = !items.length;
  svcEl.classList.toggle('wm-ruled', !!paras.length);

  var links = data.links || {}, anyLink = false;
  $$('[data-link]').forEach(function (li) {
    var url = str(links[li.getAttribute('data-link')]);
    li.hidden = !url;
    if (url) { li.querySelector('a').href = url; anyLink = true; }
  });
  var linksEl = $('[data-section="links"]');
  linksEl.hidden = !anyLink;
  linksEl.classList.toggle('wm-spaced', !!(paras.length || items.length));

  /* ---------- Theme ---------- */
  var toggle = $('[data-theme-toggle]');
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function effective() { var t = root.getAttribute('data-theme'); return t || (mq && mq.matches ? 'dark' : 'light'); }
  function syncToggle() { toggle.setAttribute('aria-checked', String(effective() === 'dark')); }
  var stored = params.get('theme');
  if (!stored) { try { stored = localStorage.getItem('card-theme'); } catch (e) {} }
  if (stored === 'light' || stored === 'dark') root.setAttribute('data-theme', stored);
  syncToggle();
  if (mq && mq.addEventListener) mq.addEventListener('change', syncToggle);
  toggle.addEventListener('click', function () {
    var next = effective() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('card-theme', next); } catch (e) {}
    syncToggle();
  });

  /* ---------- Chips + popover ---------- */
  var chipsUl = $('[data-chips]'), chipRoot = $('[data-chiproot]'), pop = $('[data-pop]');
  var tpl = document.getElementById('tpl-chip');
  var chipBtns = [], openIdx = -1, closing = false;
  items.forEach(function (it, i) {
    var li = tpl.content.firstElementChild.cloneNode(true);
    li.querySelector('[data-chip-label]').textContent = str(it.title);
    var b = li.querySelector('button');
    b.addEventListener('click', function () { openIdx === i ? closeChip(false) : openChip(i); });
    chipBtns.push(b);
    chipsUl.appendChild(li);
    fillIcons(li);
  });
  function placePop() {
    var chip = chipBtns[openIdx].querySelector('.wm-pill');
    var vw = document.documentElement.clientWidth, vh = window.innerHeight, M = 16, G = 10;
    var w = Math.min(280, vw - M * 2);
    pop.style.width = w + 'px';
    var r = chipRoot.getBoundingClientRect(), c = chip.getBoundingClientRect(), h = pop.offsetHeight, cx = c.left + c.width / 2;
    var left = Math.max(M, Math.min(cx - w / 2, vw - M - w));
    var above = !(c.bottom + G + h <= vh - M) && (c.top - G - h >= M);
    var top = above ? c.top - G - h : c.bottom + G;
    pop.style.left = Math.round(left - r.left) + 'px';
    pop.style.top = Math.round(top - r.top) + 'px';
    pop.setAttribute('data-side', above ? 'above' : 'below');
    pop.querySelector('.wm-pop-arrow').style.left = (Math.round(Math.max(20, Math.min(cx - left, w - 20))) - 6) + 'px';
    return above;
  }
  function openChip(i) {
    stopHint();
    if (openIdx > -1) chipBtns[openIdx].setAttribute('aria-expanded', 'false');
    openIdx = i; closing = false;
    chipBtns[i].setAttribute('aria-expanded', 'true');
    $('[data-pop-title]').textContent = str(items[i].title);
    $('[data-pop-body]').textContent = str(items[i].description);
    pop.hidden = false; pop.style.opacity = '';
    var above = placePop();
    if (!reduced && pop.animate) pop.animate([{ opacity: 0, transform: 'translateY(' + (above ? 4 : -4) + 'px)' }, { opacity: 1, transform: 'none' }], { duration: 120, easing: 'cubic-bezier(0,0,.2,1)' });
    try { localStorage.setItem('card-chips-opened', '1'); } catch (e) {}
  }
  function closeChip(focusChip) {
    if (openIdx < 0 || closing) return;
    var i = openIdx; closing = true;
    var done = function () { closing = false; pop.hidden = true; chipBtns[i].setAttribute('aria-expanded', 'false'); openIdx = -1; if (focusChip) chipBtns[i].focus(); };
    if (!reduced && pop.animate) pop.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' }).onfinish = done;
    else done();
  }
  document.addEventListener('pointerdown', function (e) {
    if (openIdx < 0) return;
    if (pop.contains(e.target) || (e.target.closest && e.target.closest('.wm-chip'))) return;
    closeChip(false);
  }, true);
  window.addEventListener('scroll', function (e) { if (openIdx > -1 && !pop.contains(e.target)) closeChip(false); }, true);
  window.addEventListener('resize', function () { if (openIdx > -1 && !closing) placePop(); });

  /* One-time hint: plus icons spin once when the chips are 60% visible, until a chip has been opened. */
  var hintSpent = false;
  try { hintSpent = localStorage.getItem('card-chips-opened') === '1'; } catch (e) {}
  function stopHint() { $$('.wm-hinting').forEach(function (el) { el.classList.remove('wm-hinting'); el.style.animationDelay = ''; }); }
  if (!reduced && !hintSpent && items.length && window.IntersectionObserver) {
    var io = new IntersectionObserver(function (es) {
      if (!es.some(function (e) { return e.isIntersecting; })) return;
      io.disconnect();
      $$('.wm-pill-ic', chipsUl).forEach(function (ic, i) {
        ic.style.animationDelay = (200 + i * 70) + 'ms';
        ic.classList.add('wm-hinting');
        ic.addEventListener('animationend', function () { ic.classList.remove('wm-hinting'); ic.style.animationDelay = ''; }, { once: true });
      });
    }, { threshold: 0.6 });
    io.observe(chipRoot);
  }

  /* ---------- Sticky bar ---------- */
  var bar = $('[data-bar]'), cta = document.getElementById('wm-cta');
  var barOn = params.get('bar') !== '0';
  var sheetOpen = false, raf = 0;
  function tickBar() {
    raf = 0;
    var show = barOn && !sheetOpen && cta.getBoundingClientRect().top < 0;
    bar.setAttribute('data-shown', String(show));
    bar.setAttribute('aria-hidden', String(!show));
    bar.querySelector('button').tabIndex = show ? 0 : -1;
  }
  var onScroll = function () { if (!raf) raf = requestAnimationFrame(tickBar); };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  /* ---------- Exchange sheet ---------- */
  var sheet = $('[data-sheet]'), panel = $('.wm-panel', sheet), scrim = $('.wm-scrim', sheet);
  var fx = $('[data-step="exchange"]'), fd = $('[data-step="details"]');
  var connected = false, visitor = { name: '', email: '' }, opener = null, closeT = 0, tried = false;

  function setStep(step) {
    fx.hidden = step !== 'exchange'; fd.hidden = step !== 'details';
    $('[data-title-exchange]').hidden = step !== 'exchange';
    $('[data-title-details]').hidden = step !== 'details';
    $('[data-title-' + step + ']').id = 'wm-sheet-title';
    $('[data-title-' + (step === 'exchange' ? 'details' : 'exchange') + ']').removeAttribute('id');
  }
  function openSheet() {
    closeChip(false);
    opener = document.activeElement;
    clearTimeout(closeT);
    setStep(connected ? 'details' : 'exchange');
    sheet.hidden = false;
    sheet.setAttribute('data-anim', 'in');
    panel.style.transform = ''; scrim.style.opacity = ''; panel.style.transition = ''; scrim.style.transition = '';
    sheetOpen = true; tickBar();
    document.body.style.overflow = 'hidden';
    if (!demoState) setTimeout(function () { var f = $((connected ? '[data-step="details"]' : '[data-step="exchange"]') + ' input', sheet); if (f) f.focus({ preventScroll: true }); }, reduced ? 0 : 350);
  }
  function finishClose() {
    sheet.hidden = true; sheet.removeAttribute('data-anim');
    sheetOpen = false; document.body.style.overflow = ''; tickBar();
    fx.removeAttribute('data-leaving');
    if (opener && opener.focus) opener.focus({ preventScroll: true });
  }
  function closeSheet() {
    if (sheet.hidden || sheet.getAttribute('data-anim') === 'out') return;
    sheet.setAttribute('data-anim', 'out');
    closeT = setTimeout(finishClose, reduced ? 0 : 300);
  }
  $$('[data-open-sheet]').forEach(function (b) { b.addEventListener('click', openSheet); });
  $$('[data-close]', sheet).forEach(function (b) { b.addEventListener('click', closeSheet); });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (!sheet.hidden) closeSheet(); else if (openIdx > -1) closeChip(true);
  });

  function validate() {
    var errs = {};
    var n = str(fx.elements['name'].value), m = str(fx.elements['email'].value);
    if (!n) errs.name = 'Add your name so I know who you are.';
    if (!m) errs.email = 'Add your email so I can reach you.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m)) errs.email = "That email doesn't look quite right. Check for a typo?";
    ['name', 'email'].forEach(function (k) {
      var f = $('[data-field="' + k + '"]', fx), p = f.querySelector('.wm-err');
      f.setAttribute('data-invalid', String(!!errs[k]));
      p.hidden = !errs[k]; p.querySelector('[data-msg]').textContent = errs[k] || '';
      f.querySelector('input').setAttribute('aria-invalid', String(!!errs[k]));
    });
    return errs;
  }
  ['name', 'email'].forEach(function (k) { fx.elements[k].addEventListener('input', function () { if (tried) validate(); }); });

  function busy(form, on) {
    var b = form.querySelector('[data-submit]');
    b.disabled = on; b.setAttribute('aria-busy', String(on));
    b.textContent = on ? 'Sending…' : b.getAttribute('data-label');
  }
  function send(type, payload) {
    var hook = window.WeMetCard && window.WeMetCard.submit;
    if (hook) return Promise.resolve().then(function () { return hook(type, payload); });
    console.log('[card] ' + type, payload);
    return new Promise(function (res, rej) { setTimeout(demoFail ? rej : res, 500); });
  }
  function showError(form, on) { form.querySelector('[data-error]').hidden = !on; }
  function setVisitorFirst() { $$('[data-visitor-first]').forEach(function (el) { el.textContent = visitor.name.split(/\s+/)[0] || 'there'; }); }

  fx.addEventListener('submit', function (e) {
    e.preventDefault();
    tried = true;
    var errs = validate();
    if (errs.name || errs.email) { (errs.name ? fx.elements['name'] : fx.elements['email']).focus(); return; }
    var sel = fx.elements['country'].options[fx.elements['country'].selectedIndex];
    visitor = { name: str(fx.elements['name'].value), email: str(fx.elements['email'].value) };
    var phone = str(fx.elements['phone'].value);
    showError(fx, false); busy(fx, true);
    send('exchange', { name: visitor.name, email: visitor.email, phone: phone ? sel.value + ' ' + phone : '' }).then(function () {
      connected = true; setVisitorFirst();
      fx.setAttribute('data-leaving', 'true');
      setTimeout(function () { busy(fx, false); fx.removeAttribute('data-leaving'); setStep('details'); var f = $('input', fd); if (f) f.focus({ preventScroll: true }); }, reduced ? 0 : 200);
      $('[data-thanks]').hidden = false;
    }, function () { busy(fx, false); showError(fx, true); });
  });
  fd.addEventListener('submit', function (e) {
    e.preventDefault();
    showError(fd, false); busy(fd, true);
    send('details', { email: visitor.email, jobTitle: str(fd.elements['jobTitle'].value), company: str(fd.elements['company'].value), note: str(fd.elements['note'].value) }).then(function () {
      busy(fd, false); closeSheet();
    }, function () { busy(fd, false); showError(fd, true); });
  });

  /* Drag to dismiss: pull the header down. Past 32% of the panel height, or a fast flick (> 0.45 px/ms after 16 px), closes;
     otherwise it springs back. Dragging up rubber-bands to at most 28 px. */
  var drag = null;
  $('[data-drag]', sheet).addEventListener('pointerdown', function (e) {
    if (sheet.getAttribute('data-anim') === 'out' || drag) return;
    if ((e.button && e.button > 0) || e.target.closest('button')) return;
    drag = { y0: e.clientY, dy: 0, h: panel.offsetHeight, active: false, samples: [[performance.now(), e.clientY]] };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  });
  function onMove(e) {
    var d = drag; if (!d) return;
    var dy = e.clientY - d.y0;
    if (!d.active) {
      if (Math.abs(dy) < 3) return;
      d.active = true;
      [panel, scrim].forEach(function (el) { el.style.animation = 'none'; el.style.transition = 'none'; });
    }
    if (dy < 0) dy = -Math.min(28, Math.pow(-dy, 0.65));
    d.dy = dy;
    panel.style.transform = 'translateY(' + dy + 'px)';
    scrim.style.opacity = String(Math.max(0, 1 - Math.max(0, dy) / d.h));
    var now = performance.now();
    d.samples.push([now, e.clientY]);
    while (d.samples.length > 2 && now - d.samples[0][0] > 90) d.samples.shift();
    e.preventDefault();
  }
  function onUp() {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    var d = drag; drag = null;
    if (!d || !d.active) return;
    var now = performance.now(), recent = d.samples.filter(function (p) { return now - p[0] <= 90; }), v = 0;
    if (recent.length >= 2 && now - recent[recent.length - 1][0] <= 60) { var a = recent[0], b = recent[recent.length - 1]; v = (b[1] - a[1]) / Math.max(1, b[0] - a[0]); }
    var restore = function () { [panel, scrim].forEach(function (el) { el.style.animation = ''; }); };
    if (d.dy > d.h * 0.32 || (v > 0.45 && d.dy > 16)) {
      var dur = Math.round(Math.max(150, Math.min(280, (d.h - d.dy) / Math.max(v, 1.4))));
      panel.style.transition = 'transform ' + dur + 'ms cubic-bezier(.2,.6,.35,1)';
      scrim.style.transition = 'opacity ' + dur + 'ms ease-out';
      panel.style.transform = 'translateY(100%)';
      scrim.style.opacity = '0';
      sheet.setAttribute('data-anim', 'out-drag');
      closeT = setTimeout(function () { restore(); panel.style.transform = ''; scrim.style.opacity = ''; finishClose(); }, dur);
    } else {
      panel.style.transition = 'transform .42s cubic-bezier(.2,1.35,.4,1)';
      scrim.style.transition = 'opacity .25s ease-out';
      panel.style.transform = 'translateY(0)';
      scrim.style.opacity = '1';
    }
  }

  /* Preview states for the design canvas (safe to delete). */
  if (demoState) {
    var demo = function () {
      reduced = true;
      if (demoState === 'popover' && chipBtns[1]) { stopHint(); openChip(1); return; }
      if (demoState === 'success') { visitor = { name: 'Sam Rivera', email: 'sam@studio.co' }; connected = true; setVisitorFirst(); $('[data-thanks]').hidden = false; return; }
      if (demoState === 'more') { var m = $('[data-more]'); if (m && !m.hidden) m.click(); return; }
      openSheet();
      sheet.removeAttribute('data-anim');
      if (demoState === 'invalid') { fx.elements['email'].value = 'sam@studio'; tried = true; validate(); }
      if (demoState === 'error' || demoState === 'loading') { fx.elements['name'].value = 'Sam Rivera'; fx.elements['email'].value = 'sam@studio.co'; }
      if (demoState === 'error') showError(fx, true);
      if (demoState === 'loading') busy(fx, true);
      if (demoState === 'details') { visitor = { name: 'Sam Rivera', email: 'sam@studio.co' }; connected = true; setVisitorFirst(); setStep('details'); }
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    };
    if (document.readyState === 'complete') demo(); else window.addEventListener('load', demo);
  }
  tickBar();
})();
