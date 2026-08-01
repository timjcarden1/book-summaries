/* civ-plate.js — theme toggle, scroll reveal, rail current-section marker.
   Progressive enhancement only: the page is complete without it, and
   everything it does is disabled or pre-resolved for print. */
(function () {
  'use strict';

  /* ---------- theme ---------- */
  var root = document.documentElement;
  var stored = null;
  try { stored = localStorage.getItem('civ-theme'); } catch (e) {}
  if (stored === 'light' || stored === 'dark') root.setAttribute('data-theme', stored);

  var btn = document.getElementById('themeToggle');
  if (btn) {
    btn.addEventListener('click', function () {
      var dark = root.getAttribute('data-theme') === 'dark' ||
        (!root.hasAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
      var next = dark ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('civ-theme', next); } catch (e) {}
    });
  }

  /* ---------- reveal ---------- */
  var targets = document.querySelectorAll('.reveal');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!('IntersectionObserver' in window) || reduce) {
    for (var i = 0; i < targets.length; i++) targets[i].classList.add('in');
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    for (var j = 0; j < targets.length; j++) io.observe(targets[j]);
  }
  /* print must never show a half-faded figure */
  window.addEventListener('beforeprint', function () {
    for (var k = 0; k < targets.length; k++) targets[k].classList.add('in');
  });

  /* ---------- rail ---------- */
  var links = Array.prototype.slice.call(document.querySelectorAll('.rail a[data-rail]'));
  if (!links.length) return;
  var sections = links.map(function (a) { return document.getElementById(a.getAttribute('data-rail')); })
                      .filter(Boolean);

  function mark() {
    var y = window.scrollY + window.innerHeight * 0.32;
    var current = sections[0];
    for (var i = 0; i < sections.length; i++) {
      if (sections[i].offsetTop <= y) current = sections[i];
    }
    links.forEach(function (a) {
      a.setAttribute('aria-current', a.getAttribute('data-rail') === current.id ? 'true' : 'false');
    });
  }
  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () { mark(); ticking = false; });
  }, { passive: true });
  mark();
})();
