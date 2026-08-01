(function () {
  "use strict";

  if (window.__bookSummaryTocInstalled || !document.body) return;
  window.__bookSummaryTocInstalled = true;

  var body = document.body;
  var nativeTopbar = Array.prototype.some.call(body.children, function (el) {
    return el.classList && el.classList.contains("topbar");
  });

  body.classList.add("book-toc-enabled");
  if (nativeTopbar) body.classList.add("book-has-native-topbar");

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function slugify(value) {
    return clean(value)
      .toLowerCase()
      .replace(/&/g, " and ")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "section";
  }

  function uniqueId(base, used) {
    var id = base;
    var index = 2;
    while (used[id]) {
      id = base + "-" + index;
      index += 1;
    }
    used[id] = true;
    return id;
  }

  function prefixFor(heading) {
    var holder;
    var node;

    if (heading.tagName === "H3") {
      holder = heading.closest("article");
      if (holder) {
        node = holder.querySelector(".chapter__num, .chap-n");
        if (node) return clean(node.textContent);
      }
      return "";
    }

    holder = heading.closest("section");
    if (!holder) return "";

    node = holder.querySelector(".movement__head .roman, .folio__meta b, .eyebrow b");
    return node ? clean(node.textContent) : "";
  }

  var usedIds = {};
  Array.prototype.forEach.call(document.querySelectorAll("[id]"), function (el) {
    usedIds[el.id] = true;
  });

  var headings = Array.prototype.filter.call(document.querySelectorAll("h2, h3"), function (heading) {
    return clean(heading.textContent) && !heading.closest(".book-toc-top, .book-toc-side");
  });

  var entries = headings.map(function (heading) {
    var text = clean(heading.textContent);
    var prefix = prefixFor(heading);
    var targetId = heading.id;
    var container;

    if (!targetId && heading.tagName === "H2") {
      container = heading.closest("section[id]");
      if (container) targetId = container.id;
    }

    if (!targetId && heading.tagName === "H3") {
      container = heading.closest("article[id]");
      if (container) targetId = container.id;
    }

    if (!targetId) {
      targetId = uniqueId(slugify(text), usedIds);
      heading.id = targetId;
    }

    return {
      heading: heading,
      target: document.getElementById(targetId) || heading,
      targetId: targetId,
      level: heading.tagName === "H2" ? 2 : 3,
      text: text,
      label: prefix && text.toLowerCase().indexOf(prefix.toLowerCase()) !== 0
        ? prefix + " · " + text
        : text
    };
  });

  if (!entries.length) return;

  var pageTitle = clean(document.title.split(/\s+[—·]\s+/)[0]) || "Book summary";

  var top = document.createElement("div");
  top.className = "book-toc-top";
  top.id = "bookTocTop";

  var toggle = document.createElement("button");
  toggle.className = "book-toc-top__toggle";
  toggle.type = "button";
  toggle.setAttribute("aria-controls", "bookTocSide");
  toggle.innerHTML = '<span class="book-toc-top__icon" aria-hidden="true"><span></span></span>' +
    '<span class="book-toc-top__toggle-label">Contents</span>';

  var topLinks = document.createElement("nav");
  topLinks.className = "book-toc-top__links";
  topLinks.setAttribute("aria-label", "Table of contents at top");

  var side = document.createElement("aside");
  side.className = "book-toc-side";
  side.id = "bookTocSide";
  side.setAttribute("aria-label", "Table of contents");

  var sideHead = document.createElement("div");
  sideHead.className = "book-toc-side__head";

  var sideHeadingWrap = document.createElement("div");
  var eyebrow = document.createElement("p");
  eyebrow.className = "book-toc-side__eyebrow";
  eyebrow.textContent = "On this page";
  var sideTitle = document.createElement("p");
  sideTitle.className = "book-toc-side__title";
  sideTitle.textContent = pageTitle;
  sideHeadingWrap.appendChild(eyebrow);
  sideHeadingWrap.appendChild(sideTitle);

  var close = document.createElement("button");
  close.className = "book-toc-side__close";
  close.type = "button";
  close.setAttribute("aria-label", "Close table of contents");
  close.textContent = "×";

  sideHead.appendChild(sideHeadingWrap);
  sideHead.appendChild(close);

  var sideLinks = document.createElement("nav");
  sideLinks.className = "book-toc-side__nav";
  sideLinks.setAttribute("aria-label", "Chapters and sections");

  function makeLink(entry, placement) {
    var link = document.createElement("a");
    link.href = "#" + encodeURIComponent(entry.targetId);
    link.textContent = entry.label;
    link.title = entry.label;
    link.dataset.target = entry.targetId;
    link.dataset.level = String(entry.level);
    link.dataset.placement = placement;
    return link;
  }

  entries.forEach(function (entry) {
    topLinks.appendChild(makeLink(entry, "top"));
    sideLinks.appendChild(makeLink(entry, "side"));
  });

  top.appendChild(toggle);
  top.appendChild(topLinks);
  side.appendChild(sideHead);
  side.appendChild(sideLinks);

  var backdrop = document.createElement("button");
  backdrop.className = "book-toc-backdrop";
  backdrop.type = "button";
  backdrop.setAttribute("aria-label", "Close table of contents");

  body.insertBefore(top, body.firstChild);
  body.insertBefore(side, top.nextSibling);
  body.insertBefore(backdrop, side.nextSibling);

  var desktop = window.matchMedia("(min-width: 1180px)");

  function sidebarIsOpen() {
    return desktop.matches
      ? !body.classList.contains("book-toc-collapsed")
      : body.classList.contains("book-toc-open");
  }

  function syncToggle() {
    toggle.setAttribute("aria-expanded", sidebarIsOpen() ? "true" : "false");
  }

  function closeSidebar() {
    if (desktop.matches) body.classList.add("book-toc-collapsed");
    body.classList.remove("book-toc-open");
    syncToggle();
  }

  function toggleSidebar() {
    if (desktop.matches) {
      body.classList.toggle("book-toc-collapsed");
    } else {
      body.classList.toggle("book-toc-open");
    }
    syncToggle();
  }

  toggle.addEventListener("click", toggleSidebar);
  close.addEventListener("click", closeSidebar);
  backdrop.addEventListener("click", closeSidebar);

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && sidebarIsOpen()) closeSidebar();
  });

  Array.prototype.forEach.call(sideLinks.querySelectorAll("a"), function (link) {
    link.addEventListener("click", function () {
      if (!desktop.matches) closeSidebar();
    });
  });

  if (desktop.addEventListener) {
    desktop.addEventListener("change", function () {
      body.classList.remove("book-toc-open");
      syncToggle();
    });
  }

  var currentId = "";

  function keepVisible(scroller, link, horizontal) {
    if (!link) return;
    if (horizontal) {
      var left = link.offsetLeft;
      var right = left + link.offsetWidth;
      if (left < scroller.scrollLeft) scroller.scrollLeft = Math.max(0, left - 12);
      else if (right > scroller.scrollLeft + scroller.clientWidth) {
        scroller.scrollLeft = right - scroller.clientWidth + 12;
      }
    } else {
      var topEdge = link.offsetTop;
      var bottomEdge = topEdge + link.offsetHeight;
      if (topEdge < scroller.scrollTop) scroller.scrollTop = Math.max(0, topEdge - 8);
      else if (bottomEdge > scroller.scrollTop + scroller.clientHeight) {
        scroller.scrollTop = bottomEdge - scroller.clientHeight + 8;
      }
    }
  }

  function setCurrent(id) {
    if (!id || id === currentId) return;
    currentId = id;

    Array.prototype.forEach.call(document.querySelectorAll("[data-target]"), function (link) {
      if (link.dataset.target === id) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });

    keepVisible(topLinks, topLinks.querySelector('[data-target="' + CSS.escape(id) + '"]'), true);
    keepVisible(sideLinks, sideLinks.querySelector('[data-target="' + CSS.escape(id) + '"]'), false);
  }

  var ticking = false;
  function updateCurrent() {
    ticking = false;
    var cutoff = nativeTopbar ? 132 : 76;
    var active = entries[0];

    entries.forEach(function (entry) {
      if (entry.target.getBoundingClientRect().top <= cutoff) active = entry;
    });

    setCurrent(active.targetId);
  }

  document.addEventListener("scroll", function () {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(updateCurrent);
  }, { passive: true });

  window.addEventListener("resize", function () {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(updateCurrent);
  }, { passive: true });

  syncToggle();
  updateCurrent();
})();
