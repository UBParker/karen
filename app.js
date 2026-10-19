import { unitedLetter, dotLetter, UNITED_MAX, DOT_MAX } from "./letters.js";
import { dotAnswers, unitedPlan } from "./answers.js";
import { canSpeak, dictate } from "./speech.js";

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const get = async (k, d) => (await chrome.storage.local.get(k))[k] ?? d;
const put = (k, v) => chrome.storage.local.set({ [k]: v });

// [key, label, kind, options, more, when]: `more` fields sit under "More details"; `when` ("key=value") shows a follow-up only after that answer.
const FACTS = [
  ["flightNumber", "United flight number", "text"], ["date", "Flight date", "date"],
  ["origin", "From (airport code, e.g. DEN)", "text"], ["destination", "To (airport code)", "text"],
  ["problem", "What happened", "sel", ["delayed", "cancelled", "diverted"]], ["delayHours", "How many hours late did you arrive?", "num", 0, 0, "problem=delayed"],
  ["cause", "Reason United gave", "sel", [["maintenance", "Maintenance (United's fault)"], ["crew", "Crew problem (United's fault)"], ["technology", "United's own systems (United's fault)"], ["ops", "Cleaning, baggage loading or fueling (United's fault)"], ["weather", "Weather (not United's fault)"], ["atc", "Air traffic control (not United's fault)"], ["other", "Other or not sure"]]],
  ["rebookedFree", "Did United offer to rebook you for free?", "bool", 0, 0, "problem=delayed"],
  ["rebookSpend", "How much did you spend to rebook? ($, 0 if nothing)", "num", 0, 0, "rebookedFree=false"],
  ["reimbursed", "How much has United reimbursed so far? ($)", "num", 0, 0, "rebookedFree=false"],
  ["mealRequestDenied", "Did you ask for a meal and get refused?", "bool", 0, 0, "problem=delayed"],
  ["mealSpend", "How much did you spend on meals? ($)", "num", 0, 0, "mealRequestDenied=true"],
  ["overnight", "Did the delay run overnight?", "bool", 0, 0, "problem=delayed"],
  ["flew", "Did you still take that flight?", "bool", 0, 1], ["confirmation", "Confirmation number (6 characters, helps Karen find your trip)", "text", 0, 1],
  ["firstToldWhen", "When were you first told?", "sel", ["before_leaving", "at_airport_before_departure", "after_scheduled_departure"], 1],
  ["schedArr", "Scheduled arrival", "time", 0, 1], ["actualArr", "Actual arrival", "time", 0, 1], ["arrDate", "Arrival date (if different)", "date", 0, 1],
  ["mealVoucherPerPerson", "Meal voucher per person ($, 0 if none)", "num", 0, 1], ["passengers", "Passengers on the booking", "num", 0, 1],
  ["itinerary", "Itinerary", "sel", ["One-Way", "Round Trip", "Multi-Stop"], 1], ["boughtDirect", "Bought directly from United?", "bool", 0, 1],
  ["impact", "What it cost you (time, plans, money)", "area", 0, 1],
];
const HINTS = {
  cause: `United often says why in its delay email or text, or under flight status in the United app. With an AI key, Karen reads it from a screenshot. DOT counts maintenance, crew, cleaning, baggage loading and fueling problems as the airline's fault (<a href="https://www.transportation.gov/airconsumer/airline-cancellation-delay-dashboard" target="_blank" rel="noopener">DOT</a>); for those, United promises a meal after 3 hours and a hotel if it runs overnight.`,
};
const ASKS = { "Full refund": "a full refund of the ticket to my original form of payment", "Miles or credit": "compensation in MileagePlus miles or a travel credit", "Reimburse my costs": "reimbursement of the expenses the delay caused me", "Compensation": "fair compensation for the disruption" };
const DEFAULTS = { airline: "United", passengers: 1, flew: true, itinerary: "One-Way", boughtDirect: true };
// Starred in the form: everything required() can ask for (follow-ups only show when they apply), plus DOT's required contact fields.
const MUST = new Set(["flightNumber", "date", "origin", "destination", "problem", "delayHours", "rebookedFree", "mealRequestDenied", "overnight", "rebookSpend", "reimbursed", "mealSpend", "first", "last", "street", "city", "state", "zip", "email"]);
const STAR = ` <b class="star" title="Needed to file">*</b>`;
// What Karen must know before filing; follow-ups only when they apply (DOT requires them).
function required(f) {
  const r = ["flightNumber", "date", "origin", "destination", "problem"];
  if (f.problem === "delayed") r.push("delayHours", "rebookedFree", "mealRequestDenied", "overnight");
  if (f.rebookedFree === false) r.push("rebookSpend", "reimbursed");
  if (f.mealRequestDenied === true) r.push("mealSpend");
  return r.filter((k) => f[k] == null);
}
const toMin = (t) => t && +t.slice(0, 2) * 60 + +t.slice(3, 5);
function derive(f) {
  f.flightNumber = f.flightNumber && String(f.flightNumber).replace(/\D/g, "") || null;
  const late = f.schedArr && f.actualArr ? (toMin(f.actualArr) - toMin(f.schedArr) + 1440) % 1440 : null;
  f.delayMinutes = f.delayHours != null ? Math.round(f.delayHours * 60) : late ?? f.delayMinutes ?? null;
  if (f.delayHours == null && f.delayMinutes != null) f.delayHours = +(f.delayMinutes / 60).toFixed(1);
  return f;
}
const PROFILE = [["first", "First name", "given-name"], ["last", "Last name", "family-name"], ["street", "Street address", "street-address"], ["city", "City", "address-level2"], ["state", "State (2 letters)", "address-level1"], ["zip", "ZIP", "postal-code"], ["phone", "Phone", "tel"], ["email", "Email", "email"]];

