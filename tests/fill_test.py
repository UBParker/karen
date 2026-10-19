"""fill.js against the saved DOT pages (synthetic shadow DOM, so fields are in the light DOM).
run: uv run --with playwright python tests/fill_test.py"""
import json, pathlib, re
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
FILL = (ROOT / "fill.js").read_text()
ANS = json.loads((ROOT / "tests/fixtures/dot/probe_answers.json").read_text())
ANS["textarea"] = ANS.pop("")

def load(pg, n):
    html = re.sub(r"<script\b.*?</script>", "", (ROOT / f"tests/fixtures/dot/page{n}.html").read_text(), flags=re.S)
    html = re.sub(r'\s(value|checked|data-value|readonly|aria-readonly)="[^"]*"(?=[^>]*(type="(text|radio|checkbox)"|slds-input|slds-textarea|role="combobox"))', "", html)
    html = re.sub(r"<textarea([^>]*)>.*?</textarea>", r"<textarea\1></textarea>", html, flags=re.S)
    pg.set_content(html)
    pg.evaluate("window.chrome = {runtime: {sendMessage() {}}}")
    pg.add_script_tag(content=FILL)
    pg.evaluate("karenTest.setJob({id: 't'})")

with sync_playwright() as p:
    pg = p.chromium.launch().new_page()
    load(pg, 1)
    names = pg.evaluate("[...document.querySelectorAll('input,select')].filter(e=>e.getClientRects().length).map(karenTest.name)")
    print("page1 names:", names)
    for want in ["I am a(n)", "First Name", "Country", "State/Province", "Phone (Format of ###-###-####)"]: assert want in names, want
    n = pg.evaluate("async a => { const t = new Set(); let n = 0; while (n < 60 && await karenTest.fillOnce(a, t)) n++; return n }", ANS)
    vals = pg.evaluate("Object.fromEntries([...document.querySelectorAll('input,select')].filter(e=>e.getClientRects().length).map(e=>[karenTest.name(e), e.value]))")
    print("page1 filled", n, vals)
    assert vals["First Name"] == "Test" and vals["Verify Email Address"] == ANS["Email Address"]
    assert vals["State/Province"].endswith("CO")

    load(pg, 3)
    groups = pg.evaluate("[...new Set([...document.querySelectorAll('input[type=radio]')].map(karenTest.group))]")
    print("page3 groups:", groups)
    assert "What was the main problem?" in groups
    pg.evaluate("async a => { const t = new Set(); let n = 0; while (n < 60 && await karenTest.fillOnce(a, t)) n++ }", ANS)
    checked = pg.evaluate("[...document.querySelectorAll('input:checked')].map(e => karenTest.name(e) + ' / ' + karenTest.group(e))")
    print("page3 checked:", checked)
    assert any(c.startswith("Flight Problem") for c in checked) and any(c.startswith("Maintenance") for c in checked)

    load(pg, 4)
    pg.evaluate("async a => { const t = new Set(); while (await karenTest.fillOnce(a, t)); }", ANS)
    assert pg.evaluate("document.querySelector('textarea').value").startswith("Probe text")

    load(pg, 5)
    pg.evaluate("async a => { const t = new Set(); while (await karenTest.fillOnce({...a, 'I affirm, to the best of my knowledge and belief, that this complaint submission is true and accurate.': true}, t)); }", ANS)
    assert not pg.evaluate("[...document.querySelectorAll('input[type=checkbox]')].some(e => e.checked)"), "affirm box must stay unchecked"
    print("OK")
