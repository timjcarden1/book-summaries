/* Related summaries + previous/next, appended to every summary page.

   The book list below is generated from tools/books.json by
   tools/sync.py — edit that file, not this block. Everything is inlined
   rather than fetched so the pages keep working from file:// too. */
(function () {
  "use strict";

  /* BOOK-NAV-DATA:START */
  var DATA = {
    "books": [
      {
        "slug": "durant-story-of-civilization-i-iv",
        "title": "The Story of Civilization I–IV",
        "author": "Will Durant",
        "related": [
          {
            "slug": "lessons-of-history",
            "why": "The Durants' own distillation of these volumes into thirteen chapters."
          },
          {
            "slug": "livy-history-of-rome",
            "why": "The primary source sitting under Caesar and Christ."
          },
          {
            "slug": "guns-germs-and-steel",
            "why": "The same sweep, argued from geography rather than character."
          }
        ]
      },
      {
        "slug": "livy-history-of-rome",
        "title": "The History of Rome",
        "author": "Livy",
        "related": [
          {
            "slug": "durant-story-of-civilization-i-iv",
            "why": "Durant's Caesar and Christ retells this material as narrative history."
          },
          {
            "slug": "marcus-aurelius-meditations",
            "why": "The same empire three centuries on, seen from inside the emperor's head."
          },
          {
            "slug": "lessons-of-history",
            "why": "What the Durants think recurs in exactly this kind of record."
          }
        ]
      },
      {
        "slug": "lessons-of-history",
        "title": "The Lessons of History",
        "author": "Will & Ariel Durant",
        "related": [
          {
            "slug": "durant-story-of-civilization-i-iv",
            "why": "The eleven volumes this book is the distillation of."
          },
          {
            "slug": "guns-germs-and-steel",
            "why": "A rival account of why civilisations diverge, built on evidence rather than pattern."
          },
          {
            "slug": "fooled-by-randomness",
            "why": "The case for reading less into historical patterns than they seem to offer."
          }
        ]
      },
      {
        "slug": "guns-germs-and-steel",
        "title": "Guns, Germs, and Steel",
        "author": "Jared Diamond",
        "related": [
          {
            "slug": "palma-causas-do-atraso-portugues",
            "why": "Geography versus institutions, argued over one country in detail."
          },
          {
            "slug": "lessons-of-history",
            "why": "The same question of what drives civilisations, answered from pattern instead."
          },
          {
            "slug": "durant-story-of-civilization-i-iv",
            "why": "The narrative version of the sweep this book explains."
          },
          {
            "slug": "why-nations-fail",
            "why": "The institutional rebuttal, by authors Diamond reviewed in turn."
          }
        ]
      },
      {
        "slug": "palma-causas-do-atraso-portugues",
        "title": "The Causes of Portuguese Backwardness",
        "author": "Nuno Palma",
        "related": [
          {
            "slug": "guns-germs-and-steel",
            "why": "The geographic explanation this book's chronology is written against."
          },
          {
            "slug": "lessons-of-history",
            "why": "Recurrence as a way of reading history, next to Palma's insistence on dates."
          },
          {
            "slug": "fooled-by-randomness",
            "why": "Both books are mostly about not mistaking a story for a cause."
          },
          {
            "slug": "why-nations-fail",
            "why": "The same mechanism — a windfall that lets a crown stop asking — argued across the world."
          }
        ]
      },
      {
        "slug": "why-nations-fail",
        "title": "Why Nations Fail",
        "author": "Daron Acemoglu & James A. Robinson",
        "related": [
          {
            "slug": "guns-germs-and-steel",
            "why": "The geographic answer this book was written to demolish — and whose author then reviewed it."
          },
          {
            "slug": "palma-causas-do-atraso-portugues",
            "why": "The same mechanism run over four centuries of one country, with much better data."
          },
          {
            "slug": "titan-rockefeller",
            "why": "The monopoly the virtuous-circle chapter uses to prove an inclusive system can break its own most powerful man."
          }
        ]
      },
      {
        "slug": "the-beginning-of-infinity",
        "title": "The Beginning of Infinity",
        "author": "David Deutsch",
        "related": [
          {
            "slug": "popper-objective-knowledge",
            "why": "The epistemology this book is built directly on top of."
          },
          {
            "slug": "fooled-by-randomness",
            "why": "Fallibilism from the other end — what you cannot learn from outcomes."
          },
          {
            "slug": "the-mobile-wave",
            "why": "A concrete forecast to test the book's claims about predicting progress."
          }
        ]
      },
      {
        "slug": "popper-objective-knowledge",
        "title": "Objective Knowledge",
        "author": "Karl Popper",
        "related": [
          {
            "slug": "the-beginning-of-infinity",
            "why": "Deutsch's extension of this book, forty years later."
          },
          {
            "slug": "fooled-by-randomness",
            "why": "Induction as a practical hazard rather than a philosophical one."
          },
          {
            "slug": "guns-germs-and-steel",
            "why": "A long historical argument worth testing against Popper's standard for explanations."
          }
        ]
      },
      {
        "slug": "marcus-aurelius-meditations",
        "title": "Meditations",
        "author": "Marcus Aurelius",
        "related": [
          {
            "slug": "livy-history-of-rome",
            "why": "The Rome he inherited, written by the historian his tutors gave him."
          },
          {
            "slug": "fooled-by-randomness",
            "why": "Taleb's Stoicism is drawn from exactly this, applied to markets."
          },
          {
            "slug": "almanack-naval-ravikant",
            "why": "The same discipline restated for a modern reader, minus the empire."
          }
        ]
      },
      {
        "slug": "fooled-by-randomness",
        "title": "Fooled by Randomness",
        "author": "Nassim Nicholas Taleb",
        "related": [
          {
            "slug": "popper-objective-knowledge",
            "why": "The problem of induction, which Taleb treats as a survival problem."
          },
          {
            "slug": "marcus-aurelius-meditations",
            "why": "The Stoic source Taleb keeps returning to."
          },
          {
            "slug": "titan-rockefeller",
            "why": "One long career to test the book's argument about skill and luck against."
          }
        ]
      },
      {
        "slug": "titan-rockefeller",
        "title": "Titan",
        "author": "Ron Chernow",
        "related": [
          {
            "slug": "the-book-of-elon",
            "why": "The same question of method and scale, a century apart."
          },
          {
            "slug": "fooled-by-randomness",
            "why": "How much of a record like this is skill, and how you would ever know."
          },
          {
            "slug": "almanack-naval-ravikant",
            "why": "Leverage and compounding, stated as principle rather than biography."
          }
        ]
      },
      {
        "slug": "almanack-naval-ravikant",
        "title": "The Almanack of Naval Ravikant",
        "author": "Eric Jorgenson",
        "related": [
          {
            "slug": "the-book-of-elon",
            "why": "The same compiler, the same method, a very different subject."
          },
          {
            "slug": "marcus-aurelius-meditations",
            "why": "The Stoic spine underneath most of the happiness half."
          },
          {
            "slug": "fooled-by-randomness",
            "why": "A useful check on advice assembled from one person's outcomes."
          }
        ]
      },
      {
        "slug": "the-book-of-elon",
        "title": "The Book of Elon",
        "author": "Eric Jorgenson",
        "related": [
          {
            "slug": "almanack-naval-ravikant",
            "why": "Jorgenson's earlier book, and the template this one follows."
          },
          {
            "slug": "titan-rockefeller",
            "why": "The nineteenth-century version of building at this scale."
          },
          {
            "slug": "the-mobile-wave",
            "why": "Another technologist's forecast, now old enough to be scored."
          }
        ]
      },
      {
        "slug": "the-mobile-wave",
        "title": "The Mobile Wave",
        "author": "Michael J. Saylor",
        "related": [
          {
            "slug": "the-book-of-elon",
            "why": "A newer forecast from inside the industry, not yet scoreable."
          },
          {
            "slug": "the-beginning-of-infinity",
            "why": "Why long-range prediction fails, stated as epistemology."
          },
          {
            "slug": "titan-rockefeller",
            "why": "What actually happens when a new infrastructure gets organised."
          }
        ]
      }
    ]
  };
  /* BOOK-NAV-DATA:END */

  if (window.__bookNavInstalled || !document.body) return;

  var slug = (location.pathname.split("/").pop() || "").replace(/\.html?$/i, "");
  if (!slug || slug === "index") return;

  var books = DATA.books || [];
  var index = -1;
  for (var i = 0; i < books.length; i += 1) {
    if (books[i].slug === slug) index = i;
  }
  if (index < 0) return;

  window.__bookNavInstalled = true;

  var current = books[index];
  var bySlug = {};
  books.forEach(function (book) { bySlug[book.slug] = book; });

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  var nav = el("nav", "book-nav");
  nav.setAttribute("aria-label", "More summaries");

  var inner = el("div", "book-nav__in");
  nav.appendChild(inner);

  var related = (current.related || [])
    .map(function (item) {
      var book = bySlug[item.slug];
      return book ? { book: book, why: item.why } : null;
    })
    .filter(Boolean);

  if (related.length) {
    inner.appendChild(el("p", "book-nav__eyebrow", "Related summaries"));

    var list = el("ul", "book-nav__related");
    related.forEach(function (item) {
      var li = document.createElement("li");
      var link = document.createElement("a");
      link.href = item.book.slug + ".html";
      link.appendChild(el("span", "book-nav__title", item.book.title));
      link.appendChild(el("span", "book-nav__author", item.book.author));
      if (item.why) link.appendChild(el("span", "book-nav__why", item.why));
      li.appendChild(link);
      list.appendChild(li);
    });
    inner.appendChild(list);
  }

  var seq = el("div", "book-nav__seq");

  function sequenceLink(book, className, label) {
    if (!book) return el("span", className);
    var link = document.createElement("a");
    link.className = className;
    link.href = book.slug + ".html";
    link.appendChild(el("span", "book-nav__seq-label", label));
    link.appendChild(el("span", "book-nav__seq-title", book.title));
    return link;
  }

  var home = document.createElement("a");
  home.className = "book-nav__home";
  home.href = "index.html";
  home.appendChild(el("span", null, "←"));
  home.appendChild(el("span", null, "All summaries"));

  seq.appendChild(sequenceLink(books[index - 1], "book-nav__prev", "Previous"));
  seq.appendChild(home);
  seq.appendChild(sequenceLink(books[index + 1], "book-nav__next", "Next"));
  inner.appendChild(seq);

  document.body.appendChild(nav);
})();
