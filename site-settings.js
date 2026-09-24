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

   Sync (Tim, 2026-09-24): all three follow the reader across devices through
   /api/prefs once a device has opened its sync link (settings.html#sync=…).
   localStorage stays the working copy, so pages never wait on the network;
   each setting carries the time it was set, and the newer copy wins. Pages
   hear about changes through the `book-summaries-settings` event. */
(function () {
  'use strict';

  var KEY = 'book-summaries-text-scale';
  var FONT_KEY = 'book-summaries-font';
  var PIN_KEY = 'book-summaries-pinned';
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

  /* ---------- pins ---------- */

  function cleanPins(list) {
    var seen = {};
    return (Array.isArray(list) ? list : []).filter(function (slug) {
      if (typeof slug !== 'string' || !SLUG.test(slug) || seen[slug]) return false;
      return (seen[slug] = true);
    });
  }
  function readPins() {
    var saved = null;
    try { saved = JSON.parse(getItem(PIN_KEY)); } catch (e) {}
    return cleanPins(saved);
  }
  function storePins(list) {
    setItem(PIN_KEY, list.length ? JSON.stringify(list) : null);
  }
  function writePins(list) {
    list = cleanPins(list);
    if (JSON.stringify(list) !== JSON.stringify(readPins())) { storePins(list); changed('pins'); }
    return list;
  }

  /* ---------- sync ---------- */

  var NAMES = ['textScale', 'font', 'pins'];
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
      pins: { value: readPins(), t: t.pins || 0 }
    };
  }
  /* take each remote setting that is newer than ours; report whether ours has newer ones */
  function adopt(state) {
    if (!state) return false;
    var t = times(), took = [], ahead = false;
    NAMES.forEach(function (name) {
      var remote = state[name], mine = t[name] || 0;
      if (remote && remote.t > mine) {
        if (name === 'textScale') storeScale(clamp(remote.value));
        if (name === 'font') storeFont(fontById(remote.value).id);
        if (name === 'pins') storePins(cleanPins(remote.value));
        stamp(name, remote.t);
        took.push(name);
      } else if (mine > ((remote && remote.t) || 0)) {
        ahead = true;
      }
    });
    if (took.length) notify(took);
    return ahead;
  }
  function call(query, body, keepalive) {
    if (!window.fetch) return Promise.reject(new Error('This browser can’t sync.'));
    return fetch(API + query, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
      cache: 'no-store',
      keepalive: !!keepalive
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
  function push(keepalive) {
    clearTimeout(pushTimer);
    pushTimer = null;
    if (!syncing()) return Promise.resolve(false);
    return call('', { action: 'push', state: snapshot() }, keepalive).then(function (data) {
      if (data.sync) adopt(data.state);
      return !!data.sync;
    }, function () { return false; });
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
    var keys = event.key === null ? NAMES
      : event.key === KEY ? ['textScale'] : event.key === FONT_KEY ? ['font'] : event.key === PIN_KEY ? ['pins'] : [];
    if (keys.indexOf('textScale') > -1) apply(read());
    if (keys.indexOf('font') > -1) applyFont(readFont());
    if (keys.length) notify(keys);
  });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') pull();
    else flush();
  });
  window.addEventListener('pagehide', flush);
  window.addEventListener('pageshow', function (event) { if (event.persisted) pull(); });

  window.bookSummarySettings = {
    textScale: read, setTextScale: write, min: MIN, max: MAX,
    font: readFont, setFont: writeFont, fonts: FONTS,
    pins: readPins, setPins: writePins,
    event: EVENT,
    sync: { on: syncing, enable: enable, link: link, disable: disable, pull: pull, joining: joining }
  };
})();
