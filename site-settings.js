/* site-settings.js — reader settings shared by every page on the site.

   Loaded synchronously at the end of <head> on every page (tools/sync.py adds
   the tag), so the saved settings apply before the first paint. Change them on
   settings.html; every open tab follows through the storage event.

   Text size: the pages size their type in a mix of px, rem and vw, so the scale
   is applied as CSS `zoom` on <html>: the one lever that resizes text on all of
   them.

   Font: every page draws its text from two tokens, `--body` and `--display`,
   declared on :root. A chosen font redeclares both on <body>, so all reading
   text and headings follow it. SVG plates keep the book's own fonts: FIG.fit
   measures their labels to lay them out, so a different face would overflow
   them. `--label` and `--mono` (the small UI captions) are left alone. */
(function () {
  'use strict';

  var KEY = 'book-summaries-text-scale';
  var MIN = 0.8;
  var MAX = 1.6;
  var FONT_KEY = 'book-summaries-font';
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

  function clamp(value) {
    value = Math.round(value * 100) / 100;
    return value < MIN ? MIN : value > MAX ? MAX : value;
  }

  function read() {
    try {
      var value = parseFloat(localStorage.getItem(KEY));
      return isFinite(value) && value > 0 ? clamp(value) : 1;
    } catch (e) {
      return 1;
    }
  }

  function apply(value) {
    root.style.zoom = value === 1 ? '' : String(value);
  }

  function write(value) {
    value = clamp(value);
    try {
      if (value === 1) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, String(value));
    } catch (e) {}
    apply(value);
    return value;
  }

  function fontById(id) {
    for (var i = 0; i < FONTS.length; i++) if (FONTS[i].id === id) return FONTS[i];
    return FONTS[0];
  }

  function readFont() {
    try {
      return fontById(localStorage.getItem(FONT_KEY)).id;
    } catch (e) {
      return 'book';
    }
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

  function writeFont(id) {
    id = fontById(id).id;
    try {
      if (id === 'book') localStorage.removeItem(FONT_KEY);
      else localStorage.setItem(FONT_KEY, id);
    } catch (e) {}
    applyFont(id);
    return id;
  }

  apply(read());
  applyFont(readFont());
  window.addEventListener('storage', function (event) {
    if (event.key === KEY || event.key === null) apply(read());
    if (event.key === FONT_KEY || event.key === null) applyFont(readFont());
  });

  window.bookSummarySettings = {
    textScale: read, setTextScale: write, min: MIN, max: MAX,
    font: readFont, setFont: writeFont, fonts: FONTS
  };
})();
