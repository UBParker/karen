// Optional AI mode: runs in the browser with the user's own Anthropic (default) or OpenAI API key.
// Built into ai.bundle.js by `npm run build`.
import Anthropic from "@anthropic-ai/sdk";
import { REFS, UNITED_MAX, DOT_MAX } from "./letters.js";

// No nullable or union types: the API caps those at 16 per schema. Every field is a plain string,
// "" means "not stated", and fromAI() converts back to numbers/booleans/null.
const s = (d) => ({ type: "string", description: d });
const n = (d) => ({ type: "string", description: `${d} Digits only, e.g. 300.` });
const b = (d) => ({ type: "string", enum: ["yes", "no", ""], description: d });
const e = (values, d = "") => ({ type: "string", enum: [...values, ""], description: d });
const FACTS = {
  flightNumber: s("digits only, e.g. 1234"), date: s("scheduled departure date YYYY-MM-DD"), arrDate: s("arrival date YYYY-MM-DD"),
  origin: s("IATA code"), destination: s("IATA code"),
  schedDep: s("HH:MM 24h"), schedArr: s("HH:MM 24h"), actualDep: s("HH:MM 24h"), actualArr: s("HH:MM 24h"),
  problem: e(["delayed", "cancelled", "diverted"]), delayMinutes: n("arrival delay in minutes."),
  cause: e(["maintenance", "crew", "technology", "ops", "weather", "atc", "other"], "the reason United itself gave (email, text, or app wording); ops = cleaning, baggage loading or fueling"),
  firstToldWhen: e(["before_leaving", "at_airport_before_departure", "after_scheduled_departure"]),
  flew: b("did the passenger fly the delayed flight"), rebookedFree: b("did United rebook them at no cost"), mealVoucherPerPerson: n("meal voucher value per person in USD; 0 if they said none."),
  mealRequestDenied: b("did they ask for a meal and get refused"), overnight: b("did the delay run overnight"), passengers: n("number of passengers."),
  mealSpend: n("USD spent on meals."), rebookSpend: n("USD spent to rebook."), reimbursed: n("USD already reimbursed."), confirmation: s("6-character confirmation code"),
  impact: s("what the disruption cost the passenger, in their words"), ask: s("what the passenger wants, if they said"),
  passengerFirst: s("passenger first name, e.g. from a booking email"), passengerLast: s("passenger last name"), passengerEmail: s("passenger email address"),
};
export function fromAI(o) {
  const out = {};
  for (const [k, v] of Object.entries(o)) {
    const spec = FACTS[k];
    if (v === "" || v == null || !spec) out[k] = null;
    else if (spec.enum?.includes("yes")) out[k] = v === "yes";
    else if (spec.description.includes("Digits only")) out[k] = Number.isFinite(parseFloat(v)) ? parseFloat(v) : null;
    else out[k] = v;
  }
  return out;
}
const schema = (props) => ({ type: "object", properties: props, required: Object.keys(props), additionalProperties: false });

// images: [{dataURL, type}]. Returns the parsed JSON object matching props.
const claude = (ai) => new Anthropic({ apiKey: ai.key, dangerouslyAllowBrowser: true, defaultHeaders: ai.workspace ? { "anthropic-workspace-id": ai.workspace } : {} });

async function pickWorkspace(ai) {
  const NEED = "Your Claude key works across several workspaces. In Claude Console, create a new key and pick one workspace for it (Default is fine), then paste that key in Settings.";
  const all = [];
  try { for await (const w of claude(ai).organization.workspaces.list({ include_default: true })) all.push(w); }
  catch { throw new Error(NEED); }
  const w = all.find((x) => x.name === "Default") || all[0];
  if (!w) throw new Error(NEED);
  return w.id;
}

async function ask(ai, images, text, props) {
  const { provider, key } = ai;
  if (provider === "openai") {
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "gpt-6-astra",
        input: [{ role: "user", content: [...images.map((f) => ({ type: "input_image", image_url: f.dataURL, detail: "auto" })), { type: "input_text", text }] }],
        text: { format: { type: "json_schema", name: "result", schema: schema(props), strict: true } },
      }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error?.message || `OpenAI error ${r.status}`);
    return JSON.parse(j.output.flatMap((o) => o.content || []).find((c) => c.type === "output_text").text);
  }
  const create = () => claude(ai).messages.create({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    output_config: { effort: "medium", format: { type: "json_schema", schema: schema(props) } },
    messages: [{ role: "user", content: [...images.map((f) => ({ type: "image", source: { type: "base64", media_type: f.type, data: f.dataURL.split(",")[1] } })), { type: "text", text }] }],
  });
  let msg;
  try { msg = await create(); }
  catch (e) {
    // Keys that span several workspaces must name one per request; find it once and remember it (ai.workspace).
    if (!(e instanceof Anthropic.BadRequestError) || ai.workspace || !/anthropic-workspace-id/.test(e.message)) throw e;
    ai.workspace = await pickWorkspace(ai);
    msg = await create();
  }
  if (msg.stop_reason === "refusal") throw new Error("Claude declined this request.");
  return JSON.parse(msg.content.find((c) => c.type === "text").text);
}

// The passenger's own description plus screenshots of airline emails or the app → facts.
// Anything not stated or clearly shown comes back null so Karen can ask.
export function understand(ai, story, screenshots) {
  const images = screenshots.filter((f) => f.type.startsWith("image/"));
  return ask(ai, images, `A passenger is complaining about a disrupted United flight. Their description: """${story || "(none)"}"""
${images.length ? "The images are screenshots of United emails or the United app about this trip." : ""}
Extract the facts. Use "" for anything the description and images do not clearly state; never guess. If the passenger says what they want, put it in "ask".`, FACTS).then(fromAI);
}

export function writeLetters(ai, facts, profile, refs) {
  const name = [profile.first, profile.last].filter(Boolean).join(" ");
  // Backstop: never let a made-up signer through.
  const sign = (t) => (name ? t : t.replace(/(Sincerely,)[\s\S]*$/, "$1"));
  return ask(ai, [], `Write two complaint letters about this United flight for the passenger. Tone: professional, courteous, and persuasive, written so that the company is inclined to help. Explain clearly how the disruption, and any lack of timely communication from United's operations staff, cost the passenger time and money; acknowledge anything United did provide; let the facts make the case rather than accusations or legal conclusions (do not use words like "negligent"); close with a respectful, specific request and thanks.
Facts the passenger confirmed (JSON): ${JSON.stringify(facts)}
Signer: ${[profile.first, profile.last].filter(Boolean).join(" ") || "(unknown: end with \"Sincerely,\" and no name; never invent one)"}. Existing case numbers: ${JSON.stringify(refs || {})}.
Rules:
- State only the facts above. Do not invent times, amounts, or events.
- You may cite only these rules, and only when the facts fit them: ${Object.values(REFS).join(" ")}
- United does not commit to cash, credit, or miles for delays; ask for those only as goodwill.
- If the passenger flew, a ticket refund is not required by the rule; any refund request is a goodwill request and must say so.
- End with a specific ask${facts.ask ? `: ${facts.ask}` : ""}.
- "united": at most ${UNITED_MAX - 50} characters, starting "Dear United Customer Care," and ending with "Sincerely," and the signer's name.
- "dot": at most ${DOT_MAX - 200} characters, addressed to the DOT Office of Aviation Consumer Protection, signed.`,
  { united: { type: "string" }, dot: { type: "string" } }).then((l) => ({ united: sign(l.united), dot: sign(l.dot) }));
}
