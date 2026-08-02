#!/usr/bin/env python3
"""Render the 1200x630 link-preview cards in og/ from tools/books.json.

The site itself has no build step — these PNGs are committed and served as
static files. Re-run this only when a book is added or its palette changes:

    python3 tools/make-og-images.py

Requires Pillow. It prefers the macOS system fonts (Iowan Old Style, Avenir
Next), which are the faces the pages ask for in CSS, and falls back to the
nearest Linux equivalents (Bitstream Charter, Liberation Sans) so it also runs
on the agent droplet.
"""

import json
import pathlib
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "og"

W, H = 1200, 630
MARGIN = 88

# Faces in preference order, as (path, collection index). macOS comes first so
# regenerating on a Mac reproduces the cards already committed here; the Linux
# entries let the agent droplet render a new card without a visible break in
# style. Iowan Old Style is a Charter derivative and Charter is the second name
# in the pages' own CSS font stack, so Bitstream Charter is the right stand-in.
DISPLAY_FACES = {
    True: [
        ("/System/Library/Fonts/Supplemental/Iowan Old Style.ttc", 1),
        ("/usr/share/fonts/X11/Type1/c0632bt_.pfb", 0),                 # Charter Bold
        ("/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf", 0),
        ("/System/Library/Fonts/Supplemental/Georgia.ttf", 0),
    ],
    False: [
        ("/System/Library/Fonts/Supplemental/Iowan Old Style.ttc", 0),
        ("/usr/share/fonts/X11/Type1/c0648bt_.pfb", 0),                 # Charter Regular
        ("/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf", 0),
        ("/System/Library/Fonts/Supplemental/Georgia.ttf", 0),
    ],
}

_LIB = "/usr/share/fonts/truetype/liberation/"
LABEL_FACES = {
    "demi":   [("/System/Library/Fonts/Avenir Next.ttc", 2), (_LIB + "LiberationSans-Bold.ttf", 0)],
    "medium": [("/System/Library/Fonts/Avenir Next.ttc", 5), (_LIB + "LiberationSans-Regular.ttf", 0)],
    "bold":   [("/System/Library/Fonts/Avenir Next.ttc", 0), (_LIB + "LiberationSans-Bold.ttf", 0)],
}
LABEL_LAST_RESORT = [("/System/Library/Fonts/Helvetica.ttc", 0),
                     ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 0)]


def font(candidates, size):
    """First loadable face in the list, so this runs on macOS and on Linux."""
    for path, index in candidates:
        try:
            return ImageFont.truetype(path, size, index=index)
        except OSError:
            continue
    raise OSError("no usable font among: " + ", ".join(p for p, _ in candidates))


def display(size, bold=True):
    return font(DISPLAY_FACES[bool(bold)], size)


def label(size, weight="demi"):
    return font(LABEL_FACES[weight] + LABEL_LAST_RESORT, size)


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
