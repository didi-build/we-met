/* We Met app (app.we-met.link): Google sign-in and the card editor. Plain JS, no dependencies.

   BACKEND HOOKS
   Every server call goes through window.WeMetApp. Define it before this script loads, with these async functions.
   The stubs at the bottom of this comment's code block are fakes with short delays, for the design only.

     getSession()          -> { email, name, allowed } | null
                              null = signed out. allowed:false = signed in, but sign-up is closed for this account.
     signIn()              -> same as getSession. Starts Google sign-in. Reject (any error) if the user cancels or it fails.
     signOut()             -> void
     getCard()             -> { draft: Card, published: Card | null }
     saveDraft(card)       -> void. Reject with { code: 'unauthorized' } when the session has expired.
     checkSlug(slug)       -> { available: boolean, reason?: 'taken' | 'reserved' }
                              The owner's own current slug must come back as available.
     uploadPhoto(blob)     -> { url }. blob is a 512 x 512 JPEG, already cropped square.
     publish(card)         -> { url }. Makes the draft the public card.

   Card shape (same as the card-data block in design/card/card.html, plus slug; About and What I do titles are fixed):
     { slug, name, role, photo, about: [string], services: [{ title, description }],
       links: { website, linkedin, github, instagram }, alternate: { url, label } }
*/
(function () {
  'use strict';
  var root = document.getElementById('ap-root');
  var $ = function (s, el) { return (el || root).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || root).querySelectorAll(s)); };
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var params = new URLSearchParams(location.search);
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  var str = function (v) { return String(v == null ? '' : v); };
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  var LIMIT = { name: 60, role: 100, para: 500, paras: 4, svcTitle: 40, svcDesc: 220, svcs: 10, altLabel: 60, slugMin: 3, slugMax: 40, photoBytes: 5 * 1024 * 1024 };
  var RESERVED = ['app', 'www', 'api', 'admin', 'hi', 'help', 'support', 'login', 'signin', 'signup', 'settings', 'account', 'we-met', 'wemet', 'mail', 'static'];
  var EMPTY = { slug: '', name: '', role: '', photo: '', about: [], services: [], links: { website: '', linkedin: '', github: '', instagram: '' }, alternate: { url: '', label: '' } };

  /* ===== Preview-only fake backend (safe to delete once window.WeMetApp is real) ===== */
  var demo = params.get('state') || '';
  var sample = JSON.parse((document.getElementById('sample-data') || {}).textContent || '{}');
  var saveFailedOnce = false;
  var fake = {
    getSession: function () {
      return wait(150).then(function () {
        if (/^login/.test(demo)) return null;
        return Object.assign({ allowed: demo !== 'closed' }, sample.session);
      });
    },
    signIn: function () {
      return wait(1200).then(function () {
        if (demo === 'login-error') throw new Error('cancelled');
        return Object.assign({ allowed: true }, sample.session);
      });
    },
    signOut: function () { return wait(200); },
    getCard: function () {
      return wait(250).then(function () {
        var full = clone(sample.card);
        if (demo === 'empty') return { draft: clone(EMPTY), published: null };
        if (demo === 'publish-blocked') { var b = clone(EMPTY); b.role = 'Product designer'; return { draft: b, published: null }; }
        if (demo === 'draft' || /^slug-(checking|available|taken|invalid|reserved)$/.test(demo) || demo === 'errors') return { draft: full, published: null };
        if (demo === 'unpublished') { var d = clone(full); d.role = 'Software engineer, Toronto'; return { draft: d, published: full }; }
        if (demo === 'slug-change') { var s = clone(full); s.slug = 'didi-shoukralla'; return { draft: s, published: full }; }
        return { draft: full, published: clone(full) };
      });
    },
    saveDraft: function () {
      return wait(600).then(function () {
        if (demo === 'session-expired') { var e = new Error('expired'); e.code = 'unauthorized'; throw e; }
        if (demo === 'save-error' && !saveFailedOnce) { saveFailedOnce = true; throw new Error('network'); }
      });
    },
    checkSlug: function (slug) {
      return wait(demo === 'slug-checking' ? 1e9 : 500).then(function () {
        if (RESERVED.indexOf(slug) > -1) return { available: false, reason: 'reserved' };
        if (['sam', 'alex', 'jordan', 'taylor', 'test', 'demo'].indexOf(slug) > -1) return { available: false, reason: 'taken' };
        return { available: true };
      });
    },
    uploadPhoto: function (blob) {
      return wait(demo === 'uploading' ? 1e9 : 1400).then(function () {
        if (demo === 'upload-error') throw new Error('upload');
        return { url: URL.createObjectURL(blob) };
      });
    },
    publish: function (card) { return wait(900).then(function () { return { url: 'https://we-met.link/hi/' + card.slug }; }); }
  };
  /* ===== End fake backend ===== */

  var api = window.WeMetApp || fake;

  /* ---------- Icons: inline icons/<name>.svg into [data-icon] ---------- */
  var iconCache = {}, maskN = 0;
  function fillIcons(scope) {
    $$('[data-icon]:not([data-icon-done])', scope || document.body).forEach(function (el) {
      el.setAttribute('data-icon-done', '');
      var name = el.getAttribute('data-icon');
      if (!iconCache[name]) iconCache[name] = fetch('icons/' + name + '.svg').then(function (r) { return r.text(); });
      iconCache[name].then(function (svg) {
        var s = el.getAttribute('data-size');
        if (svg.indexOf('id="mask"') > -1) { var id = 'ap-mask-' + (++maskN); svg = svg.replace('id="mask"', 'id="' + id + '"').replace('url(#mask)', 'url(#' + id + ')'); }
        if (s) svg = svg.replace(/width="\d+"/, 'width="' + s + '"').replace(/height="\d+"/, 'height="' + s + '"');
        el.innerHTML = svg;
      });
    });
  }
  fillIcons();

  /* ---------- Theme ---------- */
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function theme() { return root.getAttribute('data-theme') || (mq && mq.matches ? 'dark' : 'light'); }
  function syncTheme() {
    var dark = theme() === 'dark';
    root.setAttribute('data-dark', String(dark));
    $('[data-theme-toggle]').setAttribute('aria-label', dark ? 'Use light mode' : 'Use dark mode');
    if (card) renderPreview(true);
  }
  var storedTheme = params.get('theme');
  if (!storedTheme) { try { storedTheme = localStorage.getItem('wemet-app-theme'); } catch (e) {} }
  if (storedTheme === 'light' || storedTheme === 'dark') root.setAttribute('data-theme', storedTheme);
  if (mq && mq.addEventListener) mq.addEventListener('change', syncTheme);
  $('[data-theme-toggle]').addEventListener('click', function () {
    var next = theme() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('wemet-app-theme', next); } catch (e) {}
    syncTheme();
  });

  /* ---------- State ---------- */
  var session = null, card = null, published = null;
  var tried = false, saveT = 0, previewT = 0, slugT = 0, slugSeq = 0;
  var slug = { status: 'empty', value: '' };
  var announce = function (t) { var el = $('[data-announce]'); el.textContent = ''; setTimeout(function () { el.textContent = t; }, 30); };
  var get = function (path) { return path.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, card); };
  var set = function (path, v) { var ks = path.split('.'), o = card; for (var i = 0; i < ks.length - 1; i++) o = o[ks[i]]; o[ks[ks.length - 1]] = v; };
  var idFor = function (key) { return key.replace(/\./g, '-'); };

  function showView(name) {
    $$('[data-view]').forEach(function (v) { v.hidden = v.getAttribute('data-view') !== name; });
    $('[data-account]').hidden = !session;
    if (session) {
      $$('[data-email]').forEach(function (el) { el.textContent = session.email; });
    }
  }

  /* ---------- Sign in / out ---------- */
  function setSigningIn(on) {
    $$('[data-signin]').forEach(function (b) {
      b.setAttribute('aria-busy', String(on)); b.disabled = on;
      var label = $('[data-signin-label]', b);
      label.textContent = on ? 'Waiting for Google…' : 'Sign in with Google';
      var ic = $('.ap-icon', b), sp = $('.ap-spin', b);
      if (on && !sp) { sp = document.createElement('span'); sp.className = 'ap-spin'; sp.setAttribute('aria-hidden', 'true'); b.insertBefore(sp, label); }
      if (sp) sp.hidden = !on; ic.hidden = on;
    });
  }
  $$('[data-signin]').forEach(function (b) {
    b.addEventListener('click', function () {
      $('[data-login-error]').hidden = true;
      setSigningIn(true);
      api.signIn().then(function (s) {
        setSigningIn(false);
        var wasExpired = !$('[data-dialog="session"]').hidden;
        session = s;
        if (wasExpired) { closeDialog(); scheduleSave(0); return; }
        route();
      }, function () {
        setSigningIn(false);
        if (!$('[data-dialog="session"]').hidden) return;
        $('[data-login-error]').hidden = false;
        announce("Sign-in didn't finish.");
      });
    });
  });
  $$('[data-signout]').forEach(function (b) {
    b.addEventListener('click', function () {
      closeMenu();
      api.signOut().then(function () { session = null; card = null; showView('login'); });
    });
  });

  /* ---------- Account menu ---------- */
  var menu = $('[data-menu]'), menuBtn = $('[data-menu-btn]');
  function closeMenu() { if (menu.hidden) return; menu.hidden = true; menuBtn.setAttribute('aria-expanded', 'false'); }
  menuBtn.addEventListener('click', function () {
    var open = menu.hidden;
    menu.hidden = !open; menuBtn.setAttribute('aria-expanded', String(open));
    if (open) $('[role="menuitem"]', menu).focus();
  });
  document.addEventListener('pointerdown', function (e) { if (!menu.hidden && !menu.contains(e.target) && !menuBtn.contains(e.target)) closeMenu(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) { closeMenu(); menuBtn.focus(); } });

  /* ---------- Routing ---------- */
  function route() {
    if (!session) return showView('login');
    if (!session.allowed) return showView('closed');
    api.getCard().then(function (r) {
      card = Object.assign(clone(EMPTY), r.draft || {});
      card.links = Object.assign(clone(EMPTY.links), card.links || {});
      card.alternate = Object.assign(clone(EMPTY.alternate), card.alternate || {});
      try { var local = JSON.parse(localStorage.getItem('wemet-draft') || 'null'); if (local && local.email === session.email && local.pending && !demo) card = local.card; } catch (e) {}
      published = r.published ? clone(r.published) : null;
      showView('editor');
      fillForm();
      if (demoAfter) demoAfter();
    });
  }

  /* ---------- Validation ---------- */
  function isHttps(v) { try { var u = new URL(v); return u.protocol === 'https:' && u.hostname.indexOf('.') > 0; } catch (e) { return false; } }
  function maxFor(key) {
    if (key === 'name') return LIMIT.name;
    if (key === 'role') return LIMIT.role;
    if (key === 'alternate.label') return LIMIT.altLabel;
    if (/^about\.\d+$/.test(key)) return LIMIT.para;
    if (/\.title$/.test(key)) return LIMIT.svcTitle;
    if (/\.description$/.test(key)) return LIMIT.svcDesc;
    return 0;
  }
  function errorFor(key) {
    var v = str(get(key)), t = v.trim(), max = maxFor(key);
    if (key === 'slug') {
      if (slug.status === 'invalid') return slug.msg;
      if (slug.status === 'reserved') return 'That name is reserved. Try another.';
      if (slug.status === 'taken') return "That link is taken. Try another.";
      if (tried && !t) return 'Choose your link to publish.';
      return '';
    }
    if (key === 'name' && tried && !t) return 'Add your name to publish.';
    if (max && v.length > max) {
      if (key === 'name') return 'Keep your name to ' + max + ' characters or fewer.';
      if (/^about/.test(key)) return 'Keep each paragraph to ' + max + ' characters or fewer.';
      return 'Keep this to ' + max + ' characters or fewer.';
    }
    if (/\.title$/.test(key)) { var i = key.split('.')[1]; if (!t && str(card.services[i].description).trim()) return 'Add a title for this service.'; }
    if (/^links\./.test(key) || key === 'alternate.url') { if (t && !isHttps(t)) return 'Use a full link that starts with https://'; }
    if (key === 'alternate.url' && !t && card.alternate.label.trim()) return 'Add the link this text should open.';
    return '';
  }
  function allKeys() {
    var ks = ['slug', 'name', 'role', 'links.website', 'links.linkedin', 'links.github', 'links.instagram', 'alternate.url', 'alternate.label'];
    card.about.forEach(function (_, i) { ks.push('about.' + i); });
    card.services.forEach(function (_, i) { ks.push('services.' + i + '.title', 'services.' + i + '.description'); });
    return ks;
  }
  function paintField(key) {
    var field = $('[data-field="' + key + '"]'); if (!field) return;
    var msg = errorFor(key), max = maxFor(key), len = str(get(key)).length;
    var err = $('[data-err="' + key + '"]', field), cnt = $('[data-count="' + key + '"]', field), input = $('.ap-input', field);
    field.setAttribute('data-invalid', String(!!msg));
    if (input) input.setAttribute('aria-invalid', String(!!msg));
    if (err) { err.hidden = !msg; err.innerHTML = msg ? '<span aria-hidden="true">!</span><span></span>' : ''; if (msg) err.lastChild.textContent = msg; }
    if (cnt && max) { cnt.hidden = len < max * 0.8; cnt.textContent = len + ' / ' + max; cnt.setAttribute('data-over', String(len > max)); }
    var help = $('[data-help="' + key + '"]', field); if (help) help.hidden = !!msg;
  }
  function paintAll() { allKeys().forEach(paintField); }

  /* ---------- Form fill ---------- */
  var form = $('[data-form]');
  function fillForm() {
    $$('[data-bind]', form).forEach(function (el) { el.value = str(get(el.getAttribute('data-bind'))); });
    renderList('about'); renderList('services'); renderPhoto();
    slug = { status: 'empty', value: '' };
    if (card.slug) { if (published && card.slug === published.slug) slug = { status: 'mine', value: card.slug }; else checkSlugNow(card.slug); }
    paintSlug(); paintAll(); paintBar(); paintSave('saved'); renderPreview(true);
  }

  function renderList(kind) {
    var ol = $('[data-list="' + kind + '"]'), tpl = document.getElementById(kind === 'about' ? 'tpl-para' : 'tpl-service');
    ol.innerHTML = '';
    var list = card[kind], max = kind === 'about' ? LIMIT.paras : LIMIT.svcs;
    list.forEach(function (item, i) {
      var li = tpl.content.firstElementChild.cloneNode(true);
      li.setAttribute('data-index', i);
      $('[data-item-label]', li).textContent = (kind === 'about' ? 'Paragraph ' : 'Service ') + (i + 1);
      var parts = kind === 'about' ? [[li.querySelector('.ap-field'), 'about.' + i]] : [[$('[data-part="title"]', li), 'services.' + i + '.title'], [$('[data-part="description"]', li), 'services.' + i + '.description']];
      parts.forEach(function (p) {
        var f = p[0], key = p[1], id = idFor(key), input = $('.ap-input', f);
        f.setAttribute('data-field', key);
        input.id = 'f-' + id; $('label', f).setAttribute('for', input.id);
        input.setAttribute('data-bind', key);
        input.value = str(get(key));
        var err = $('.ap-err', f), cnt = $('.ap-count', f);
        err.id = 'e-' + id; err.setAttribute('data-err', key);
        cnt.id = 'c-' + id; cnt.setAttribute('data-count', key);
        input.setAttribute('aria-describedby', err.id + ' ' + cnt.id);
      });
      if (kind === 'services') {
        var t = str(item.title).trim() || 'service ' + (i + 1);
        $('[data-move="-1"]', li).disabled = i === 0; $('[data-move="-1"]', li).setAttribute('aria-label', 'Move ' + t + ' up');
        $('[data-move="1"]', li).disabled = i === list.length - 1; $('[data-move="1"]', li).setAttribute('aria-label', 'Move ' + t + ' down');
        $('[data-remove]', li).setAttribute('aria-label', 'Delete ' + t);
      }
      ol.appendChild(li);
    });
    $('[data-add="' + kind + '"]').hidden = list.length >= max;
    $('[data-limit="' + kind + '"]').hidden = list.length < max;
    fillIcons(ol);
  }

  form.addEventListener('click', function (e) {
    var add = e.target.closest('[data-add]'), rm = e.target.closest('[data-remove]'), mv = e.target.closest('[data-move]');
    if (add) {
      var kind = add.getAttribute('data-add');
      card[kind].push(kind === 'about' ? '' : { title: '', description: '' });
      renderList(kind); changed();
      var items = $$('[data-list="' + kind + '"] > li'); $('.ap-input', items[items.length - 1]).focus();
    } else if (rm || mv) {
      var li = e.target.closest('li'), k = li.parentNode.getAttribute('data-list'), i = +li.getAttribute('data-index');
      if (rm) { card[k].splice(i, 1); renderList(k); announce(k === 'about' ? 'Paragraph removed.' : 'Service deleted.'); var next = $$('[data-list="' + k + '"] .ap-input')[0]; (next || $('[data-add="' + k + '"]')).focus(); }
      else {
        var j = i + +mv.getAttribute('data-move'); if (j < 0 || j >= card[k].length) return;
        var tmp = card[k][i]; card[k][i] = card[k][j]; card[k][j] = tmp;
        renderList(k);
        var btn = $$('[data-list="' + k + '"] > li')[j].querySelector('[data-move="' + mv.getAttribute('data-move') + '"]');
        (btn && !btn.disabled ? btn : $$('[data-list="' + k + '"] > li')[j].querySelector('[data-remove]')).focus();
        announce('Moved to position ' + (j + 1) + '.');
      }
      paintAll(); changed();
    }
  });

  form.addEventListener('input', function (e) {
    var el = e.target, key = el.getAttribute('data-bind'); if (!key) return;
    if (key === 'slug') {
      var clean = el.value.toLowerCase().replace(/\s+/g, '-');
      if (clean !== el.value) { var p = el.selectionStart; el.value = clean; el.setSelectionRange(p, p); }
      card.slug = clean; onSlugInput();
      if (slugEditing) { paintSlugLock(); return; }
    } else set(key, el.value);
    paintField(key);
    if (/\.description$/.test(key)) paintField(key.replace(/description$/, 'title'));
    if (key === 'alternate.label') paintField('alternate.url');
    if (/\.title$/.test(key)) { var li = el.closest('li'); renderServiceLabels(li); }
    changed();
  });
  function renderServiceLabels(li) {
    var i = +li.getAttribute('data-index'), t = str(card.services[i].title).trim() || 'service ' + (i + 1);
    $('[data-move="-1"]', li).setAttribute('aria-label', 'Move ' + t + ' up');
    $('[data-move="1"]', li).setAttribute('aria-label', 'Move ' + t + ' down');
    $('[data-remove]', li).setAttribute('aria-label', 'Delete ' + t);
  }
  form.addEventListener('submit', function (e) { e.preventDefault(); });

  function changed() {
    paintBar();
    try { localStorage.setItem('wemet-draft', JSON.stringify({ email: session && session.email, pending: true, card: card })); } catch (e) {}
    scheduleSave(800);
    clearTimeout(previewT); previewT = setTimeout(function () { renderPreview(false); }, 250);
  }

  /* ---------- Slug ---------- */
  function slugFormat(v) {
    if (!v) return '';
    if (/[^a-z0-9-]/.test(v)) return 'Use only lowercase letters, numbers and hyphens.';
    if (v.length < LIMIT.slugMin) return 'Use at least ' + LIMIT.slugMin + ' characters.';
    if (v.length > LIMIT.slugMax) return 'Keep it to ' + LIMIT.slugMax + ' characters or fewer.';
    if (/^-|-$/.test(v)) return "It can't start or end with a hyphen.";
    if (/--/.test(v)) return "Use one hyphen at a time.";
    return '';
  }
  function onSlugInput() {
    clearTimeout(slugT); slugSeq++;
    var v = card.slug;
    if (!v) slug = { status: 'empty', value: '' };
    else if (published && v === published.slug) slug = { status: 'mine', value: v };
    else { slug = { status: 'typing', value: v }; slugT = setTimeout(function () { checkSlugNow(v); }, 400); }
    paintSlug();
  }
  function checkSlugNow(v) {
    var fmt = slugFormat(v);
    if (fmt) { slug = { status: 'invalid', value: v, msg: fmt }; paintSlug(); paintField('slug'); paintBar(); return; }
    if (RESERVED.indexOf(v) > -1) { slug = { status: 'reserved', value: v }; paintSlug(); paintField('slug'); paintBar(); return; }
    var seq = ++slugSeq;
    slug = { status: 'checking', value: v }; paintSlug();
    api.checkSlug(v).then(function (r) {
      if (seq !== slugSeq) return;
      slug = { status: r.available ? 'available' : (r.reason === 'reserved' ? 'reserved' : 'taken'), value: v };
      paintSlug(); paintField('slug'); paintBar();
    }, function () {
      if (seq !== slugSeq) return;
      slug = { status: 'unknown', value: v }; paintSlug(); paintBar();
    });
  }
  /* Card address lock: once a card is published, the address is locked. Change it with unlock -> type -> check.
     The new address is held until the check is tapped, and still needs Publish. */
  var slugEditing = false, slugPrev = '';
  function slugLockable() { return !!published; }
  function paintSlugLock() {
    var box = $('[data-slug-box]'), input = $('#f-slug'), btn = $('[data-slug-action]');
    var lockable = slugLockable(), locked = lockable && !slugEditing;
    btn.hidden = !lockable;
    box.setAttribute('data-locked', String(locked));
    input.readOnly = locked;
    input.tabIndex = locked ? -1 : 0;
    $('[data-slug-edit]').hidden = !slugEditing;
    $('[data-slug-ic-lock]').hidden = slugEditing; $('[data-slug-ic-ok]').hidden = !slugEditing;
    btn.setAttribute('data-tone', slugEditing ? 'confirm' : '');
    btn.setAttribute('aria-label', slugEditing ? 'Use this link' : 'Unlock to change your link');
    btn.disabled = slugEditing && !(slug.status === 'available' || slug.status === 'mine');
  }
  $('[data-slug-action]').addEventListener('click', function () {
    var input = $('#f-slug');
    if (!slugEditing) { slugEditing = true; slugPrev = card.slug; paintSlugLock(); input.focus(); input.select(); announce('Link unlocked.'); return; }
    if (!(slug.status === 'available' || slug.status === 'mine')) return;
    slugEditing = false; paintSlugLock(); paintSlug(); changed();
    $('[data-slug-action]').focus();
    announce(card.slug === slugPrev ? 'Link unchanged.' : 'New link set. Publish to make it live.');
  });
  $('[data-slug-cancel]').addEventListener('click', function () {
    slugEditing = false; card.slug = slugPrev; $('#f-slug').value = slugPrev; onSlugInput(); paintSlugLock(); $('[data-slug-action]').focus();
  });
  function paintSlug() {
    var el = $('[data-slug-status]'), s = slug.status, html = '', tone = '';
    if (s === 'empty') html = 'Lowercase letters, numbers and hyphens.';
    else if (s === 'typing') html = 'we-met.link/hi/<b></b>';
    else if (s === 'checking') html = '<span class="ap-spin" aria-hidden="true"></span>Checking…';
    else if (s === 'available') { html = '<span class="ap-icon" data-icon="check" data-size="16" aria-hidden="true"></span>Available'; tone = 'ok'; }
    else if (s === 'mine') { html = '<span class="ap-icon" data-icon="check" data-size="16" aria-hidden="true"></span>This is your current link.'; tone = 'ok'; }
    else if (s === 'unknown') html = "Couldn't check this link. It will be checked again when you publish.";
    el.hidden = s === 'invalid' || s === 'reserved' || s === 'taken';
    el.innerHTML = html; el.setAttribute('data-tone', tone);
    if (s === 'typing') el.querySelector('b').textContent = slug.value;
    fillIcons(el);
    paintField('slug');
    var warn = $('[data-slug-warning]');
    warn.hidden = !(published && card.slug && card.slug !== published.slug);
    warn.hidden = warn.hidden || slugEditing;
    if (!warn.hidden) $('[data-old-url]').textContent = 'we-met.link/hi/' + published.slug;
    paintSlugLock();
  }

  /* ---------- Photo ---------- */
  function initials() { return str(card.name).trim().split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0].toUpperCase(); }).join(''); }
  function renderPhoto() {
    var img = $('[data-photo-img]'), has = !!card.photo;
    img.hidden = !has; if (has) img.src = card.photo;
    $('[data-photo-initials]').hidden = has;
    $('[data-photo-initials]').textContent = initials();
    $('[data-photo-pick-label]').textContent = has ? 'Change photo' : 'Add photo';
    $('[data-photo-remove]').hidden = !has;
  }
  form.addEventListener('input', function (e) { if (e.target.getAttribute('data-bind') === 'name' && !card.photo) $('[data-photo-initials]').textContent = initials(); });
  var fileInput = $('[data-photo-file]');
  function photoError(msg) { var e = $('[data-err="photo"]'); e.hidden = !msg; e.textContent = msg || ''; $('[data-photo-help]').hidden = !!msg; $('[data-field="photo"]').setAttribute('data-invalid', String(!!msg)); }
  $('[data-photo-pick]').addEventListener('click', function () { fileInput.value = ''; fileInput.click(); });
  $('[data-photo-remove]').addEventListener('click', function () { card.photo = ''; photoError(''); renderPhoto(); changed(); announce('Photo removed.'); $('[data-photo-pick]').focus(); });
  fileInput.addEventListener('change', function () {
    var f = fileInput.files && fileInput.files[0]; if (!f) return;
    if (['image/jpeg', 'image/png', 'image/webp'].indexOf(f.type) < 0) return photoError('Use a JPG, PNG or WebP image.');
    if (f.size > LIMIT.photoBytes) return photoError('That photo is over 5 MB. Choose a smaller one.');
    photoError(''); openCrop(URL.createObjectURL(f));
  });

  var crop = { x: 0, y: 0, z: 1, base: 1, w: 0, h: 0, S: 0 };
  var stage = $('[data-crop-stage]'), cimg = $('[data-crop-img]'), zoom = $('[data-crop-zoom]');
  function openCrop(src) {
    cimg.onload = function () {
      crop.w = cimg.naturalWidth; crop.h = cimg.naturalHeight; crop.x = 0; crop.y = 0; crop.z = 1; zoom.value = 1;
      openDialog('crop', $('[data-photo-pick]'));
      crop.S = stage.clientWidth; crop.base = Math.max(crop.S / crop.w, crop.S / crop.h); paintCrop();
    };
    cimg.src = src;
  }
  function clampCrop() {
    var k = crop.base * crop.z, mx = Math.max(0, (crop.w * k - crop.S) / 2), my = Math.max(0, (crop.h * k - crop.S) / 2);
    crop.x = Math.max(-mx, Math.min(mx, crop.x)); crop.y = Math.max(-my, Math.min(my, crop.y));
  }
  function paintCrop() {
    clampCrop(); var k = crop.base * crop.z;
    cimg.style.width = crop.w * k + 'px'; cimg.style.height = crop.h * k + 'px';
    cimg.style.transform = 'translate(calc(-50% + ' + crop.x + 'px), calc(-50% + ' + crop.y + 'px))';
  }
  zoom.addEventListener('input', function () { crop.z = +zoom.value; paintCrop(); });
  var pan = null;
  stage.tabIndex = 0;
  stage.addEventListener('pointerdown', function (e) { pan = { x: e.clientX, y: e.clientY, ox: crop.x, oy: crop.y }; stage.setPointerCapture(e.pointerId); });
  stage.addEventListener('pointermove', function (e) { if (!pan) return; crop.x = pan.ox + e.clientX - pan.x; crop.y = pan.oy + e.clientY - pan.y; paintCrop(); });
  stage.addEventListener('pointerup', function () { pan = null; });
  stage.addEventListener('keydown', function (e) {
    var d = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] }[e.key]; if (!d) return;
    e.preventDefault(); crop.x += d[0]; crop.y += d[1]; paintCrop();
  });
  $('[data-crop-use]').addEventListener('click', function () {
    var k = crop.base * crop.z, left = crop.S / 2 + crop.x - crop.w * k / 2, top = crop.S / 2 + crop.y - crop.h * k / 2;
    var c = document.createElement('canvas'); c.width = c.height = 512;
    c.getContext('2d').drawImage(cimg, -left / k, -top / k, crop.S / k, crop.S / k, 0, 0, 512, 512);
    closeDialog();
    c.toBlob(function (blob) { uploadPhoto(blob); }, 'image/jpeg', 0.9);
  });
  function setUploading(on) {
    $('[data-photo-busy]').hidden = !on;
    $('[data-photo-pick]').disabled = on; $('[data-photo-remove]').disabled = on;
    $('[data-photo-pick-label]').textContent = on ? 'Uploading…' : (card.photo ? 'Change photo' : 'Add photo');
  }
  function uploadPhoto(blob) {
    setUploading(true); announce('Uploading photo.');
    api.uploadPhoto(blob).then(function (r) {
      setUploading(false); card.photo = r.url; renderPhoto(); changed(); announce('Photo added.');
    }, function () {
      setUploading(false); photoError("The upload didn't finish. Check your connection and try again.");
    });
  }

  /* ---------- Autosave ---------- */
  var saveTick = 0;
  function scheduleSave(ms) { clearTimeout(saveT); saveT = setTimeout(doSave, ms); }
  function doSave() {
    var mine = ++saveTick;
    paintSave('saving');
    api.saveDraft(clone(card)).then(function () {
      if (mine !== saveTick) return;
      try { localStorage.setItem('wemet-draft', JSON.stringify({ email: session.email, pending: false, card: card })); } catch (e) {}
      paintSave('saved');
    }, function (err) {
      if (mine !== saveTick) return;
      if (err && err.code === 'unauthorized') { paintSave('error'); openDialog('session'); return; }
      paintSave('error');
    });
  }
  function paintSave(s) {
    var el = $('[data-save]');
    el.setAttribute('data-tone', s === 'error' ? 'bad' : '');
    if (s === 'saving') el.innerHTML = '<span class="ap-spin" aria-hidden="true"></span>Saving…';
    else if (s === 'saved') el.innerHTML = '<span class="ap-icon" data-icon="check" data-size="14" aria-hidden="true"></span>Saved';
    else el.innerHTML = "Couldn't save. <button type=\"button\" data-retry>Retry</button>";
    fillIcons(el);
    var r = $('[data-retry]', el); if (r) r.addEventListener('click', function () { scheduleSave(0); });
  }

  /* ---------- Publish ---------- */
  function dirty() { return !!published && JSON.stringify(card) !== JSON.stringify(published); }
  function blockers() {
    var out = [];
    if (slugEditing) out.push('tap the check to confirm your new link, or cancel');
    if (!card.name.trim()) out.push('add your name');
    if (!card.slug) out.push('choose your link');
    else if (['invalid', 'reserved', 'taken'].indexOf(slug.status) > -1) out.push('choose a link that works');
    else if (slug.status === 'checking' || slug.status === 'typing') out.push('wait for your link to be checked');
    var others = allKeys().filter(function (k) { return k !== 'slug' && k !== 'name' && errorFor(k); });
    if (others.length || (card.name.trim() && errorFor('name'))) out.push('fix the fields marked in red');
    return out;
  }
  function paintBar() {
    var btn = $('[data-publish]'), share = $('[data-share]');
    var st = !published ? 'draft' : dirty() ? 'changes' : 'live';
    share.hidden = !published;
    if (btn.getAttribute('aria-busy') !== 'true') { btn.disabled = st === 'live'; btn.setAttribute('data-state', st); if (st === 'live') btn.innerHTML = '<span class="ap-btn-dot" aria-hidden="true"></span>Published'; else btn.textContent = st === 'changes' ? 'Publish changes' : 'Publish'; btn.setAttribute('aria-label', st === 'live' ? 'Published, nothing new to publish' : btn.textContent); }
    if (!$('[data-blocked]').hidden) { var b = blockers(); if (!b.length) $('[data-blocked]').hidden = true; else $('[data-blocked-text]').textContent = sentence(b); }
    fitBar();
  }
  function fitBar() {
    requestAnimationFrame(function () { var bar = $('.ap-bar'), ed = $('[data-editor]'); if (bar && ed) ed.style.paddingBottom = (bar.offsetHeight + 32) + 'px'; });
  }
  window.addEventListener('resize', fitBar);
  function sentence(b) { var s = b.length > 1 ? b.slice(0, -1).join(', ') + ' and ' + b[b.length - 1] : b[0]; return 'To publish, ' + s + '.'; }
  $('[data-publish]').addEventListener('click', function () {
    tried = true; paintAll();
    var b = blockers();
    if (b.length) {
      $('[data-blocked]').hidden = false; fitBar(); $('[data-blocked-text]').textContent = sentence(b);
      $$('[data-field][data-invalid="true"]').forEach(function (f) { var s = f.closest('[data-sec]'); if (s) s.setAttribute('data-collapsed', 'false'); }); paintCollapse();
      var first = $('[data-field][data-invalid="true"] .ap-input') || (!card.name.trim() ? $('#f-name') : $('#f-slug'));
      if (first) { setTab('edit'); first.focus(); }
      return;
    }
    $('[data-blocked]').hidden = true;
    var btn = $('[data-publish]'); btn.setAttribute('aria-busy', 'true'); btn.disabled = true; btn.innerHTML = '<span class="ap-spin" aria-hidden="true"></span>Publishing…';
    api.publish(clone(card)).then(function (r) {
      btn.removeAttribute('aria-busy');
      published = clone(card); slug = { status: 'mine', value: card.slug };
      paintSlug(); paintBar();
      var url = r.url || ('https://we-met.link/hi/' + card.slug);
      $('[data-pub-url]').textContent = url.replace(/^https:\/\//, '');
      $('[data-pub-open]').href = url;
      $('[data-copy-label]').textContent = 'Copy link';
      $('#pub-title').textContent = 'Your card is live';
      openDialog('published', btn);
      announce('Your card is live.');
    }, function () {
      btn.removeAttribute('aria-busy'); paintBar();
      $('[data-blocked]').hidden = false; fitBar(); $('[data-blocked-text]').textContent = "Something went wrong on our end and your card wasn't published. Your changes are saved. Try again?";
    });
  });
  function openShare(opener) {
    var url = 'https://we-met.link/hi/' + published.slug;
    $('#pub-title').textContent = 'Share your card';
    $('[data-pub-url]').textContent = url.replace(/^https:\/\//, '');
    $('[data-pub-open]').href = url;
    $('[data-copy-label]').textContent = 'Copy link';
    openDialog('published', opener);
  }
  $('[data-share]').addEventListener('click', function (e) { if (published) openShare(e.currentTarget); });
  $('[data-copy]').addEventListener('click', function () {
    var url = $('[data-pub-open]').href;
    var done = function () { $('[data-copy-label]').textContent = 'Copied'; $('[data-copy-status]').textContent = 'Link copied.'; };
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, done); else done();
  });

  /* ---------- Dialogs ---------- */
  var openDlg = null, dlgOpener = null;
  function openDialog(name, opener) {
    closeMenu();
    openDlg = $('[data-dialog="' + name + '"]'); dlgOpener = opener || document.activeElement;
    openDlg.hidden = false; document.body.style.overflow = 'hidden';
    var f = $('[data-crop-stage], .ap-panel button:not([disabled]), .ap-panel a', openDlg); if (f) f.focus({ preventScroll: true });
  }
  function closeDialog() {
    if (!openDlg) return;
    openDlg.hidden = true; document.body.style.overflow = ''; openDlg = null;
    if (dlgOpener && dlgOpener.focus) dlgOpener.focus({ preventScroll: true });
  }
  $$('[data-dialog-close]').forEach(function (b) { b.addEventListener('click', closeDialog); });
  document.addEventListener('keydown', function (e) {
    if (!openDlg) return;
    if (e.key === 'Escape' && openDlg.getAttribute('data-dialog') !== 'session') { e.preventDefault(); closeDialog(); }
    if (e.key === 'Tab') {
      var f = $$('button:not([disabled]), a[href], input, [tabindex="0"]', openDlg).filter(function (el) { return el.offsetParent !== null; });
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });

  /* ---------- Collapsible sections (below 900px) ---------- */
  var wideMq = window.matchMedia ? window.matchMedia('(min-width: 900px)') : { matches: false };
  function paintCollapse() {
    var wide = wideMq.matches;
    $$('[data-sec]').forEach(function (sec) { $('[data-sec-toggle]', sec).setAttribute('aria-expanded', String(wide || sec.getAttribute('data-collapsed') !== 'true')); });
  }
  if (wideMq.addEventListener) wideMq.addEventListener('change', paintCollapse);
  form.addEventListener('click', function (e) {
    var st = e.target.closest('[data-sec-toggle]');
    if (wideMq.matches) return;
    if (st) { var sec = st.closest('[data-sec]'); sec.setAttribute('data-collapsed', String(sec.getAttribute('data-collapsed') !== 'true')); paintCollapse(); }
  });

  /* ---------- Tabs (below 900px) ---------- */
  function setTab(t) {
    $('[data-editor]').setAttribute('data-tab', t);
    $$('[data-tab]', $('.ap-seg')).forEach(function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-tab') === t)); b.tabIndex = b.getAttribute('data-tab') === t ? 0 : -1; });
    if (t === 'preview') renderPreview(true);
  }
  $$('.ap-seg [data-tab]').forEach(function (b) {
    b.addEventListener('click', function () { setTab(b.getAttribute('data-tab')); });
    b.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { var t = b.getAttribute('data-tab') === 'edit' ? 'preview' : 'edit'; setTab(t); $('.ap-seg [data-tab="' + t + '"]').focus(); } });
  });

  /* ---------- Live preview: the real design/card/card.html, fed the form values ---------- */
  var cardSrc = null, lastPreview = '';
  function cardData() {
    return {
      plan: 'free',
      name: card.name.trim(),
      greeting: card.name.trim() ? '' : 'Your name here',
      role: card.role.trim(),
      photo: card.photo,
      about: { title: 'About me', paragraphs: card.about.map(function (p) { return p.trim(); }).filter(Boolean) },
      services: { title: 'What I do', items: card.services.filter(function (s) { return s.title.trim(); }).map(function (s) { return { title: s.title.trim(), description: s.description.trim() }; }) },
      links: clone(card.links),
      alternate: card.alternate.url.trim() && card.alternate.label.trim() ? { url: card.alternate.url.trim(), label: card.alternate.label.trim() } : null
    };
  }
  function renderPreview(force) {
    if (!card) return;
    var frame = $('[data-frame]'); if (!frame || frame.offsetParent === null && !force) return;
    if (!cardSrc) { fetch('../card/card.html').then(function (r) { return r.text(); }).then(function (t) { cardSrc = t; renderPreview(true); }); return; }
    var json = JSON.stringify(cardData(), null, 2).replace(/</g, '\\u003c');
    var key = json + theme(); if (key === lastPreview && !force) return; lastPreview = key;
    var base = new URL('../card/', location.href).href;
    var html = cardSrc
      .replace('<head>', '<head><base href="' + base + '">')
      .replace(/(<script type="application\/json" id="card-data">)[\s\S]*?(<\/script>)/, function (m, a, b) { return a + json + b; })
      .replace('<script src="card.js"></script>', '<script>window.WeMetCardPreview=true;window.WeMetCardTheme="' + theme() + '";</script><script src="card.js"></script>');
    var ifr = $$('iframe', frame), front = ifr[0].getAttribute('data-front') === 'true' ? ifr[0] : ifr[1], back = front === ifr[0] ? ifr[1] : ifr[0];
    var y = 0; try { y = front.contentWindow.scrollY || 0; } catch (e) {}
    back.onload = function () {
      try { back.contentWindow.scrollTo(0, y); } catch (e) {}
      back.setAttribute('data-front', 'true'); back.tabIndex = 0; back.removeAttribute('aria-hidden');
      front.setAttribute('data-front', 'false'); front.tabIndex = -1; front.setAttribute('aria-hidden', 'true');
    };
    back.srcdoc = html;
  }
  window.addEventListener('resize', function () { renderPreview(false); });

  /* ---------- Start ---------- */
  var demoAfter = null;
  syncTheme();
  api.getSession().then(function (s) { session = s; route(); if (!s && demoLogin) demoLogin(); });

  /* ===== Preview states for the design canvas (safe to delete) =====
     ?state= login | login-signing | login-error | closed | empty | filled (default) | draft | errors | crop | uploading |
             upload-error | saving | save-error | slug-checking | slug-available | slug-taken | slug-invalid | slug-reserved |
             slug-change | publish-blocked | published | unpublished | session-expired | menu | preview      &theme=light|dark */
  var demoLogin = null;
  if (demo) {
    reduced = true;
    demoLogin = function () {
      if (demo === 'login-signing') setSigningIn(true);
      if (demo === 'login-error') $('[data-login-error]').hidden = false;
    };
    demoAfter = function () {
      var setSlug = function (v) { var el = $('#f-slug'); el.value = v; card.slug = v; onSlugInput(); clearTimeout(slugT); checkSlugNow(v); };
      if (demo === 'slug-available') setSlug('didi-s');
      if (demo === 'slug-taken') setSlug('sam');
      if (demo === 'slug-invalid') setSlug('didi_s');
      if (demo === 'slug-reserved') setSlug('app');
      if (demo === 'slug-checking') setSlug('didi-shoukralla');
      if (demo === 'slug-change') { slug = { status: 'available', value: card.slug }; paintSlug(); }
      if (demo === 'slug-unlocked') { $('[data-slug-action]').click(); var el2 = $('#f-slug'); el2.value = 'didi-shoukralla'; card.slug = 'didi-shoukralla'; onSlugInput(); clearTimeout(slugT); checkSlugNow('didi-shoukralla'); }
      if (demo === 'collapsed') { $$('[data-sec]').forEach(function (s, k) { if (k !== 3) s.setAttribute('data-collapsed', 'true'); }); paintCollapse(); setTimeout(function () { var s = $('#sec-services'); if (s) window.scrollTo(0, s.getBoundingClientRect().top + scrollY - 140); }, 50); }
      if (demo === 'share') openShare($('[data-share]'));
      if (demo === 'errors') {
        card.name = ''; card.role = 'Software engineer, technical advisor and fractional CTO for early-stage founders who built with AI tools';
        card.about[0] = card.about[0] + ' ' + card.about[0] + ' ' + card.about[0] + ' ' + card.about[0].slice(0, 80);
        card.services[1].title = 'Custom development for web and mobile apps';
        card.services.push({ title: '', description: 'Workshops for small teams.' });
        card.links.github = 'github.com/DiademShoukralla'; card.links.instagram = 'http://instagram.com/didi.build';
        card.alternate.label = 'Book a free 30-minute consultation with me any weekday'; card.alternate.url = '';
        fillForm(); tried = true; paintAll();
        $('[data-blocked]').hidden = false; fitBar(); $('[data-blocked-text]').textContent = sentence(blockers());
      }
      if (demo === 'publish-blocked') $('[data-publish]').click();
      if (demo === 'crop') openCrop(sample.card.photo);
      if (demo === 'uploading') { setUploading(true); }
      if (demo === 'upload-error') photoError("The upload didn't finish. Check your connection and try again.");
      if (demo === 'saving') paintSave('saving');
      if (demo === 'save-error') paintSave('error');
      if (demo === 'session-expired') openDialog('session');
      if (demo === 'menu') { menu.hidden = false; menuBtn.setAttribute('aria-expanded', 'true'); }
      if (demo === 'preview') setTab('preview');
      if (demo === 'published') {
        published = clone(card); paintBar();
        $('[data-pub-url]').textContent = 'we-met.link/hi/' + card.slug; $('[data-pub-open]').href = 'https://we-met.link/hi/' + card.slug;
        openDialog('published', $('[data-publish]'));
      }
      if (document.activeElement && document.activeElement.blur && demo !== 'crop') document.activeElement.blur();
    };
  }
})();
