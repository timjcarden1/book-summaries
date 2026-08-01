# Book Summaries

Illustrated, chapter-by-chapter summaries of books, written as self-contained HTML pages.

**Read them here → https://book-summaries-umber.vercel.app**

Also mirrored on GitHub Pages → https://timjcarden1.github.io/book-summaries/

The site is plain static HTML/CSS/JS with no build step. Open `index.html` locally in a browser and it works exactly as it does when published.

## Contents

| Summary | Author | Print edition |
| --- | --- | --- |
| [The Story of Civilization I–IV](durant-story-of-civilization-i-iv.html) | Will Durant | PDF |
| [The History of Rome](livy-history-of-rome.html) | Livy | PDF |
| [The Lessons of History](lessons-of-history.html) | Will & Ariel Durant | — |
| [Guns, Germs, and Steel](guns-germs-and-steel.html) | Jared Diamond | — |
| [The Beginning of Infinity](the-beginning-of-infinity.html) | David Deutsch | — |
| [Objective Knowledge](popper-objective-knowledge.html) | Karl Popper | PDF |
| [Meditations](marcus-aurelius-meditations.html) | Marcus Aurelius | PDF |
| [Fooled by Randomness](fooled-by-randomness.html) | Nassim Nicholas Taleb | — |
| [Titan](titan-rockefeller.html) | Ron Chernow | — |
| [The Mobile Wave](the-mobile-wave.html) | Michael J. Saylor | — |
| [The Book of Elon](the-book-of-elon.html) | Eric Jorgenson | — |

## Shared assets

Each summary is a single HTML file that pulls in a subset of the shared stylesheets and scripts:

- `reading-summary.css` — base palette, typography and layout for the illustrated summaries
- `civ-plate.css` / `civ-plate.js` — shared chrome for the history summaries (Durant, Livy, Popper, Marcus Aurelius); structure only, each document supplies its own palette
- `book-toc.css` / `book-toc.js` — floating table of contents with scroll tracking
- `book-figures.css` / `book-figures.js` — figure numbering and captions

Every page has its own light/dark theme toggle, persisted in `localStorage`.

## Adding a summary

1. Add `your-book.html` at the repo root, linking whichever shared stylesheets it needs with relative paths.
2. Add a card for it in `index.html` under the right shelf, and a row in the table above.
3. Commit and push — GitHub Pages redeploys automatically from `main`.

## Publishing

The site is hosted twice, both from `main` at the repository root, and both redeploy automatically on push:

- **Vercel** — `vercel.json` declares no build step and the repo root as the output directory. The project is connected to this GitHub repo.
- **GitHub Pages** — a `.nojekyll` file is present so Jekyll does not process or skip any files.