function input(key, label, kind, opts, val, miss, ac, when) {
  const v = esc(val);
  const field =
    kind === "sel" ? `<select name="${key}"><option value=""></option>${opts.map((o) => { const [v, t] = Array.isArray(o) ? o : [o, o]; return `<option value="${v}" ${v === val ? "selected" : ""}>${t}</option>`; }).join("")}</select>`
    : kind === "bool" ? `<span class="yn">${[["true", "Yes"], ["false", "No"]].map(([v, t]) => `<input type="radio" id="${key}-${v}" name="${key}" value="${v}" data-bool ${String(val) === v ? "checked" : ""}><label for="${key}-${v}">${t}</label>`).join("")}</span>`
    : kind === "area" ? `<textarea name="${key}" style="min-height:60px">${v}</textarea>${key === "impact" && canSpeak ? ` <button type="button" class="mic" data-for="[name=impact]">🎤 Speak it</button>` : ""}`
    : `<input name="${key}" type="${kind === "num" ? "number" : kind}" value="${v}"${ac ? ` autocomplete="${ac}"` : ""}>`;
  const tag = kind === "bool" ? "div" : "label";
  const hint = HINTS[key] ? `<small class="muted" style="grid-column:2">${HINTS[key]}</small>` : "";
  return `<${tag} class="q${miss ? " miss" : ""}"${when ? ` data-when="${when}"` : ""}><span>${label}${MUST.has(key) ? STAR : ""}</span>${field}${hint}</${tag}>`;
}
function read(form) {
  const o = {};
  for (const el of form.elements) {
    if (!el.name || el.type === "file") continue;
    if (el.type === "radio") { if (el.checked) o[el.name] = el.value === "true"; else if (!(el.name in o)) o[el.name] = null; continue; }
    const v = el.value.trim();
    o[el.name] = v === "" ? null : el.dataset.bool !== undefined ? v === "true" : el.type === "number" ? +v : el.name === "origin" || el.name === "destination" || el.name === "confirmation" ? v.toUpperCase() : v;
  }
  return o;
}
const fileToData = (f) => new Promise((r) => { const fr = new FileReader(); fr.onload = () => r({ name: f.name, type: f.type, dataURL: fr.result }); fr.readAsDataURL(f); });

async function save(c) {
  const list = await get("complaints", []);
  const i = list.findIndex((x) => x.id === c.id);
  i < 0 ? list.unshift(c) : (list[i] = c);
  await put("complaints", list);
}

const STATUS = (c) => c.status === "done" ? "Done" : c.refs.united && c.refs.dot ? "Filed with both, waiting for replies" : c.refs.united ? "Filed with United, DOT next" : c.refs.dot ? "Filed with DOT, United next" : "Not filed yet";

