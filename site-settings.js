/* site-settings.js — reader settings shared by every page on the site.

   Loaded synchronously at the end of <head> on every page (tools/sync.py adds
   the tag), so the saved settings apply before the first paint. Change them on
   settings.html (pins on the index); every open tab follows.

   Text size: the pages size their type in a mix of px, rem and vw, so the scale
   is applied as CSS `zoom` on <html>: the one lever that resizes text on all of
   them.

   Font: every page draws its text from two tokens, `--body` and `--display`,
   declared on :root. A chosen font redeclares both on <body>, so all reading
   text and headings follow it. SVG plates keep the book's own fonts: FIG.fit
   measures their labels to lay them out, so a different face would overflow
   them. `--label` and `--mono` (the small UI captions) are left alone.

   Pins: the books on the index's "Currently reading" shelf, newest first.
   Bookmarks: saved spots inside a book (book-bookmarks.js draws them).

   Sync (Tim, 2026-09-24): all of it follows the reader across devices through
   /api/prefs once a device has opened its sync link (settings.html#sync=…).
   localStorage stays the working copy, so pages never wait on the network.
   Text size and font carry the time they were set and the newer one wins;
   pins and bookmarks merge item by item. Pages hear about changes through the
   `book-summaries-settings` event. */
(function () {
  'use strict';

  var KEY = 'book-summaries-text-scale';
  var FONT_KEY = 'book-summaries-font';
  var PIN_KEY = 'book-summaries-pinned';      /* the first pin format, migrated below */
  var PINSET_KEY = 'book-summaries-pinset';
  var MARK_KEY = 'book-summaries-bookmarks';
  var TIMES_KEY = 'book-summaries-set-at';
  var EVENT = 'book-summaries-settings';
  var API = '/api/prefs';
  var MIN = 0.8;
  var MAX = 1.6;
  var SLUG = /^[a-z0-9][a-z0-9-]*\.html$/;
  var GF = 'https://fonts.googleapis.com/css2?family=';
  var root = document.documentElement;

  /* `book` is the default: each page keeps the pairing designed for it. */
  var FONTS = [
    { id: 'book', name: 'Each book’s own', note: 'The fonts chosen for each summary' },
    { id: 'literata', name: 'Literata', note: 'Serif made for long reading on screens',
      stack: '"Literata", Georgia, serif',
      css: GF + 'Literata:ital,opsz,wght@0,7..72,400..700;1,7..72,400..700&display=swap' },
    { id: 'classic', name: 'Classic serif', note: 'Iowan Old Style, the Apple Books serif',
      stack: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif' },
    { id: 'hyperlegible', name: 'Atkinson Hyperlegible', note: 'Sans serif built for legibility',
      stack: '"Atkinson Hyperlegible Next", "Atkinson Hyperlegible", system-ui, sans-serif',
      css: GF + 'Atkinson+Hyperlegible+Next:ital,wght@0,400..700;1,400..700&display=swap' },
    { id: 'system', name: 'System sans', note: 'Your device’s own interface font',
      stack: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }
  ];

  /* ---------- local copy: any storage call can throw (private mode, blocked storage) ---------- */

  function getItem(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function setItem(key, value) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch (e) {}
  }
  function times() {
    try { return JSON.parse(getItem(TIMES_KEY)) || {}; } catch (e) { return {}; }
  }
  function stamp(name, t) {
    var all = times();
    all[name] = t;
    setItem(TIMES_KEY, JSON.stringify(all));
  }
  function notify(keys) {
    var event;
    try {
      event = new CustomEvent(EVENT, { detail: { keys: keys } });
    } catch (e) {
      event = document.createEvent('CustomEvent');
      event.initCustomEvent(EVENT, false, false, { keys: keys });
    }
    window.dispatchEvent(event);
  }
  /* a setting the reader just changed: time it, tell the page, queue the upload */
  function changed(name) {
    stamp(name, Date.now());
    notify([name]);
    schedulePush();
  }

  /* ---------- text size ---------- */

  function clamp(value) {
    value = Math.round(value * 100) / 100;
    return value < MIN ? MIN : value > MAX ? MAX : value;
  }
  function read() {
    var value = parseFloat(getItem(KEY));
    return isFinite(value) && value > 0 ? clamp(value) : 1;
  }
  function apply(value) {
    root.style.zoom = value === 1 ? '' : String(value);
  }
  function storeScale(value) {
    setItem(KEY, value === 1 ? null : String(value));
    apply(value);
  }
  function write(value) {
    value = clamp(value);
    if (value !== read()) { storeScale(value); changed('textScale'); }
    return value;
  }

  /* ---------- font ---------- */

  function fontById(id) {
    for (var i = 0; i < FONTS.length; i++) if (FONTS[i].id === id) return FONTS[i];
    return FONTS[0];
  }
  function readFont() {
    return fontById(getItem(FONT_KEY)).id;
  }
  function applyFont(id) {
    var font = fontById(id);
    var head = document.head || root;
    var style = document.getElementById('site-font');
    if (font.css && !document.querySelector('link[data-site-font="' + font.id + '"]')) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = font.css;
      link.setAttribute('data-site-font', font.id);
      head.appendChild(link);
    }
    if (!font.stack) {
      if (style) style.textContent = '';
      return;
    }
    if (!style) {
      style = document.createElement('style');
      style.id = 'site-font';
      head.appendChild(style);
    }
    /* :root still holds the page's own fonts, so --book-* carry them down to the plates */
    style.textContent =
      ':root{--book-body:var(--body);--book-display:var(--display)}' +
      'body{--body:' + font.stack + '!important;--display:' + font.stack + '!important}' +
      'body svg{--body:var(--book-body)!important;--display:var(--book-display)!important}';
  }
  function storeFont(id) {
    setItem(FONT_KEY, id === 'book' ? null : id);
    applyFont(id);
  }
  function writeFont(id) {
    id = fontById(id).id;
    if (id !== readFont()) { storeFont(id); changed('font'); }
    return id;
  }

  /* ---------- sets: pins and bookmarks ----------
     Each is a map of id → { t, … }. A removal stays as a dated tombstone (pins
     `on: 0`, bookmarks `d: 1`) so it can reach the other devices; merging keeps
     the newer copy of each item, so adds on two devices never overwrite each other. */

  function readItems(key) {
    var saved = null;
    try { saved = JSON.parse(getItem(key)); } catch (e) {}
    return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  }
  function storeItems(key, items) {
    var cutoff = Date.now() - 180 * 864e5, kept = {};
    Object.keys(items).forEach(function (id) {
      var v = items[id];
      if (!v || typeof v.t !== 'number') return;
      if ((v.on === 0 || v.d) && v.t < cutoff) return;  /* an old removal has reached everyone */
      kept[id] = v;
    });
    setItem(key, Object.keys(kept).length ? JSON.stringify(kept) : null);
  }
  function mergeItems(mine, theirs) {
    var out = {}, changed = false;
    Object.keys(mine).forEach(function (id) { out[id] = mine[id]; });
    Object.keys(theirs || {}).forEach(function (id) {
      var v = theirs[id];
      if (v && typeof v.t === 'number' && (!out[id] || v.t > out[id].t)) { out[id] = v; changed = true; }
    });
    return { items: out, changed: changed };
  }
  function aheadOf(mine, theirs) {
    theirs = theirs || {};
    return Object.keys(mine).some(function (id) { return !theirs[id] || mine[id].t > theirs[id].t; });
  }

  /* pins: slug → { t, on }; the list is the pinned ones, newest pin first */
  function readPins() {
    var items = readItems(PINSET_KEY);
    return Object.keys(items)
      .filter(function (slug) { return items[slug].on && SLUG.test(slug); })
      .sort(function (a, b) { return items[b].t - items[a].t; });
  }
  function writePins(list) {
    var items = readItems(PINSET_KEY), now = Date.now(), before = readPins(), touched = false, seen = {};
    list = (Array.isArray(list) ? list : []).filter(function (slug) {
      if (typeof slug !== 'string' || !SLUG.test(slug) || seen[slug]) return false;
      return (seen[slug] = true);
    });
    /* only the books whose state changed get a new time; a new pin goes to the top */
    list.forEach(function (slug, i) {
      if (before.indexOf(slug) === -1) { items[slug] = { t: now - i, on: 1 }; touched = true; }
    });
    before.forEach(function (slug) {
      if (list.indexOf(slug) === -1) { items[slug] = { t: now, on: 0 }; touched = true; }
    });
    if (touched) { storeItems(PINSET_KEY, items); changed('pins'); }
    return readPins();
  }

  /* bookmarks: id → { b: book slug, i: block index, f: fraction through it, s: section id,
     x: opening words, l: section label, n: book title, c: created, t: last change, d: deleted } */
  function readBookmarks(slug) {
    var items = readItems(MARK_KEY);
    return Object.keys(items)
      .filter(function (id) { return !items[id].d && (!slug || items[id].b === slug); })
      .map(function (id) {
        var v = items[id], copy = { id: id };
        Object.keys(v).forEach(function (k) { copy[k] = v[k]; });
        return copy;
      })
      .sort(function (a, b) { return (b.c || b.t) - (a.c || a.t); });
  }
  function newId() {
    var bytes = new Uint8Array(8), out = '';
    try { crypto.getRandomValues(bytes); } catch (e) { for (var j = 0; j < 8; j++) bytes[j] = Math.random() * 256; }
    for (var i = 0; i < bytes.length; i++) out += (bytes[i] % 36).toString(36);
    return out + Date.now().toString(36).slice(-4);
  }
  function addBookmark(fields) {
    var items = readItems(MARK_KEY), now = Date.now(), id = newId();
    items[id] = {
      b: fields.b, i: fields.i | 0, f: Math.min(Math.max(+fields.f || 0, 0), 1),
      s: fields.s || '', x: String(fields.x || '').slice(0, 120), l: String(fields.l || '').slice(0, 160),
      n: String(fields.n || '').slice(0, 160), c: now, t: now
    };
    storeItems(MARK_KEY, items);
    changed('bookmarks');
    return id;
  }
  function removeBookmark(id) {
    var items = readItems(MARK_KEY);
    if (!items[id] || items[id].d) return;
    items[id] = { b: items[id].b, t: Date.now(), d: 1 };
    storeItems(MARK_KEY, items);
    changed('bookmarks');
  }

  /* the first pins were a plain list; carry them over once, keeping their order */
  (function migratePins() {
    var old = null;
    try { old = JSON.parse(getItem(PIN_KEY)); } catch (e) {}
    if (!Array.isArray(old)) return;
    if (!getItem(PINSET_KEY)) {
      var items = {}, base = times().pins || Date.now();
      old.forEach(function (slug, i) {
        if (typeof slug === 'string' && SLUG.test(slug) && !items[slug]) items[slug] = { t: base - i, on: 1 };
      });
      storeItems(PINSET_KEY, items);
    }
    setItem(PIN_KEY, null);
  })();

  /* ---------- sync ---------- */

  var pushTimer = null;
  var lastPull = 0;

  /* the server-set flag cookie outlives Safari's 7-day purge of script storage */
  function syncing() {
    return /(?:^|;\s*)bs_sync_on=1(?:;|$)/.test(document.cookie || '');
  }
  function snapshot() {
    var t = times();
    return {
      textScale: { value: read(), t: t.textScale || 0 },
      font: { value: readFont(), t: t.font || 0 },
      pins: { items: readItems(PINSET_KEY) },
      bookmarks: { items: readItems(MARK_KEY) }
    };
  }
  /* take everything remote that is newer than ours; report whether ours has anything newer */
  function adopt(state) {
    if (!state) return false;
    var t = times(), took = [], ahead = false;
    ['textScale', 'font'].forEach(function (name) {
      var remote = state[name], mine = t[name] || 0;
      if (remote && remote.t > mine) {
        if (name === 'textScale') storeScale(clamp(remote.value));
        if (name === 'font') storeFont(fontById(remote.value).id);
        stamp(name, remote.t);
        took.push(name);
      } else if (mine > ((remote && remote.t) || 0)) {
        ahead = true;
      }
    });
    [['pins', PINSET_KEY], ['bookmarks', MARK_KEY]].forEach(function (pair) {
      var name = pair[0], key = pair[1], mine = readItems(key),
          theirs = state[name] && state[name].items || {},
          merged = mergeItems(mine, theirs);
      if (merged.changed) { storeItems(key, merged.items); took.push(name); }
      if (aheadOf(mine, theirs)) ahead = true;
    });
    if (took.length) notify(took);
    return ahead;
  }
  function call(query, body, keepalive) {
    if (!window.fetch) return Promise.reject(new Error('This browser can’t sync.'));
    var payload = body ? JSON.stringify(body) : undefined;
    return fetch(API + query, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: payload,
      credentials: 'same-origin',
      cache: 'no-store',
      /* browsers refuse keepalive bodies over 64 KB; a big one goes as a normal request */
      keepalive: !!keepalive && (!payload || payload.length < 60000)
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (data) {
        if (!response.ok) throw new Error(data.error || 'Sync is unavailable right now.');
        return data;
      });
    });
  }
  function pull(force) {
    if (!syncing()) return Promise.resolve(false);
    if (!force && Date.now() - lastPull < 10000) return Promise.resolve(true);
    lastPull = Date.now();
    return call('', null).then(function (data) {
      if (data.sync && adopt(data.state)) push();
      return !!data.sync;
    }, function () { return false; });
  }
  function schedulePush() {
    if (!syncing()) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () { push(); }, 700);
  }
  /* an upload that fails (offline, or losing a write race on the server) is
     retried on its own; the change is safe in localStorage meanwhile */
  var RETRY_MS = [2000, 5000, 15000, 30000];
  var retries = 0;
  var retryTimer = null;
  function push(keepalive) {
    clearTimeout(pushTimer);
    clearTimeout(retryTimer);
    pushTimer = null;
    if (!syncing()) return Promise.resolve(false);
    return call('', { action: 'push', state: snapshot() }, keepalive).then(function (data) {
      retries = 0;
      if (data.sync) adopt(data.state);
      return !!data.sync;
    }, function () {
      retryTimer = setTimeout(function () { push(); }, RETRY_MS[Math.min(retries, RETRY_MS.length - 1)]);
      retries++;
      return false;
    });
  }
  function flush() {
    if (pushTimer) push(true);
  }
  /* first device: store this browser's settings and get a link for the others */
  function enable() {
    return call('', { action: 'create', state: snapshot() }).then(function (data) {
      adopt(data.state);
      return data;
    });
  }
  function join(code) {
    return call('', { action: 'join', code: code, state: snapshot() }).then(function (data) {
      adopt(data.state);
      return { ok: true };
    }, function (err) {
      return { ok: false, error: err.message };
    });
  }
  function link() {
    return call('?link=1', null).then(function (data) {
      if (data.sync) adopt(data.state);
      return data.link || null;
    });
  }
  function disable() {
    clearTimeout(pushTimer);
    pushTimer = null;
    return call('', { action: 'leave' });
  }

  /* ---------- start ---------- */

  apply(read());
  applyFont(readFont());

  /* a text size or font chosen before sync existed has no time, so no device
     would ever count it as newer; date it now so it can reach the others */
  (function dateOldSettings() {
    var t = times();
    if (!t.textScale && read() !== 1) stamp('textScale', Date.now());
    if (!t.font && readFont() !== 'book') stamp('font', Date.now());
  })();

  var joining = null;
  var match = /^#sync=([A-Za-z0-9_-]{22,64})$/.exec(location.hash || '');
  if (match) {
    /* take the code out of the address bar and history before anything else */
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
    joining = join(match[1]);
  } else {
    pull(true);
  }

  window.addEventListener('storage', function (event) {
    var byKey = {}, keys;
    byKey[KEY] = 'textScale'; byKey[FONT_KEY] = 'font'; byKey[PINSET_KEY] = 'pins'; byKey[MARK_KEY] = 'bookmarks';
    keys = event.key === null ? ['textScale', 'font', 'pins', 'bookmarks'] : byKey[event.key] ? [byKey[event.key]] : [];
    if (keys.indexOf('textScale') > -1) apply(read());
    if (keys.indexOf('font') > -1) applyFont(readFont());
    if (keys.length) notify(keys);
  });
  /* pick up the other devices' changes whenever this page comes back into use:
     a tab switch, a window switch (desktop), a page restored from the back cache,
     and once a minute while it stays on screen */
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') pull();
    else flush();
  });
  window.addEventListener('focus', function () { pull(); });
  window.addEventListener('pagehide', flush);
  window.addEventListener('pageshow', function (event) { if (event.persisted) pull(); });
  setInterval(function () {
    if (document.visibilityState === 'visible') pull(true);
  }, 60000);

  window.bookSummarySettings = {
    textScale: read, setTextScale: write, min: MIN, max: MAX,
    font: readFont, setFont: writeFont, fonts: FONTS,
    pins: readPins, setPins: writePins,
    bookmarks: readBookmarks, addBookmark: addBookmark, removeBookmark: removeBookmark,
    event: EVENT,
    sync: { on: syncing, enable: enable, link: link, disable: disable, pull: pull, joining: joining }
  };
})();
