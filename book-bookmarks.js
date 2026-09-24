/* book-bookmarks.js — bookmarks inside the summaries (Tim, 2026-09-24:
   "bookmark different sections of different books and then jump to them easily").

   On a summary page a ribbon button joins the top bar. It opens a panel with
   "Bookmark this spot" (the paragraph at the top of the screen when you opened
   it), this book's bookmarks, then every other book's. A bookmark shows as a
   small ribbon in the margin; tapping one in the panel jumps straight there,
   or opens the other book at that spot (<slug>.html#bm=<id>). The index gets
   the same button with the whole list.

   Where a bookmark points: the reading blocks of <main> (paragraphs, list
   items, headings…) in document order. It stores the block's index, its
   opening words and how far down the block the screen's top edge was. The
   words find it again after a page is edited or on a device laid out
   differently; the index breaks ties and is the fallback.

   Storage and sync belong to site-settings.js (bookmarks / addBookmark /
   removeBookmark), which merges them across devices item by item. */
(function () {
  'use strict';

  var S = window.bookSummarySettings;
  if (!S || !S.bookmarks) return;

  var slug = decodeURIComponent(location.pathname.split('/').pop() || '') || 'index.html';
  var main = document.querySelector('main.content');
  var chromeEnd = document.querySelector('.chrome__end');
  var corner = document.querySelector('.corner');
  var onBook = !!(main && chromeEnd);
  if (!onBook && !corner) return;

  var BLOCKS = 'p, li, h2, h3, h4, blockquote, dt, dd, figcaption, td, th, pre';
  var RIBBON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.2h8v11.6l-4-3-4 3z"/></svg>';
  var root = document.documentElement;

  function norm(el) { return (el.textContent || '').replace(/\s+/g, ' ').trim(); }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }

  /* ---------- where things are on a book page ---------- */

  /* the reading blocks, innermost only (a <li> holding <p>s counts as its <p>s) */
  function blocks() {
    return Array.prototype.filter.call(main.querySelectorAll(BLOCKS), function (el) {
      return !el.closest('svg') && !el.querySelector(BLOCKS) && norm(el);
    });
  }

  /* the sections the rail lists, in document order, with their labels */
  var sections = null;
  function railSections() {
    if (sections) return sections;
    sections = [];
    Array.prototype.forEach.call(document.querySelectorAll('.rail a[href^="#"]'), function (a) {
      var target = document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1)));
      if (!target) return;
      var n = a.querySelector('.n'), num = n ? norm(n) : '', name = norm(a);
      if (num && name.indexOf(num) === 0) name = name.slice(num.length).trim();
      sections.push({ id: target.id, el: target, label: num ? num + ' · ' + name : name });
    });
    sections.sort(function (a, b) {
      return a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });
    return sections;
  }
  function sectionOf(el) {
    var found = null;
    railSections().forEach(function (s) {
      if (s.el === el || s.el.contains(el) || s.el.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) found = s;
    });
    return found;
  }

  /* the line under the top bar where reading starts */
  function topLine() {
    var chrome = document.querySelector('.chrome');
    return (chrome ? Math.max(chrome.getBoundingClientRect().bottom, 0) : 0) + 8;
  }

  function bookTitle() {
    var og = document.querySelector('meta[property="og:title"]');
    var title = og ? og.getAttribute('content') : document.title;
    return title.split(' — ')[0].trim();
  }

  /* the block at the top of the screen, and how far into it the screen starts */
  function capture() {
    var list = blocks(), line = topLine();
    for (var i = 0; i < list.length; i++) {
      var r = list[i].getBoundingClientRect();
      if (!r.height || r.bottom <= line + 4) continue;
      var section = sectionOf(list[i]);
      return {
        el: list[i],
        b: slug,
        i: i,
        f: r.top < line ? Math.min((line - r.top) / r.height, 0.98) : 0,
        s: section ? section.id : '',
        l: section ? section.label : 'Start',
        x: norm(list[i]).slice(0, 80),
        n: bookTitle()
      };
    }
    return null;
  }

  /* find a bookmark's block: by its opening words (nearest to the stored index), else by index */
  function locate(mark) {
    var list = blocks(), best = -1, dist = Infinity;
    if (mark.x) {
      for (var i = 0; i < list.length; i++) {
        if (norm(list[i]).slice(0, mark.x.length) === mark.x && Math.abs(i - mark.i) < dist) {
          best = i; dist = Math.abs(i - mark.i);
        }
      }
    }
    if (best === -1 && list[mark.i]) best = mark.i;
    if (best === -1) return mark.s ? document.getElementById(mark.s) : null;
    return list[best];
  }

  function flash(el) {
    el.classList.remove('bm-flash');
    void el.offsetWidth;
    el.classList.add('bm-flash');
    setTimeout(function () { el.classList.remove('bm-flash'); }, 1900);
  }

  /* put the bookmarked point of the block on the reading line. Measures and
     corrects, so it lands right whatever the text size zoom does to units. */
  function jumpTo(mark, quiet) {
    var el = locate(mark);
    if (!el) return false;
    var saved = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    el.scrollIntoView({ block: 'start' });
    var scale = 1;
    for (var k = 0; k < 5; k++) {
      var r = el.getBoundingClientRect();
      /* show where the block starts, unless it is long enough that the saved
         point inside it matters (another device may lay it out shorter) */
      var into = r.height > window.innerHeight * 0.5 ? (mark.f || 0) * r.height : 0;
      var err = r.top + into - topLine();
      if (Math.abs(err) < 2) break;
      var before = window.scrollY;
      window.scrollBy(0, err / scale);
      var moved = el.getBoundingClientRect().top - r.top;
      if (window.scrollY === before || !moved) break;
      scale = Math.abs(moved / (err / scale)) || 1;
    }
    root.style.scrollBehavior = saved;
    if (!quiet) flash(el);
    return true;
  }

  /* ---------- margin ribbons on a book page ---------- */

  function drawFlags() {
    if (!onBook) return;
    Array.prototype.forEach.call(main.querySelectorAll('.bm-flag'), function (f) { f.remove(); });
    Array.prototype.forEach.call(main.querySelectorAll('.bm-marked'), function (el) { el.classList.remove('bm-marked'); });
    S.bookmarks(slug).forEach(function (mark) {
      var el = locate(mark);
      if (!el || el.querySelector('.bm-flag')) return;
      var display = getComputedStyle(el).display;
      if (/flex|grid|table/.test(display)) { el.classList.add('bm-marked'); return; }
      var flag = document.createElement('span');
      flag.className = 'bm-flag';
      flag.setAttribute('aria-hidden', 'true');
      el.insertBefore(flag, el.firstChild);
    });
  }

  /* ---------- the button, the panel and the toast ---------- */

  var button = document.createElement('button');
  button.type = 'button';
  button.className = onBook ? 'chip chip--bm' : 'theme-button bm-button';
  button.setAttribute('aria-haspopup', 'dialog');
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', 'bmSheet');
  button.innerHTML = RIBBON + '<span class="bm-count"></span>';
  if (onBook) chromeEnd.insertBefore(button, chromeEnd.firstChild);
  else corner.insertBefore(button, corner.firstChild);

  var backdrop = document.createElement('div');
  backdrop.className = 'bm-backdrop';
  backdrop.hidden = true;
  var sheet = document.createElement('div');
  sheet.className = 'bm-sheet';
  sheet.id = 'bmSheet';
  sheet.hidden = true;
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-labelledby', 'bmTitle');
  sheet.innerHTML =
    '<div class="bm-sheet__head"><h2 id="bmTitle">Bookmarks</h2><button type="button" class="bm-close">Close</button></div>' +
    (onBook ? '<button type="button" class="bm-add">' + RIBBON + '<span><b>Bookmark this spot</b><small class="bm-add__where"></small></span></button>' : '') +
    '<div class="bm-lists"></div>' +
    '<p class="bm-foot"></p>';
  var toast = document.createElement('div');
  toast.className = 'bm-toast';
  toast.hidden = true;
  toast.setAttribute('role', 'status');
  document.body.appendChild(backdrop);
  document.body.appendChild(sheet);
  document.body.appendChild(toast);

  var lists = sheet.querySelector('.bm-lists');
  var addButton = sheet.querySelector('.bm-add');
  var pending = null;

  function when(t) {
    var s = (Date.now() - t) / 1000;
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    if (s < 172800) return 'yesterday';
    var d = new Date(t);
    return d.getDate() + ' ' + 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ')[d.getMonth()];
  }

  function itemHtml(mark) {
    var where = mark.l || 'Bookmark';
    return '<li class="bm-item"><a class="bm-item__go" href="' + esc(mark.b) + '#bm=' + esc(mark.id) + '" data-id="' + esc(mark.id) + '">' +
      '<span class="bm-item__where">' + esc(where) + '</span>' +
      (mark.x ? '<span class="bm-item__text">“' + esc(mark.x) + (mark.x.length >= 80 ? '…' : '') + '”</span>' : '') +
      '<span class="bm-item__when">' + when(mark.c || mark.t) + '</span></a>' +
      '<button type="button" class="bm-item__del" data-id="' + esc(mark.id) + '" aria-label="Delete bookmark: ' + esc(where) + '">×</button></li>';
  }

  function renderList() {
    var all = S.bookmarks(), here = [], byBook = {}, order = [];
    all.forEach(function (mark) {
      if (onBook && mark.b === slug) { here.push(mark); return; }
      if (!byBook[mark.b]) { byBook[mark.b] = []; order.push(mark.b); }
      byBook[mark.b].push(mark);
    });
    var byPosition = function (a, b) { return a.i - b.i || a.f - b.f; };
    var html = '';
    if (onBook) {
      html += '<h3 class="bm-group">This book</h3>';
      html += here.length
        ? '<ol class="bm-list">' + here.sort(byPosition).map(itemHtml).join('') + '</ol>'
        : '<p class="bm-empty">No bookmarks here yet. Scroll to where you are and tap “Bookmark this spot”.</p>';
    }
    order.forEach(function (book) {
      var title = byBook[book][0].n || book.replace(/\.html$/, '').replace(/-/g, ' ');
      html += '<h3 class="bm-group"><a href="' + esc(book) + '">' + esc(title) + '</a></h3>';
      html += '<ol class="bm-list">' + byBook[book].sort(byPosition).map(itemHtml).join('') + '</ol>';
    });
    if (!onBook && !order.length) html = '<p class="bm-empty">No bookmarks yet. Open a summary and tap the ribbon at the top to save your place.</p>';
    lists.innerHTML = html;
    sheet.querySelector('.bm-foot').innerHTML = S.sync && S.sync.on()
      ? 'Synced across your linked devices.'
      : 'Saved on this device only. <a href="settings.html">Sync your devices</a>';
  }

  function updateCount() {
    var n = onBook ? S.bookmarks(slug).length : S.bookmarks().length;
    button.querySelector('.bm-count').textContent = n ? String(n) : '';
    button.classList.toggle('has-marks', n > 0);
    var label = onBook
      ? (n ? 'Bookmarks: ' + n + ' in this book' : 'Bookmarks')
      : (n ? 'Bookmarks: ' + n : 'Bookmarks');
    button.setAttribute('aria-label', label);
    button.title = 'Bookmarks';
  }

  var toastTimer = null, undo = null;
  function say(message, undoAction) {
    undo = undoAction || null;
    toast.innerHTML = '<span>' + esc(message) + '</span>' + (undo ? '<button type="button" class="bm-toast__undo">Undo</button>' : '');
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.hidden = true; undo = null; }, undo ? 5000 : 2600);
  }
  toast.addEventListener('click', function (event) {
    if (!event.target.closest('.bm-toast__undo') || !undo) return;
    var action = undo;
    undo = null;
    toast.hidden = true;
    action();
  });

  function open() {
    if (onBook) {
      pending = capture();
      addButton.querySelector('.bm-add__where').textContent = pending
        ? pending.l + (pending.x ? ' — “' + pending.x.slice(0, 48) + (pending.x.length > 48 ? '…' : '') + '”' : '')
        : '';
      addButton.disabled = !pending;
    }
    renderList();
    backdrop.hidden = false;
    sheet.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    (addButton || sheet.querySelector('.bm-close')).focus();
  }
  function close(keepFocus) {
    if (sheet.hidden) return;
    backdrop.hidden = true;
    sheet.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    if (!keepFocus) button.focus();
  }

  button.addEventListener('click', function () { if (sheet.hidden) open(); else close(); });
  backdrop.addEventListener('click', function () { close(); });
  sheet.querySelector('.bm-close').addEventListener('click', function () { close(); });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && !sheet.hidden) close();
  });

  if (addButton) addButton.addEventListener('click', function () {
    if (!pending) return;
    var already = S.bookmarks(slug).filter(function (m) { return m.x === pending.x && Math.abs(m.i - pending.i) < 3; })[0];
    close(true);
    if (already) { say('Already bookmarked here'); flash(pending.el); return; }
    var fields = pending, id = S.addBookmark(fields);
    drawFlags();
    updateCount();
    flash(fields.el);
    say('Bookmarked · ' + fields.l, function () { S.removeBookmark(id); drawFlags(); updateCount(); });
  });

  lists.addEventListener('click', function (event) {
    var del = event.target.closest('.bm-item__del');
    if (del) {
      var mark = S.bookmarks().filter(function (m) { return m.id === del.getAttribute('data-id'); })[0];
      if (!mark) return;
      S.removeBookmark(mark.id);
      renderList(); drawFlags(); updateCount();
      say('Bookmark deleted', function () {
        S.addBookmark(mark);
        renderList(); drawFlags(); updateCount();
      });
      return;
    }
    var go = event.target.closest('.bm-item__go');
    if (go && onBook && go.getAttribute('href').split('#')[0] === slug) {
      /* same book: jump without reloading */
      event.preventDefault();
      var target = S.bookmarks(slug).filter(function (m) { return m.id === go.getAttribute('data-id'); })[0];
      close(true);
      if (target) jumpTo(target);
    }
  });

  /* ---------- arriving at <book>.html#bm=<id> ---------- */

  function arrive() {
    var match = /^#bm=([a-z0-9]{8,24})$/.exec(location.hash || '');
    if (!match || !onBook) return;
    var id = match[1], userMoved = false, done = false;
    var find = function () { return S.bookmarks(slug).filter(function (m) { return m.id === id; })[0]; };
    var clearHash = function () { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {} };
    var stop = function () { userMoved = true; };
    ['wheel', 'touchstart', 'keydown'].forEach(function (type) { window.addEventListener(type, stop, { once: true, passive: true }); });
    /* land now, then again once late fonts and figures have settled, unless the reader has moved */
    var land = function (last) {
      if (userMoved || done) return;
      var mark = find();
      if (mark) jumpTo(mark, !last);
      if (last) { done = true; clearHash(); }
    };
    land(false);
    window.addEventListener('load', function () { land(false); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { land(false); });
    setTimeout(function () { land(true); }, 1200);
    /* a bookmark made on another device may arrive with the first sync */
    window.addEventListener(S.event, function (event) {
      if (!done && event.detail && event.detail.keys.indexOf('bookmarks') > -1) land(false);
    });
  }

  window.addEventListener(S.event, function (event) {
    if (event.detail && event.detail.keys.indexOf('bookmarks') === -1) return;
    drawFlags();
    updateCount();
    if (!sheet.hidden) renderList();
  });

  /* at large text sizes the Contents button's section name can shrink to a
     sliver next to the extra button; hide it when it can't show a word */
  var where = document.querySelector('.chip--toc .where');
  function fitWhere() {
    if (!where) return;
    where.classList.remove('bm-where-off');
    if (norm(where) && where.clientWidth < 40 && where.scrollWidth > where.clientWidth + 1) where.classList.add('bm-where-off');
  }
  if (where) {
    window.addEventListener('resize', fitWhere);
    window.addEventListener(S.event, fitWhere);
    if (window.MutationObserver) new MutationObserver(fitWhere).observe(where, { childList: true, characterData: true, subtree: true });
    fitWhere();
  }

  updateCount();
  drawFlags();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawFlags);
  arrive();

  window.bookSummaryBookmarks = { capture: capture, locate: locate, jumpTo: jumpTo, open: open, close: close };
})();
