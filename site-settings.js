/* site-settings.js — reader settings shared by every page on the site.

   Loaded synchronously at the end of <head> on every page (tools/sync.py adds
   the tag), so the saved text size applies before the first paint. The pages
   size their type in a mix of px, rem and vw, so the scale is applied as CSS
   `zoom` on <html>: the one lever that resizes text on all of them. Change it
   on settings.html; every open tab follows through the storage event. */
(function () {
  'use strict';

  var KEY = 'book-summaries-text-scale';
  var MIN = 0.8;
  var MAX = 1.6;
  var root = document.documentElement;

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

  apply(read());
  window.addEventListener('storage', function (event) {
    if (event.key === KEY || event.key === null) apply(read());
  });

  window.bookSummarySettings = { textScale: read, setTextScale: write, min: MIN, max: MAX };
})();
