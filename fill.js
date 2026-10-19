// Injected into the DOT or United tab. Fills by visible label and stops before Submit.
// Hard rules: never click Submit, never check the DOT affirmation box, never type passwords.
(() => {
  if (window.karenRun) return;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const norm = (s) => (s || "").replace(/\*/g, "").replace(/\s+/g, " ").trim();
  const visible = (el) => !!el && el.isConnected && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
  const byIds = (ids) => (ids || "").split(/\s+/).map((id) => document.getElementById(id)?.textContent).filter(Boolean).join(" ");
  const FORBIDDEN = /^(submit|send)\b|^i affirm/i;

  function name(el) {
    const n = el.getAttribute("aria-label") || byIds(el.getAttribute("aria-labelledby")) ||
      (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent) ||
      el.closest("label")?.textContent || (["BUTTON", "A"].includes(el.tagName) || el.getAttribute("role") ? el.textContent : "");
    return norm(n) || (el.tagName === "TEXTAREA" ? "textarea" : "");
  }
  const group = (el) => norm(el.closest("fieldset")?.querySelector("legend")?.textContent || byIds(el.closest("[role=radiogroup],[role=group]")?.getAttribute("aria-labelledby")));
  const all = (sel) => [...document.querySelectorAll(sel)].filter(visible);
  const buttons = () => all("button, a, [role=button], [role=option]:not(option)");
  const findButton = (n, exact = true) => buttons().find((b) => (exact ? name(b) === n : name(b).includes(n)));

  // After Karen stops at review, the user clicks Submit. Notice it and look for a case number.
  function watchSubmit() {
    if (window.karenWatching) return;
    window.karenWatching = true;
    document.addEventListener("click", (e) => {
      const b = e.target.closest("button, [role=button]");
      if (!b || !/^submit\b/i.test(name(b)) || !e.isTrusted) return;
      const t0 = Date.now();
      const look = setInterval(() => {
        const gone = !b.isConnected || !visible(b);
        if (!gone && Date.now() - t0 < 30000) return;
        clearInterval(look);
        if (!gone) return; // Submit didn't go through (e.g. a required box unticked)
        const m = document.body.innerText.match(/(?:case|complaint|reference)\s*(?:number|no\.?|#|id)?\s*(?:is)?\s*[:#]?\s*(?=[A-Z-]*\d)([A-Z0-9][A-Z0-9-]{5,})/i);
        chrome.runtime.sendMessage({ karen: "submitted", id: job.id, kind: job.kind, ref: m?.[1] });
        say(m ? `filed. Case ${m[1]} saved in Karen.` : "filed. Marked in Karen.");
      }, 1500);
    }, true);
  }

  let banner;
  function say(text, resume) {
    banner ||= Object.assign(document.body.appendChild(document.createElement("div")), {
      style: "position:fixed;z-index:2147483647;bottom:16px;right:16px;max-width:360px;padding:12px 14px;background:#111;color:#fff;font:14px/1.4 system-ui;border-radius:8px;box-shadow:0 4px 20px #0006",
    });
    banner.textContent = "Karen: " + text;
    if (resume) {
      const b = banner.appendChild(document.createElement("button"));
      b.textContent = "Continue";
      b.style.cssText = "display:block;margin-top:8px";
      b.onclick = resume;
    }
    chrome.runtime.sendMessage({ karen: "log", id: job.id, text });
  }

  function click(el) {
    if (FORBIDDEN.test(name(el))) throw new Error("refusing to click " + name(el));
    el.scrollIntoView({ block: "center" });
    el.click();
  }
  function setValue(el, v) {
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement : el.tagName === "SELECT" ? HTMLSelectElement : HTMLInputElement;
    el.focus();
    Object.getOwnPropertyDescriptor(proto.prototype, "value").set.call(el, v);
    for (const t of ["input", "change"]) el.dispatchEvent(new Event(t, { bubbles: true, composed: true }));
    el.dispatchEvent(new FocusEvent("focusout", { bubbles: true, composed: true }));
    el.blur();
  }
  const labelFor = (el) => document.getElementById(el.getAttribute("aria-labelledby")) || (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) || el;
  async function until(fn, ms = 15000) {
    for (let t = 0; t < ms; t += 300) { const v = fn(); if (v) return v; await sleep(300); }
  }
  const settle = async () => { await sleep(900); await until(() => !all(".slds-spinner, [role=status] .slds-spinner_container").length, 20000); await sleep(300); };
  async function attach(input) {
    if (!job.files?.length || !input) return;
    const dt = new DataTransfer();
    for (const f of job.files.slice(0, job.maxFiles || 3)) dt.items.add(new File([await (await fetch(f.dataURL)).blob()], f.name, { type: f.type }));
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
  }

  // ---------- DOT ----------
  async function lookup(el, { type, pick }) {
    el.focus();
    el.click();
    await sleep(800);
    for (const ch of type) {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, el.value + ch);
      el.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
      el.dispatchEvent(new KeyboardEvent("keyup", { key: ch, bubbles: true, composed: true }));
      await sleep(120);
    }
    const opt = await until(() => all("[role=option]:not(option)").find((o) => o.textContent.includes(pick)), 10000);
    if (opt) opt.click();
    return !!opt;
  }

  // One pass over the visible fields; returns true if it changed something (new fields may appear).
  async function fillOnce(answers, tried) {
    const A = Object.fromEntries(Object.entries(answers).map(([k, v]) => [norm(k), v]));
    for (const el of all("input, select, textarea")) {
      const n = name(el), key = el.type === "radio" ? group(el) : n, want = A[key];
      if (el.type === "file" || el.type === "password" || want == null || tried.has(el)) continue;
      if (el.getAttribute("role") === "combobox" && el.tagName === "INPUT") {
        if (el.dataset.value || el.readOnly || typeof want !== "object") continue;
        tried.add(el);
        if (!(await lookup(el, want))) failed.push(n);
      } else if (el.tagName === "SELECT") {
        const opt = [...el.options].find((o) => norm(o.text) === want);
        if (!opt || el.value === opt.value) continue;
        setValue(el, opt.value);
      } else if (el.type === "radio") {
        const rs = all("input[type=radio]").filter((r) => group(r) === key);
        const target = rs.find((r) => name(r) === want);
        if (!target || rs.some((r) => r.checked)) continue;
        tried.add(el);
        click(labelFor(target));
      } else if (el.type === "checkbox") {
        if (want !== true || el.checked || FORBIDDEN.test(n)) continue;
        tried.add(el);
        click(labelFor(el));
      } else {
        if (el.value || typeof want === "object") continue;
        setValue(el, String(want));
      }
      await settle();
      return true;
    }
    return false;
  }

  const errors = () => [...new Set(all(".slds-has-error .slds-form-element__help, .slds-has-error[role=alert]").map((e) => norm(e.closest(".slds-form-element")?.querySelector("label, legend")?.textContent) || norm(e.textContent)).filter(Boolean))];
  const unanswered = () => [...new Set(all("input[required], select[required], textarea[required]")
    .filter((el) => el.type !== "file" && el.getAttribute("role") !== "combobox" && (el.type === "radio" ? !all(`input[name="${CSS.escape(el.name)}"]`).some((r) => r.checked) : !el.value || el.value === "--None--"))
    .map((el) => (el.type === "radio" ? group(el) : name(el))))];

  async function dot() {
    const begin = await until(() => findButton("Begin") || findButton("Next") || findButton("Submit"), 60000);
    if (begin && name(begin) === "Begin") { click(begin); await settle(); }
    for (let page = 0; page < 12; page++) {
      const nav = await until(() => findButton("Next") || findButton("Submit"), 60000);
      if (!nav) return say("the form didn't load. Reload the page and click File with DOT again.");
      if (name(nav) === "Submit") { watchSubmit(); return say("done. Read the review page, tick the affirmation box yourself, and click Submit."); }
      say(`filling page ${page + 1} of the DOT form for you. Sit back; I'll stop on the review page.`);
      const tried = new Set();
      for (let i = 0; i < 60 && (await fillOnce(job.answers, tried)); i++);
      if (all("input[type=file]").length && job.files?.length && !job.attached) { job.attached = true; await attach(all("input[type=file]")[0]); await settle(); await sleep(3000); }
      const missing = [...failed.splice(0), ...unanswered()];
      if (missing.length) return say("needs you: answer " + missing.slice(0, 4).map((m) => `"${m}"`).join(", ") + ", then click Continue.", resume);
      click(nav);
      await settle();
      await until(() => !nav.isConnected || errors().length, 30000);
      if (nav.isConnected) {
        const m = errors();
        return say("needs you: " + (m.slice(0, 4).join("; ") || "this page didn't advance") + ". Fix it, then click Continue.", resume);
      }
    }
  }
  function resume() { banner.querySelector("button")?.remove(); run(); }

  // ---------- United ----------
  const steps = {
    async dismiss(id) { const d = all("[role=dialog], dialog").find((x) => name(x).toLowerCase().includes(id) || x.id?.includes(id)); const b = d && [...d.querySelectorAll("button")].find((x) => name(x) === "Close"); if (b) { b.click(); await sleep(1000); } return true; },
    async trip(text) { const b = await until(() => buttons().find((x) => name(x).includes(text)), 20000); if (!b) throw new Error("click your trip, then pick the flight leg and click Continue"); click(b); return true; },
    async leg(parts) {
      const radios = all("input[type=radio], [role=radio]");
      const box = (r) => { let e = r; while (e.parentElement && e.parentElement.querySelectorAll("input[type=radio], [role=radio]").length === 1) e = e.parentElement; return e; };
      const r = radios.find((x) => parts.every((p) => box(x).textContent.includes(p)));
      if (!r) throw new Error("pick the flight leg and click Continue");
      if (!r.checked) click(labelFor(r) === r ? r : labelFor(r));
      return true;
    },
    async fill(n, v) { const el = await until(() => all("input, textarea").find((x) => name(x) === norm(n))); if (!el) throw new Error(`fill in "${norm(n)}"`); setValue(el, v); return true; },
    async attach(n) {
      if (!job.files?.length) return true;
      const b = findButton(n, false);
      if (b && b.getAttribute("aria-expanded") === "false") { b.click(); await sleep(1500); }
      const inputs = [...document.querySelectorAll("input[type=file]")];
      await attach(inputs[inputs.length - 1]); // index 0 is the expense receipt input
      await sleep(3000);
      return true;
    },
    async click(n) { const b = await until(() => findButton(n)); if (!b) throw new Error(`click "${n}"`); click(b); return true; },
  };

  async function united() {
    const done = new Set();
    for (let t = 0; t < 1200; t++, await sleep(1500)) {
      if (all("[role=dialog], dialog").some((d) => /sign in/i.test(name(d)))) { say("sign in to United. I'll continue after."); continue; }
      const step = job.plan.find((s) => location.pathname.includes(s.path));
      if (!step || done.has(location.pathname)) continue;
      done.add(location.pathname);
      if (step.stop) { watchSubmit(); return say("done. " + step.stop); }
      say("working on " + step.path.split("/").pop() + "…");
      try {
        for (const a of step.do) { const [k] = Object.keys(a); await steps[k](a[k], a.value); await sleep(2500); }
      } catch (e) { say(`needs you: ${e.message}. That's all you do: I'll take over from there and fill in the rest of the form for you.`); }
    }
  }

  let job;
  const failed = [];
  async function run() { try { await (job.kind === "dot" ? dot() : united()); } catch (e) { say("stopped: " + e.message); } }
  window.karenRun = (j) => { if (job) return; job = j; run(); };
  window.karenTest = { name, group, fillOnce, unanswered, setJob: (j) => (job = j) };
})();
