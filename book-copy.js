/* book-copy.js — copy a whole chapter, or the whole summary (Tim, 2026-09-28:
   "I want to be able to copy a whole chapters and the entire book summary").

   Every .chapter in main.content gets a "Copy chapter" button on its label
   line, and the hero gets "Copy the whole summary" above the one-breath box.
   Each copy puts two versions on the clipboard: Markdown as the plain text
   (for a chat box or a plain-text note) and clean HTML (headings, bullets and
   bold survive a paste into Notes, Docs or an email). Figures and plates are
   left out, since they don't survive as text, and so are the page chrome, the
   rail and the buttons. The copy ends with a link back to the page.

   The text is built from the page itself when the button is tapped, so it
   never goes stale when a summary is edited. */
(function () {
  'use strict';

  var main = document.querySelector('main.content');
  if (!main) return;
  var hero = document.querySelector('header.hero');
  var foot = document.querySelector('footer.foot');

  var SKIP = 'figure, .fig, svg, canvas, img, picture, video, audio, iframe, script, style, noscript, template, ' +
    'button, nav, .rail, .chrome, .book-nav, .eyebrow, .bm-flag, .cp-row, [hidden], [aria-hidden="true"]';
  var BLOCK = /^(P|DIV|SECTION|ARTICLE|HEADER|FOOTER|MAIN|ASIDE|UL|OL|LI|DL|DT|DD|TABLE|THEAD|TBODY|TFOOT|TR|TD|TH|CAPTION|BLOCKQUOTE|PRE|H[1-6]|FIGURE|FIGCAPTION|HR|FORM|FIELDSET|DETAILS|SUMMARY|ADDRESS)$/;
  /* small label lines: joined onto the heading they sit above ("Chapter I · Hesitations") */
  var LABEL = /(^|\s)(ch-label|kicker|tag|part-num|k|when|fc__v|sub|subh|who|cast-group)(\s|$)/;
  /* ...and the ones that are sub-heads in their own right when no heading follows */
  var SUBHEAD = /(^|\s)(kicker|sub|subh|who|cast-group|k)(\s|$)/;
  var WRAP = { STRONG: '**', B: '**', EM: '*', I: '*', CITE: '*' };
  var ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8.5" rx="1.3"/><path d="M10.5 5.5V3.3a1 1 0 0 0-1-1H3.5a1 1 0 0 0-1 1v6.9a1 1 0 0 0 1 1h2"/></svg>';
  var each = function (list, fn) { Array.prototype.forEach.call(list, fn); };

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  function skip(el) {
    return el.matches(SKIP) || getComputedStyle(el).display === 'none';
  }
  /* laid out as a block, whatever its tag (a <span> styled as the attribution line) */
  function blockish(el) {
    if (BLOCK.test(el.tagName)) return true;
    var d = getComputedStyle(el).display;
    return d !== 'none' && d !== 'contents' && d.indexOf('inline') !== 0;
  }

  /* ---------- inline text: Markdown and HTML side by side ---------- */

  /* one node, flattened: any blocks inside become spaces */
  function flat(node, plain) {
    if (node.nodeType === 3) {
      var t = node.nodeValue.replace(/\s+/g, ' ');
      return { md: t, html: esc(t) };
    }
    if (node.nodeType !== 1 || skip(node)) return { md: '', html: '' };
    if (node.tagName === 'BR') return { md: '\n', html: '<br>' };
    var md = '', html = '';
    each(node.childNodes, function (c) { var r = flat(c, plain); md += r.md; html += r.html; });
    if (blockish(node) || getComputedStyle(node).display.indexOf('inline-') === 0) { md = ' ' + md + ' '; html = ' ' + html + ' '; }
    return dress(node, md, html, plain);
  }

  /* bold, italic and links; the markers hug the words, not the spaces around them */
  function dress(node, md, html, plain) {
    var mark = WRAP[node.tagName];
    var href = node.tagName === 'A' && !/^#/.test(node.getAttribute('href') || '#') ? node.href : '';
    if (!mark && !href) return { md: md, html: html };
    var core = md.trim(), hcore = html.trim();
    if (!core) return { md: md, html: html };
    var lead = /^\s/.test(md) ? ' ' : '', trail = /\s$/.test(md) ? ' ' : '';
    if (href) return { md: md, html: lead + '<a href="' + esc(href) + '">' + hcore + '</a>' + trail };
    var tag = mark === '**' ? 'strong' : 'em';
    return { md: lead + (plain ? core : mark + core + mark) + trail, html: lead + '<' + tag + '>' + hcore + '</' + tag + '>' + trail };
  }

  /* the runs of a block, split wherever a child is laid out as its own line */
  function segments(nodes, plain) {
    var segs = [], buf = { md: '', html: '' };
    function flush() {
      var md = buf.md.replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').trim();
      if (md) segs.push({ md: md, html: buf.html.replace(/\s+/g, ' ').trim() });
      buf = { md: '', html: '' };
    }
    function visit(node) {
      if (node.nodeType === 1 && node.tagName !== 'BR' && !skip(node)) {
        if (blockish(node)) { flush(); buf = flat(node, plain); flush(); return; }
        if (!WRAP[node.tagName] && node.tagName !== 'A' && node.children.length) {
          each(node.childNodes, visit);
          return;
        }
      }
      var r = flat(node, plain);
      buf.md += r.md; buf.html += r.html;
    }
    each(nodes, visit);
    flush();
    return segs;
  }

  /* "“A quote.” — its source", "168 — Spaniards…", or plain sentences run on */
  function join(segs) {
    var out = { md: '', html: '' };
    segs.forEach(function (s, i) {
      var sep = !i ? '' : /[.:;!?]$/.test(out.md) ? ' ' : ' — ';
      out.md += sep + s.md;
      out.html += sep + s.html;
    });
    return out;
  }
  function text(el) { return join(segments(el.childNodes, true)).md; }

  /* ---------- blocks ---------- */

  function nextShown(el) {
    for (var n = el.nextElementSibling; n; n = n.nextElementSibling) if (!skip(n)) return n;
    return null;
  }
  function hasBlockChild(el) {
    for (var c = el.firstElementChild; c; c = c.nextElementSibling) if (BLOCK.test(c.tagName) && !skip(c)) return true;
    return false;
  }

  var lists = 0;

  /* st: { h: level of the last real heading, label: a label waiting for its heading, omit: an element to leave out }.
     A heading's level lasts to the end of its container, so a sub-head after a
     card of h4s still sits under the section's h2. */
  function walk(el, out, st) {
    var run = [], level = st.h;
    function flushRun() {
      if (run.length) para(run, out, false);
      run = [];
    }
    each(el.childNodes, function (node) {
      if (node.nodeType === 3) { if (node.nodeValue.trim()) run.push(node); return; }
      if (node.nodeType !== 1 || node === st.omit || skip(node)) return;
      if (!blockish(node)) { run.push(node); return; }
      flushRun();
      block(node, out, st);
    });
    flushRun();
    st.h = level;
  }

  function block(node, out, st) {
    var tag = node.tagName, t;
    if (/^H[1-6]$/.test(tag)) {
      t = text(node);
      if (st.label) { t = st.label + ' · ' + t; st.label = null; }
      st.h = +tag[1];
      if (t) out.push({ t: 'h', level: st.h, md: t, html: esc(t) });
      return;
    }
    if (tag === 'P' && LABEL.test(node.className)) {
      var next = nextShown(node);
      if (next && /^H[2-6]$/.test(next.tagName)) { st.label = text(node); return; }
      if (SUBHEAD.test(node.className)) {
        t = text(node);
        if (t) out.push({ t: 'h', level: Math.min(st.h + 1, 6), md: t, html: esc(t) });
        return;
      }
    }
    if (tag === 'UL' || tag === 'OL') { list(node, out, 0, ++lists); return; }
    if (tag === 'DL') { terms(node, out); return; }
    if (tag === 'TABLE') { table(node, out); return; }
    if (tag === 'HR') { out.push({ t: 'hr' }); return; }
    if (tag === 'BLOCKQUOTE' || tag === 'P' || tag === 'PRE' || !hasBlockChild(node)) {
      para(node.childNodes, out, tag === 'BLOCKQUOTE');
      return;
    }
    walk(node, out, st);
  }

  function para(nodes, out, quote) {
    var segs = segments(nodes, false);
    if (!segs.length) return;
    var r = join(segs);
    /* a quotation with its source on a line of its own reads as a quote */
    if (!quote && segs.length > 1 && /^\**[“"‘]/.test(segs[0].md)) quote = true;
    out.push({ t: quote ? 'quote' : 'p', md: r.md, html: r.html });
  }

  function list(node, out, depth, id) {
    var ordered = node.tagName === 'OL', n = +(node.getAttribute('start') || 1);
    each(node.children, function (li) {
      if (li.tagName !== 'LI' || skip(li)) return;
      var own = [], subs = [];
      each(li.childNodes, function (c) {
        (c.nodeType === 1 && (c.tagName === 'UL' || c.tagName === 'OL') ? subs : own).push(c);
      });
      var r = join(segments(own, false));
      if (r.md) out.push({ t: 'li', depth: depth, list: id, ordered: ordered, n: n++, md: r.md, html: r.html });
      subs.forEach(function (s) { if (!skip(s)) list(s, out, depth + 1, id); });
    });
  }

  /* a definition list (facts, stats, glossary): "**Term**: definition" */
  function terms(node, out) {
    var id = ++lists, item = null;
    function push() { if (item && (item.md || item.term)) out.push(item.done()); item = null; }
    each(node.querySelectorAll('dt, dd'), function (el) {
      if (el.closest('dl') !== node || skip(el)) return;
      var r = join(segments(el.childNodes, false));
      if (el.tagName === 'DT') {
        push();
        var term = text(el);
        item = { term: term, md: '', html: '', done: function () {
          var sep = this.md ? ': ' : '';
          return { t: 'li', depth: 0, list: id, ordered: false,
            md: (this.term ? '**' + this.term + '**' + sep : '') + this.md,
            html: (this.term ? '<strong>' + esc(this.term) + '</strong>' + sep : '') + this.html };
        } };
        return;
      }
      if (!item) item = { term: '', md: '', html: '', done: function () { return { t: 'li', depth: 0, list: id, ordered: false, md: this.md, html: this.html }; } };
      item.md += (item.md ? '; ' : '') + r.md;
      item.html += (item.html ? '; ' : '') + r.html;
    });
    push();
  }

  function table(node, out) {
    var rows = [];
    each(node.rows, function (tr) {
      if (skip(tr)) return;
      var cells = [];
      each(tr.cells, function (td) {
        if (skip(td)) return;
        var r = join(segments(td.childNodes, false));
        cells.push({ md: r.md.replace(/\n/g, ' ').replace(/\|/g, '\\|'), html: r.html, th: td.tagName === 'TH' });
      });
      if (cells.length) rows.push(cells);
    });
    if (!rows.length) return;
    var width = Math.max.apply(null, rows.map(function (r) { return r.length; }));
    var line = function (r) {
      var cells = r.map(function (c) { return c.md; });
      while (cells.length < width) cells.push('');
      return '| ' + cells.join(' | ') + ' |';
    };
    var md = [line(rows[0]), '|' + new Array(width + 1).join(' --- |')].concat(rows.slice(1).map(line)).join('\n');
    var html = '<table>' + rows.map(function (r, i) {
      var tag = i === 0 ? 'th' : 'td';
      return '<tr>' + r.map(function (c) { return '<' + tag + '>' + c.html + '</' + tag + '>'; }).join('') + '</tr>';
    }).join('') + '</table>';
    var caption = node.caption && !skip(node.caption) ? text(node.caption) : '';
    if (caption) out.push({ t: 'p', md: '*' + caption + '*', html: '<em>' + esc(caption) + '</em>' });
    out.push({ t: 'table', md: md, html: html });
  }

  /* ---------- rendering ---------- */

  function markdown(blocks, shift) {
    var out = '', prev = null;
    blocks.forEach(function (b) {
      var s;
      if (b.t === 'h') s = new Array(Math.min(Math.max(b.level - shift, 1), 6) + 1).join('#') + ' ' + b.md;
      else if (b.t === 'quote') s = '> ' + b.md.replace(/\n/g, '\n> ');
      else if (b.t === 'li') {
        var pad = new Array(b.depth + 1).join('  ');
        s = pad + (b.ordered ? b.n + '. ' : '- ') + b.md.replace(/\n/g, '\n' + pad + '  ');
      } else if (b.t === 'hr') s = '---';
      else s = b.md;
      var tight = prev && prev.t === 'li' && b.t === 'li' && (prev.list === b.list || b.depth > 0);
      out += (prev ? (tight ? '\n' : '\n\n') : '') + s;
      prev = b;
    });
    return out + '\n';
  }

  function htmlOf(blocks, shift) {
    var html = '', open = [];
    function closeAll() { while (open.length) html += '</li></' + open.pop().tag + '>'; }
    blocks.forEach(function (b) {
      if (b.t === 'li') {
        if (open.length && b.depth === 0 && open[0].id !== b.list) closeAll();
        while (open.length > b.depth + 1) html += '</li></' + open.pop().tag + '>';
        if (open.length === b.depth + 1) html += '</li>';
        else {
          var tag = b.ordered ? 'ol' : 'ul';
          while (open.length < b.depth + 1) { html += '<' + tag + '>'; open.push({ tag: tag, id: b.list }); }
        }
        html += '<li>' + b.html;
        return;
      }
      closeAll();
      if (b.t === 'h') {
        var n = Math.min(Math.max(b.level - shift, 1), 6);
        html += '<h' + n + '>' + b.html + '</h' + n + '>';
      } else if (b.t === 'quote') html += '<blockquote><p>' + b.html + '</p></blockquote>';
      else if (b.t === 'hr') html += '<hr>';
      else if (b.t === 'table') html += b.html;
      else html += '<p>' + b.html + '</p>';
    });
    closeAll();
    return html;
  }

  /* ---------- what gets copied ---------- */

  function book() {
    var og = document.querySelector('meta[property="og:title"]');
    var parts = (og ? og.getAttribute('content') : document.title).split(' — ');
    return { title: parts[0].trim(), author: (parts[1] || '').trim() };
  }
  function pageUrl(hash) {
    var canon = document.querySelector('link[rel="canonical"]');
    var base = canon ? canon.href : location.href.split('#')[0];
    return base + (hash ? '#' + hash : '');
  }
  function source(url) {
    return { t: 'p', md: 'Source: ' + url, html: 'Source: <a href="' + esc(url) + '">' + esc(url) + '</a>' };
  }
  function finish(blocks) {
    var levels = blocks.filter(function (b) { return b.t === 'h'; }).map(function (b) { return b.level; });
    var shift = levels.length ? Math.min.apply(null, levels) - 1 : 0;
    return { text: markdown(blocks, shift), html: htmlOf(blocks, shift) };
  }

  function chapterName(ch) {
    var label = ch.querySelector('.ch-label'), h = ch.querySelector('h2, h3, h4');
    var parts = [label && text(label), h && text(h)].filter(Boolean);
    return parts.join(' · ') || 'Chapter';
  }

  /* one chapter, or one section of the page: its heading, the book's name, the text, a link back */
  function copyPart(el) {
    var blocks = [], b = book();
    lists = 0;
    walk(el, blocks, { h: el.matches('.chapter') ? 3 : 2, label: null });
    var first = blocks[0] && blocks[0].t === 'h' ? 1 : 0;
    blocks.splice(first, 0, {
      t: 'p',
      md: '*' + b.title + '*' + (b.author ? ' — ' + b.author : ''),
      html: '<em>' + esc(b.title) + '</em>' + (b.author ? ' — ' + esc(b.author) : '')
    });
    blocks.push(source(pageUrl(el.id)));
    var doc = finish(blocks);
    doc.name = first ? blocks[0].md : el.matches('.chapter') ? chapterName(el) : 'Section';
    return doc;
  }

  /* what the reader is on. When the Contents button names a chapter, that
     chapter, so what you see named is what you get (measured 2026-09-28: the
     line alone split from it at 27 of 4,565 scroll positions, all at chapter
     boundaries). Otherwise the chapter under a line 20% down the screen (the
     middle of the band the scroll-spy watches), else the section (Glossary,
     Debates…), else, up in the hero, nothing: the whole summary. */
  function current() {
    var active = document.querySelector('.rail a.is-active[href^="#"]');
    var named = active && document.getElementById(decodeURIComponent(active.getAttribute('href').slice(1)));
    if (named && named.matches('.chapter') && main.contains(named)) return named;
    var y = window.innerHeight * 0.2, hit = null;
    if (y < main.getBoundingClientRect().top) return null;
    /* a chapter owns the gap after it, so the line never falls between two */
    each(main.querySelectorAll('.chapter'), function (ch) {
      var r = ch.getBoundingClientRect();
      if (r.top <= y && r.bottom + 60 > y) hit = ch;
    });
    if (hit) return hit;
    /* innermost section the line is in; in a gap, the last one started */
    each(main.querySelectorAll('section'), function (s) {
      if (s.getBoundingClientRect().top <= y) hit = s;
    });
    return hit;
  }

  function copyAll() {
    var blocks = [], st = { h: 1, label: null, omit: null };
    lists = 0;
    if (hero) {
      var h1 = hero.querySelector('h1');
      if (h1) {
        var t = text(h1);
        blocks.push({ t: 'h', level: 1, md: t, html: esc(t) });
        st.omit = h1;
      }
      walk(hero, blocks, st);
      st.omit = null;
    }
    walk(main, blocks, st);
    if (foot) {
      blocks.push({ t: 'hr' });
      walk(foot, blocks, st);
    }
    blocks.push(source(pageUrl('')));
    return finish(blocks);
  }

  /* ---------- the clipboard ---------- */

  /* execCommand with the copy event filled in: synchronous, so it still runs
     inside the tap on browsers without ClipboardItem */
  function legacyCopy(text, html) {
    var area = document.createElement('textarea'), ok = false;
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;';
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, text.length);
    function fill(event) {
      try {
        event.clipboardData.setData('text/plain', text);
        event.clipboardData.setData('text/html', html);
        event.preventDefault();
      } catch (e) {}
    }
    document.addEventListener('copy', fill);
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.removeEventListener('copy', fill);
    area.remove();
    return ok;
  }

  function write(text, html) {
    var clip = navigator.clipboard;
    function fallback() {
      if (legacyCopy(text, html)) return Promise.resolve();
      return clip && clip.writeText ? clip.writeText(text) : Promise.reject(new Error('no clipboard'));
    }
    if (clip && clip.write && window.ClipboardItem) {
      try {
        return clip.write([new ClipboardItem({
          'text/plain': new Blob([text], { type: 'text/plain' }),
          'text/html': new Blob([html], { type: 'text/html' })
        })]).catch(fallback);
      } catch (e) {}
    }
    return fallback();
  }

  /* ---------- buttons and toast ---------- */

  var toast = document.createElement('div');
  toast.className = 'cp-toast';
  toast.hidden = true;
  toast.setAttribute('role', 'status');
  document.body.appendChild(toast);
  var toastTimer = null;
  function say(message) {
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.hidden = true; }, 2600);
  }

  function words(s) { return (s.match(/\S*[A-Za-z0-9À-ɏ]\S*/g) || []).length; }

  /* copy on tap; the button shows "done" for a moment and the toast says what went */
  function wire(b, build, what) {
    var labelEl = b.querySelector('.cp-btn__label'), label = labelEl ? labelEl.innerHTML : '', timer = null;
    b.addEventListener('click', function () {
      var doc;
      try { doc = build(); } catch (e) { say('Couldn’t copy that, sorry.'); throw e; }
      write(doc.text, doc.html).then(function () {
        b.setAttribute('data-state', 'done');
        if (labelEl) labelEl.textContent = 'Copied';
        clearTimeout(timer);
        timer = setTimeout(function () {
          b.removeAttribute('data-state');
          if (labelEl) labelEl.innerHTML = label;
        }, 2200);
        say(what(doc) + ' copied · ' + words(doc.text).toLocaleString('en-GB') + ' words');
      }, function () {
        say('Couldn’t reach the clipboard. Try again.');
      });
    });
    return b;
  }

  /* label: "Copy<span class="cp-btn__more"> chapter</span>" (phones drop the rest) */
  function button(kind, label, aria, build, what) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'cp-btn cp-btn--' + kind;
    b.innerHTML = ICON + '<span class="cp-btn__label">' + label + '</span>';
    b.setAttribute('aria-label', aria);
    return wire(b, build, what);
  }
  var whole = function () { return 'Whole summary'; };

  each(main.querySelectorAll('.chapter'), function (ch) {
    var name = function () { return chapterName(ch); };
    var b = button('chapter', 'Copy<span class="cp-btn__more"> chapter</span>', 'Copy chapter: ' + name(),
      function () { return copyPart(ch); }, name);
    ch.insertBefore(b, ch.firstChild);
  });

  if (hero) {
    var breath = hero.querySelector('.breath');
    var anchor = breath || (hero.querySelector('h1') && hero.querySelector('h1').nextElementSibling);
    if (anchor) {
      var row = document.createElement('div');
      row.className = 'cp-row';
      row.appendChild(button('all', 'Copy the whole summary', 'Copy the whole summary', copyAll, whole));
      anchor.parentNode.insertBefore(row, anchor);
    }
  }

  /* the chapter you're reading, one tap from anywhere: an icon in the top bar,
     before the bookmark ribbon (Tim, 2026-09-28: "copy the chapter that you're
     currently reading"). In the hero it copies the whole summary. */
  var chromeEnd = document.querySelector('.chrome__end');
  if (chromeEnd) {
    var chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip chip--cp';
    chip.innerHTML = ICON;
    chip.title = 'Copy the chapter you’re reading';
    chip.setAttribute('aria-label', 'Copy the chapter you’re reading');
    chromeEnd.insertBefore(wire(chip, function () {
      var el = current();
      return el ? copyPart(el) : copyAll();
    }, function (doc) { return doc.name || 'Whole summary'; }), chromeEnd.firstChild);
  }

  window.bookSummaryCopy = { chapter: copyPart, part: copyPart, all: copyAll, current: current };
})();
