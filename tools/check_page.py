#!/usr/bin/env python3
"""One-look check of a summary page before it ships (needs Playwright + Chromium).

    python3 tools/check_page.py <slug> [--out DIR]

Serves the repo over http (so localStorage and relative links behave as on the
site), loads the page at desktop and phone width, and prints one line per check:
script errors, sideways scrolling on a phone, the phone Contents button (opens,
jumps, names the section), the Aa and Theme buttons, and the related-books nav.
Screenshots of the desktop hero and the phone view land in DIR for one look.
Exit 0 only when every check passes.
"""

import argparse
import functools
import http.server
import pathlib
import sys
import threading

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("slug")
    parser.add_argument("--out", default=None)
    args = parser.parse_args()
    page_file = ROOT / f"{args.slug}.html"
    if not page_file.exists():
        raise SystemExit(f"no page: {page_file.name}")
    out = pathlib.Path(args.out or f"/tmp/book-check-{args.slug}")
    out.mkdir(parents=True, exist_ok=True)

    http.server.SimpleHTTPRequestHandler.log_message = lambda *a: None
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{httpd.server_address[1]}/{args.slug}.html"

    results = []

    def check(name, ok, detail=""):
        results.append(ok)
        print(("PASS " if ok else "FAIL ") + name + (f" ({detail})" if detail else ""))

    with sync_playwright() as p:
        browser = p.chromium.launch()
        errors = []

        desk = browser.new_page(viewport={"width": 1280, "height": 900})
        desk.on("pageerror", lambda e: errors.append(str(e)))
        desk.goto(url, wait_until="networkidle")
        desk.wait_for_timeout(800)
        desk.screenshot(path=str(out / "desktop-hero.png"))
        check("related-books nav injected", desk.locator(".book-nav").count() == 1)
        check("desktop rail present", desk.locator(".rail a").count() > 3,
              f"{desk.locator('.rail a').count()} links")
        check("desktop Back button visible", desk.locator(".chip--back").is_visible())

        ctx = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True,
                                  has_touch=True, device_scale_factor=2)
        phone = ctx.new_page()
        phone.on("pageerror", lambda e: errors.append(str(e)))
        phone.goto(url, wait_until="networkidle")
        phone.wait_for_timeout(600)
        phone.screenshot(path=str(out / "phone-top.png"))
        check("phone Back button visible", phone.locator(".chip--back").is_visible()
              and phone.get_attribute(".chip--back", "href") == "index.html")
        check("phone Contents button visible", phone.locator("#tocOpen").is_visible())
        check("phone Aa button visible", phone.locator(".chip--aa").is_visible())
        check("phone Theme button visible", phone.locator("#themeToggle").is_visible())

        targets = phone.eval_on_selector_all(".rail a[href^='#']", "els => els.map(e => e.getAttribute('href'))")
        target = targets[len(targets) // 2] if targets else None
        if target and phone.locator("#tocOpen").is_visible():
            phone.tap("#tocOpen")
            phone.wait_for_timeout(300)
            phone.locator(f"#tocSheet a[href='{target}']").tap()
            phone.wait_for_timeout(3200)
            top = phone.evaluate(f"Math.round(document.getElementById('{target[1:]}').getBoundingClientRect().top)")
            bar = phone.evaluate("Math.round(document.querySelector('.chrome').getBoundingClientRect().bottom)")
            check("Contents jump lands below the top bar", bar <= top <= bar + 60, f"{target} top={top}, bar={bar}")
            label = phone.inner_text("#tocOpen").replace("\n", " ")
            check("button names the current section", len(label.split()) > 1, label)
        else:
            check("Contents jump", False, "no rail targets or no button")

        phone.evaluate("window.scrollTo({left: 400, top: window.scrollY, behavior: 'instant'})")
        check("no sideways scroll on a phone", phone.evaluate("window.scrollX") == 0)
        check("no script errors", not errors, "; ".join(errors[:3]))
        browser.close()
    httpd.shutdown()
    print(f"screenshots: {out}")
    return 0 if all(results) else 1


if __name__ == "__main__":
    sys.exit(main())