async function list() {
  document.onpaste = document.ondrop = null;
  const cs = await get("complaints", []);
  $("#view").innerHTML = `<h2>Complaints</h2><button id="new">New complaint</button>` +
    (cs.map((c) => `<div class="row"><div><b>UA ${esc(c.facts.flightNumber || "?")}</b> ${esc(c.facts.origin || "")}→${esc(c.facts.destination || "")} ${esc(c.facts.date || "")}<div class="muted">${STATUS(c)}</div></div><button data-open="${c.id}">Open</button></div>`).join("") || `<p class="muted">No complaints yet. Start one while you're still at the airport; Karen saves it so you can file after the flight.</p>`);
  $("#new").onclick = () => edit({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), status: "draft", facts: { ...DEFAULTS }, letters: {}, screenshots: [], refs: {}, log: [] });
  document.querySelectorAll("[data-open]").forEach((b) => (b.onclick = () => edit(cs.find((c) => c.id === b.dataset.open))));
}

async function edit(c, missing = []) {
  const key = await get("apiKey", "");
  const ai = { provider: await get("aiProvider", "anthropic"), key, workspace: await get("aiWorkspace", "") };
  const keepWorkspace = () => ai.workspace && put("aiWorkspace", ai.workspace);
  const profile = await get("profile", {});
  const needContact = PROFILE.some(([k]) => !profile[k]);
  const field = ([k, l, t, o, , w]) => input(k, l, t, o, c.facts[k], missing.includes(k), null, w);
  const shots = `<input type="file" id="shots" multiple accept="image/*,.pdf"> ${c.screenshots.length} attached`;
  // AI mode: the person describes what happened; the form only shows what Karen still needs.
  const ask = FACTS.filter(([k, , , , , w]) => missing.includes(k) || (w && missing.includes(w.split("=")[0])));
  const formFields = !key ? `${FACTS.filter((x) => !x[4]).map(field).join("")}
      <details ${FACTS.some((x) => x[4] && missing.includes(x[0])) ? "open" : ""}><summary>More details (optional, makes the complaint stronger)</summary>${FACTS.filter((x) => x[4]).map(field).join("")}</details>`
    : c.understood ? `${ask.length ? `<p><b>Karen just needs to know:</b></p>${ask.map(field).join("")}` : `<p><b>Karen has what she needs.</b></p>`}
      <details><summary>Check what Karen understood</summary>${FACTS.filter((x) => !ask.includes(x)).map(field).join("")}</details>`
    : `<details><summary>Or fill in the details yourself</summary>${FACTS.map(field).join("")}</details>`;
  $("#view").innerHTML = `
    <h2>1. What happened?</h2>
    <p class="muted"><b class="star">*</b> = needed to file. Everything else is optional but makes the complaint stronger.</p>
    ${key ? `<textarea id="story" style="min-height:90px" placeholder="In your own words, e.g. 'Denver to Chicago, delayed 5 hours for maintenance, they only told us after we should have left, no meal voucher, missed my sister's dinner.'">${esc(c.story)}</textarea>
    <p class="muted">Paste (⌘V / Ctrl+V) or drop screenshots of United's emails or app anywhere on this page: the delay notice, your booking, the reason given. ${shots}</p>
    <p>${canSpeak ? `<button type="button" class="mic" data-for="#story" data-go="1">🎤 Speak it</button> ` : ""}<button id="go" style="font-weight:700">${c.understood ? "Read it again" : "Let Karen work it out"}</button> <span class="busy muted"></span></p>`
    : `<p class="muted">Paste (⌘V / Ctrl+V) or drop screenshots from the United app anywhere on this page. They're attached to both complaints. ${shots} <span class="busy muted"></span></p>
    ${canSpeak ? `<p><button type="button" class="mic" data-for="[name=impact]" data-open="1">🎤 Say what it cost you</button></p>` : ""}
    <p class="muted">Want Karen to read your screenshots and description instead of filling this in? Add an AI key in Settings.</p>`}
    ${missing.length ? `<p class="over">Please answer the highlighted questions.</p>` : ""}
    <form id="facts">${formFields}
      <h2>2. What do you want?</h2><p>${Object.keys(ASKS).map((k) => `<button type="button" data-ask="${k}">${k}</button>`).join("")}</p>
      <textarea name="ask" style="min-height:50px" placeholder="Leave blank and Karen picks a fair ask">${esc(c.facts.ask)}</textarea>
    </form>
    <h2>3. Your letters</h2>
    <p class="muted">${key ? "" : "Karen writes these as you type. "}Edit them if you like.${key ? ` <button id="write">Write letters with AI</button>` : c.lettersEdited ? ` <button id="write">Rewrite from the form</button>` : ""}</p>
    <h3>To United <span class="muted" id="uc"></span></h3><textarea id="lu">${esc(c.letters.united)}</textarea>
    <h3>To DOT <span class="muted" id="dc"></span></h3><textarea id="ld">${esc(c.letters.dot)}</textarea>
    <h2>4. File</h2>
    ${needContact ? `<form id="contact" autocomplete="on"><p><b>Your contact details for the DOT form</b> <span class="muted">(asked once, then remembered; click First name to let Chrome fill them in)</span></p>${PROFILE.map(([k, l, ac]) => input(k, l, ac === "email" ? "email" : ac === "tel" ? "tel" : "text", null, profile[k], false, ac)).join("")}</form>` : ""}
    <p><button id="fileB" style="font-weight:700">File with United + DOT</button><button id="fileU">United only</button><button id="fileD">DOT only</button> <span class="busy over"></span></p>
    <div class="muted"><b>What happens next</b><ol>
      <li><b>United</b> opens in a new tab. Sign in if asked. If Karen can't tell which trip this is, click your <b>trip</b>, then pick the <b>flight leg</b> and click Continue.
        <div class="takeover">✋ That's all you do. <b>Karen takes over from there and fills in the rest of United's form for you.</b></div></li>
      <li><b>DOT</b> opens in another tab. You don't need to do anything to start.
        <div class="takeover">🤖 <b>Karen fills in every page of the DOT form for you.</b> If a question needs your answer, she tells you which one; answer it and click Continue on her note.</div></li>
      <li>Each form stops on its review page. Read it and click <b>Submit</b> yourself (on DOT, tick the "I affirm" box first). Karen notices and marks it filed.</li>
    </ol></div>
    <p class="muted">${c.refs.united ? `United: filed ${c.refs.united === "submitted" ? "" : `(case ${esc(c.refs.united)})`}` : "United: not filed"} · ${c.refs.dot ? `DOT: filed ${c.refs.dot === "submitted" ? "" : `(case ${esc(c.refs.dot)})`}` : "DOT: not filed"}</p>
    <p><button id="save">Save</button><button id="didU">I filed with United</button><button id="didD">I filed with DOT</button><button id="done">Mark done</button><button id="del">Delete</button></p>
    <div class="muted">${(c.log || []).slice(-5).map((l) => esc(l.at.slice(0, 16) + " " + l.text)).join("<br>")}</div>`;

  const count = () => {
    $("#uc").innerHTML = `<span class="${$("#lu").value.length > UNITED_MAX ? "over" : ""}">${$("#lu").value.length}/${UNITED_MAX}</span>`;
    $("#dc").innerHTML = `<span class="${$("#ld").value.length > DOT_MAX ? "over" : ""}">${$("#ld").value.length}/${DOT_MAX}</span>`;
  };
  $("#lu").oninput = $("#ld").oninput = count; count();
  const sync = () => { c.facts = derive({ ...c.facts, ...read($("#facts")) }); c.letters = { united: $("#lu").value, dot: $("#ld").value }; };
  const basics = () => (key ? required(c.facts) : ["flightNumber", "date", "origin", "destination", "problem"].filter((k) => c.facts[k] == null));
  const reveal = () => document.querySelectorAll("[data-when]").forEach((l) => { const [k, v] = l.dataset.when.split("="); l.hidden = String(c.facts[k]) !== v; });
  const autoWrite = () => {
    sync(); reveal();
    if (key || c.lettersEdited || basics().length) return;
    c.letters = { united: unitedLetter(c.facts, profile), dot: dotLetter(c.facts, profile, c.refs) };
    $("#lu").value = c.letters.united; $("#ld").value = c.letters.dot; count(); save(c);
  };
  $("#facts").oninput = $("#facts").onchange = autoWrite;
  reveal();
  $("#lu").addEventListener("input", () => (c.lettersEdited = true));
  $("#ld").addEventListener("input", () => (c.lettersEdited = true));
  document.querySelectorAll("[data-ask]").forEach((b) => (b.onclick = () => { $("[name=ask]").value = ASKS[b.dataset.ask]; autoWrite(); }));
  const addFiles = async (files) => {
    sync(); c.screenshots.push(...(await Promise.all([...files].map(fileToData)))); await save(c);
    await edit(c, missing);
    if (key && $("#story").value.trim() && [...files].some((f) => f.type.startsWith("image/"))) $("#go").click();
  };
  document.onpaste = (e) => e.clipboardData.files.length && addFiles(e.clipboardData.files);
  document.ondragover = (e) => e.preventDefault();
  document.ondrop = (e) => { e.preventDefault(); addFiles(e.dataTransfer.files); };
  const busy = (t) => document.querySelectorAll(".busy").forEach((e) => (e.textContent = t));

  $("#shots").onchange = (e) => addFiles(e.target.files);
  const writeAI = async () => {
    busy("Writing your letters…");
    try { const { writeLetters } = await import("./ai.bundle.js"); c.letters = await writeLetters(ai, c.facts, profile, c.refs); keepWorkspace(); }
    catch (e) { busy("AI failed, used the template instead: " + e.message); c.letters = { united: unitedLetter(c.facts, profile), dot: dotLetter(c.facts, profile, c.refs) }; }
    c.lettersEdited = false;
    $("#lu").value = c.letters.united; $("#ld").value = c.letters.dot; count();
  };
  if ($("#go")) $("#go").onclick = async () => {
    sync(); c.story = $("#story").value.trim();
    if (!c.story && !c.screenshots.length) return busy("Tell Karen what happened or paste a screenshot first.");
    busy("Reading…");
    try {
      const { understand } = await import("./ai.bundle.js");
      const got = await understand(ai, c.story, c.screenshots);
      keepWorkspace();
      const { passengerFirst: first, passengerLast: last, passengerEmail: email, ...facts } = got;
      for (const [k, v] of Object.entries({ first, last, email })) if (v && !profile[k]) profile[k] = v;
      await put("profile", profile);
      for (const [k, v] of Object.entries(facts)) if (v != null && (c.facts[k] == null || k in DEFAULTS)) c.facts[k] = v;
      derive(c.facts);
      c.understood = true;
      if (!required(c.facts).length) await writeAI();
      await save(c);
      edit(c, required(c.facts));
    } catch (e) { busy("Karen couldn't read that: " + e.message); }
  };
  if ($("#write")) $("#write").onclick = async () => {
    sync();
    const f = c.facts;
    const need = ["flightNumber", "date", "origin", "destination", "problem"].filter((k) => f[k] == null);
    if (need.length) return edit(c, need);
    if (key) {
      busy("Writing…");
      try { const { writeLetters } = await import("./ai.bundle.js"); c.letters = await writeLetters(ai, f, profile, c.refs); keepWorkspace(); }
      catch (e) { busy("AI failed, used the template instead: " + e.message); c.letters = { united: unitedLetter(f, profile), dot: dotLetter(f, profile, c.refs) }; }
    } else c.letters = { united: unitedLetter(f, profile), dot: dotLetter(f, profile, c.refs) };
    c.lettersEdited = false;
    await save(c); edit(c);
  };
  $("#save").onclick = async () => { sync(); await save(c); busy("Saved."); };
  let stopMic;
  document.querySelectorAll(".mic").forEach((b) => (b.onclick = async () => {
    if (stopMic) return stopMic();
    if (b.dataset.open) $(b.dataset.for).closest("details").open = true;
    const label = b.textContent;
    b.textContent = "⏹ Stop";
    stopMic = await dictate($(b.dataset.for), document.querySelector(".busy"), (said) => {
      stopMic = null; b.textContent = label;
      if (b.dataset.go && said) $("#go").click();
    }).catch((e) => { busy("Speech isn't available here: " + e.message); b.textContent = label; return null; });
  }));
  if ($("#contact")) $("#contact").oninput = () => { Object.assign(profile, read($("#contact"))); put("profile", profile); };
  const file = async (kind) => {
    sync(); await save(c);
    const need = basics();
    if (need.length) { await edit(c, need); return busy("Answer the highlighted questions first."); }
    if (!c.letters.united || !c.letters.dot) { if (key) await writeAI(); else c.letters = { united: unitedLetter(c.facts, profile), dot: dotLetter(c.facts, profile, c.refs) }; await save(c); }
    const job = kind === "dot"
      ? { kind, id: c.id, answers: dotAnswers(c.facts, profile, c.letters.dot), files: c.screenshots, maxFiles: 5 }
      : { kind, id: c.id, plan: unitedPlan(c.facts, c.letters.united.slice(0, UNITED_MAX)), files: c.screenshots, maxFiles: 3 };
    chrome.runtime.sendMessage({ karen: "file", job });
    busy(`Opening ${kind === "dot" ? "the DOT form" : "United"}. Karen fills it in that tab and stops before Submit.`);
  };
  $("#fileB").onclick = async () => { await file("united"); if (!basics().length) await file("dot"), busy("Opening United and DOT. Karen fills both and stops before Submit."); };
  $("#fileU").onclick = () => file("united");
  $("#fileD").onclick = () => file("dot");
  const mark = async (status, ref) => {
    sync();
    if (ref) c.refs[ref] = prompt("Case number (optional):") || c.refs[ref] || "submitted";
    c.status = status; await save(c); edit(c);
  };
  $("#didU").onclick = () => mark("filed", "united");
  $("#didD").onclick = () => mark("filed", "dot");
  $("#done").onclick = () => mark("done");
  $("#del").onclick = async () => { if (confirm("Delete this complaint?")) { await put("complaints", (await get("complaints", [])).filter((x) => x.id !== c.id)); list(); } };
}

