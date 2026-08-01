/* Reveal each SVG figure as it scrolls into view, so the draw-in
   animation happens where the reader can actually see it. Degrades
   to "everything visible" without IntersectionObserver. */
(function () {
  var figs = document.querySelectorAll('.fig');
  if (!figs.length) return;

  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) {
    for (var i = 0; i < figs.length; i++) figs[i].classList.add('in');
    return;
  }

  // Only now may the stylesheet hide anything — we know the observer exists
  // and will reveal each figure as it comes into view.
  document.documentElement.classList.add('figs-js');

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.18 });

  for (var j = 0; j < figs.length; j++) io.observe(figs[j]);
})();
