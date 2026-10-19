"""Attach to Karen's Chrome over CDP, run steps on the United tab, dump state. NEVER submits.
usage: cdp.py TAG step...  step = click:Name | fill:Name=value | press:Key | type:Name=value | wait:ms"""
import re, sys
from playwright.sync_api import sync_playwright

tag, *steps = sys.argv[1:]
with sync_playwright() as p:
    b = p.chromium.connect_over_cdp("http://127.0.0.1:9222")
    pages = [pg for c in b.contexts for pg in c.pages if "united.com" in pg.url]
    pg = pages[-1]
    pg.bring_to_front()
    for s in steps:
        kind, _, arg = s.partition(":")
        assert not re.search(r"^(submit|send)", arg, re.I), "never submit"
        if kind == "click":
            loc = pg.get_by_role("button", name=arg, exact=True).or_(pg.get_by_role("link", name=arg, exact=True)).or_(
                pg.get_by_role("radio", name=arg, exact=True)).or_(pg.get_by_role("option", name=arg, exact=True)).or_(
                pg.get_by_role("tab", name=arg, exact=True)).or_(pg.get_by_role("checkbox", name=arg, exact=True))
            loc.first.click(timeout=15000)
        elif kind == "fill":
            n, _, v = arg.partition("=")
            pg.get_by_role("textbox", name=n, exact=True).first.fill(v, timeout=15000)
        elif kind == "type":
            n, _, v = arg.partition("=")
            l = pg.get_by_role("combobox", name=n, exact=True).or_(pg.get_by_role("textbox", name=n, exact=True)).first
            l.click(); l.press_sequentially(v, delay=80)
        elif kind == "select":
            n, _, v = arg.partition("=")
            pg.get_by_role("combobox", name=n, exact=True).first.select_option(label=v)
        elif kind == "press":
            pg.keyboard.press(arg)
        elif kind == "wait":
            pg.wait_for_timeout(int(arg))
        pg.wait_for_timeout(2500)
    print("URL:", pg.url)
    root = pg.locator("main").first if pg.locator("main").count() else pg.locator("body")
    snap = root.aria_snapshot()
    open(f"{tag}.aria.txt", "w").write(f"# URL: {pg.url}\n" + snap)
    print(snap[:6000])
    dlg = pg.get_by_role("dialog")
    if dlg.count():
        print("--- DIALOG ---")
        print(dlg.first.aria_snapshot()[:3000])
    pg.screenshot(path=f"{tag}.png")