const PROVIDERS = {
  anthropic: { name: "Claude by Anthropic (recommended)", url: "https://platform.claude.com/settings/keys", steps: ["Click <b>Open Claude Console</b> and sign in, or create a free account.", "Under <b>Billing</b>, add a payment method or credits. You pay per use; this is separate from a Claude.ai subscription.", "Back on <b>API keys</b>, click <b>Create key</b>, name it Karen, pick one workspace (Default is fine), and copy the key.", "Paste it below and click Save."] },
  openai: { name: "ChatGPT by OpenAI", url: "https://platform.openai.com/api-keys", steps: ["Click <b>Open OpenAI Platform</b> and sign in with your ChatGPT login.", "Under <b>Settings → Billing</b>, add a payment method or credits. API use is billed separately from ChatGPT Plus.", "On <b>API keys</b>, click <b>Create new secret key</b>, name it Karen, and copy it.", "Paste it below and click Save."] },
};

async function settings() {
  const p = await get("profile", {}), key = await get("apiKey", ""), prov = await get("aiProvider", "anthropic");
  $("#view").innerHTML = `<h2>Your details</h2><p class="muted">Used to fill the DOT form. Stored only in this browser. Tip: click First name and pick your address from Chrome's suggestions to fill these in one go.</p>
    <form id="p" autocomplete="on">${PROFILE.map(([k, l, ac]) => input(k, l, ac === "email" ? "email" : ac === "tel" ? "tel" : "text", null, p[k], false, ac)).join("")}</form>
    <h2>AI (optional)</h2><p class="muted">With an API key, Karen can read your screenshots and write the letters. Without one, Karen uses templates and sends nothing to anyone.</p>
    <label class="q"><span>AI provider</span><select id="prov">${Object.entries(PROVIDERS).map(([k, v]) => `<option value="${k}" ${k === prov ? "selected" : ""}>${v.name}</option>`).join("")}</select></label>
    <p><button id="getKey">Get your API key</button></p><div id="steps"></div>
    <label class="q"><span>API key</span><input id="key" type="password" autocomplete="off" value="${esc(key)}"></label>
    <button id="saveS">Save</button> <span id="ok" class="muted"></span>`;
  const steps = () => {
    const v = PROVIDERS[$("#prov").value];
    $("#steps").innerHTML = `<ol>${v.steps.map((x) => `<li>${x}</li>`).join("")}</ol><p><a href="${v.url}" target="_blank" rel="noopener"><button>Open ${v.url.includes("claude") ? "Claude Console" : "OpenAI Platform"}</button></a></p>`;
  };
  $("#getKey").onclick = steps;
  $("#prov").onchange = () => $("#steps").innerHTML && steps();
  $("#saveS").onclick = async () => { await put("profile", read($("#p"))); await put("aiProvider", $("#prov").value); if ($("#key").value.trim() !== key) await put("aiWorkspace", ""); await put("apiKey", $("#key").value.trim()); $("#ok").textContent = "Saved."; };
}

const VIEWS = { list, settings };
document.querySelectorAll("nav button").forEach((b) => (b.onclick = () => VIEWS[b.dataset.view]()));
// First visit (or nothing open): go straight to a new complaint.
get("complaints", []).then((cs) => (cs.some((c) => c.status !== "done") ? list() : list().then(() => $("#new").click())));
