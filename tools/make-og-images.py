#!/usr/bin/env python3
"""Render the 1200x630 link-preview cards in og/ from tools/books.json.

The site itself has no build step — these PNGs are committed and served as
static files. Re-run this only when a book is added or its palette changes:

    python3 tools/make-og-images.py

Requires Pillow and the macOS system fonts (Iowan Old Style, Avenir Next),
which are the same faces the pages ask for in CSS.
"""

import json
import pathlib
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "og"

W, H = 1200, 630
MARGIN = 88

DISPLAY = "/System/Library/Fonts/Supplemental/Iowan Old Style.ttc"
LABEL = "/System/Library/Fonts/Avenir Next.ttc"
DISPLAY_FALLBACK = "/System/Library/Fonts/Supplemental/Georgia.ttf"
LABEL_FALLBACK = "/System/Library/Fonts/Helvetica.ttc"


def font(path, size, index=0, fallback=None):
    try:
        return ImageFont.truetype(path, size, index=index)
    except OSError:
        if fallback:
            return ImageFont.truetype(fallback, size)
        raise


def display(size, bold=True):
    return font(DISPLAY, size, index=1 if bold else 0, fallback=DISPLAY_FALLBACK)


def label(size, weight="demi"):
    return font(LABEL, size, index={"demi": 2, "medium": 5, "bold": 0}[weight],
                fallback=LABEL_FALLBACK)


def tracked(draw, xy, text, fnt, fill, tracking):
    """Draw text with letter-spacing, which Pillow has no native support for."""
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=fnt, fill=fill)
        x += draw.textlength(ch, font=fnt) + tracking
    return x


def tracked_width(draw, text, fnt, tracking):
    return sum(draw.textlength(c, font=fnt) for c in text) + tracking * max(0, len(text) - 1)


def wrap(draw, text, fnt, max_width):
    lines, line = [], ""
    for word in text.split():
        probe = f"{line} {word}".strip()
        if draw.textlength(probe, font=fnt) <= max_width or not line:
            line = probe
        else:
            lines.append(line)
            line = word
    if line:
        lines.append(line)
    return lines


def fit_title(draw, text, max_width, max_lines=3, start=82, floor=52):
    """Largest size at which the title fits in max_lines."""
    size = start
    while size > floor:
        fnt = display(size)
        lines = wrap(draw, text, fnt, max_width)
        if len(lines) <= max_lines:
            return fnt, lines, size
        size -= 4
    fnt = display(floor)
    return fnt, wrap(draw, text, fnt, max_width)[:max_lines], floor


def card(book, site):
    img = Image.new("RGB", (W, H), book["paper"])
    d = ImageDraw.Draw(img)
    accent, ink, muted = book["accent"], book["ink"], book["muted"]

    d.rectangle([0, 0, W, 9], fill=accent)

    inner = W - MARGIN * 2
    y = 96

    kicker = f"{book['author']} · {book['years']}".upper()
    tracked(d, (MARGIN, y), kicker, label(25), accent, 2.6)
    y += 62

    fnt, lines, size = fit_title(d, book["title"], inner)
    for line in lines:
        d.text((MARGIN, y), line, font=fnt, fill=ink)
        y += int(size * 1.16)

    y += 14
    d.rectangle([MARGIN, y, MARGIN + 132, y + 3], fill=accent)
    y += 40

    blurb = label(29, "medium")
    for line in wrap(d, book["blurb"], blurb, inner)[:2]:
        d.text((MARGIN, y), line, font=blurb, fill=muted)
        y += 42

    foot = label(21)
    fy = H - MARGIN - 6
    d.rectangle([MARGIN, fy - 30, W - MARGIN, fy - 29], fill=muted)
    tracked(d, (MARGIN, fy), site["name"].upper(), foot, ink, 3.0)
    right = "ILLUSTRATED SUMMARY"
    rw = tracked_width(d, right, foot, 3.0)
    tracked(d, (W - MARGIN - rw, fy), right, foot, muted, 3.0)
    return img


def home_card(site, count):
    img = Image.new("RGB", (W, H), "#f4f1e9")
    d = ImageDraw.Draw(img)
    accent, ink, muted = "#2f6f69", "#191b1d", "#747a7d"

    d.rectangle([0, 0, W, 9], fill=accent)
    y = 150
    tracked(d, (MARGIN, y), "PERSONAL LIBRARY · ILLUSTRATED SUMMARIES", label(25), accent, 2.6)
    y += 74
    fnt = display(104)
    d.text((MARGIN, y), site["name"], font=fnt, fill=ink)
    y += 132
    d.rectangle([MARGIN, y, MARGIN + 132, y + 3], fill=accent)
    y += 40
    blurb = label(30, "medium")
    text = "Chapter-by-chapter summaries of the books worth keeping close — built to be read on a phone, argued with, and returned to."
    for line in wrap(d, text, blurb, W - MARGIN * 2)[:2]:
        d.text((MARGIN, y), line, font=blurb, fill=muted)
        y += 43

    foot = label(21)
    fy = H - MARGIN - 6
    d.rectangle([MARGIN, fy - 30, W - MARGIN, fy - 29], fill=muted)
    tracked(d, (MARGIN, fy), site["byline"].upper(), foot, ink, 3.0)
    right = f"{count} SUMMARIES"
    rw = tracked_width(d, right, foot, 3.0)
    tracked(d, (W - MARGIN - rw, fy), right, foot, muted, 3.0)
    return img


def main():
    data = json.loads((ROOT / "tools" / "books.json").read_text(encoding="utf-8"))
    OUT.mkdir(exist_ok=True)

    home_card(data["site"], len(data["books"])).save(OUT / "index.png", optimize=True)
    print("og/index.png")
    for book in data["books"]:
        card(book, data["site"]).save(OUT / f"{book['slug']}.png", optimize=True)
        print(f"og/{book['slug']}.png")
    return 0


if __name__ == "__main__":
    sys.exit(main())
