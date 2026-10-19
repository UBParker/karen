// Pure letter templates. Letters cite only the rules in REFS.
// Source for controllable/meals/hotel: https://www.transportation.gov/airconsumer/airline-cancellation-delay-dashboard
export const REFS = {
  controllable: "As I understand it, DOT considers delays caused by the airline, such as maintenance or crew problems, cabin cleaning, baggage loading, and fueling, to be within the airline's control.",
  meals: "United has committed to DOT to provide a meal or meal voucher when a controllable delay lasts 3 hours or more (transportation.gov/airconsumer/airline-cancellation-delay-dashboard).",
  hotel: "United has also committed to provide a hotel room, with transportation to and from it, when a controllable delay runs overnight.",
  refund: "DOT's refund rule (14 CFR Part 260) requires a refund when the airline cancels or significantly changes a flight (more than 3 hours domestic, 6 hours international) and the passenger does not accept the alternative.",
};
export const UNITED_MAX = 1000, DOT_MAX = 3000;

const PROBLEM = { delayed: "delayed", cancelled: "cancelled", diverted: "diverted" };
const CAUSE = { maintenance: "maintenance", crew: "crew availability", technology: "an airline technology problem", ops: "airline operations (cleaning, baggage loading, or fueling)", weather: "weather", atc: "air traffic control", other: "an unstated reason" };
export const CONTROLLABLE = ["maintenance", "crew", "technology", "ops"];

export const hm = (min) => `${Math.floor(min / 60)} hours${min % 60 ? ` ${min % 60} minutes` : ""}`;
export const fmtDate = (iso) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const money = (n) => `$${Number(n).toFixed(2).replace(/\.00$/, "")}`;

export function defaultAsk(f) {
  if (!f.flew && (f.problem === "cancelled" || f.delayMinutes > 180)) return "a full refund of the unused ticket to my original form of payment";
  const spent = (+f.mealSpend || 0) + (+f.rebookSpend || 0) - (+f.reimbursed || 0);
  return (spent > 0 ? `reimbursement of the ${money(spent)} we spent and ` : "") + "compensation for the disruption as a goodwill gesture";
}

// Sentences in priority order; optional ones are dropped first when a letter is too long.
// `p` starts a new paragraph. Tone: courteous and factual; the facts show the lack of care, not accusations.
function sentences(f, refs, to) {
  const s = [];
  const add = (text, optional = false, p = false) => text && s.push({ text, optional, p });
  const many = f.passengers > 1, we = many ? "we" : "I", We = many ? "We" : "I", us = many ? "us" : "me", our = many ? "our" : "my", were = many ? "were" : "was";
  const ctrl = CONTROLLABLE.includes(f.cause);
  const what = f.problem === "delayed" ? (f.delayMinutes ? `arrived ${hm(f.delayMinutes)} late` : "was delayed") : `was ${PROBLEM[f.problem] || f.problem}`;
  const noun = f.problem === "delayed" ? "delay" : f.problem === "cancelled" ? "cancellation" : "diversion";

  add(to === "dot" ? "To the Office of Aviation Consumer Protection:" : "Dear United Customer Care,");
  add(`I am writing ${to === "dot" ? "to file a complaint about" : "about"} United flight ${f.flightNumber} from ${f.origin} to ${f.destination} on ${fmtDate(f.date)}${f.confirmation ? ` (confirmation ${f.confirmation})` : ""}, which ${what}.`, false, true);
  if (f.cause && f.cause !== "other") add(`United attributed the ${noun} to ${CAUSE[f.cause] || f.cause}${ctrl ? ", a matter within the airline's control" : ""}.`);
  if (f.firstToldWhen === "after_scheduled_departure") add(`Unfortunately, ${we} ${were} not informed of the delay until after the scheduled departure time. Earlier notice from United's operations staff would have allowed ${us} to make other arrangements instead of waiting at the airport.`);
  if (f.firstToldWhen === "at_airport_before_departure") add(`${We} learned of the delay only after arriving at the airport, when earlier notice would have spared ${us} much of the wait.`, true);

  if (f.problem === "delayed" && f.delayMinutes >= 60) add(`In total, the ${noun} cost ${us} ${hm(f.delayMinutes)} of ${our} day.`, true, true);
  const count = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"][f.passengers] || f.passengers;
  if (many) add(`${count} of us were traveling together on this booking.`, true);
  const cap = to === "united" ? 300 : 1500; // keep room for the request and thanks
  let impact = (f.impact || "").trim();
  if (impact.length > cap) impact = impact.slice(0, cap).replace(/\s+\S*$/, "") + "…";
  if (impact) add(impact.replace(/([^.!?…])$/, "$1."));
  if (f.overnight) add("The delay continued overnight.");
  if (f.mealVoucherPerPerson) add(`${We} appreciated the ${money(f.mealVoucherPerPerson)} meal voucher${many ? "s" : ""} provided per person, although ${many ? "they" : "it"} did not make up for the time lost.`, true);
  else if (f.mealVoucherPerPerson === 0 && f.problem === "delayed" && f.delayMinutes >= 180) add("No meal or meal voucher was offered during the wait.");
  if (f.mealRequestDenied) add(`When ${we} asked for a meal or meal voucher, the request was declined.`);
  if (f.rebookedFree === false) add(`${We} ${were} not offered rebooking at no cost.`, true);
  const spent = (+f.mealSpend || 0) + (+f.rebookSpend || 0);
  if (spent) add(`${We} spent ${money(spent)} out of pocket as a result${f.reimbursed ? `, of which ${money(f.reimbursed)} has been reimbursed` : ""}.`);

  if (ctrl) add(REFS.controllable, true, true);
  if (ctrl && f.delayMinutes >= 180 && f.mealVoucherPerPerson === 0) add(REFS.meals, true);
  if (ctrl && f.overnight) add(REFS.hotel, true);
  if (!f.flew && (f.problem === "cancelled" || f.delayMinutes > 180)) add(REFS.refund, true);

  const ask = (f.ask || defaultAsk(f)).replace(/[.]$/, "");
  add(to === "dot" ? `I have asked United for ${ask}, and I would appreciate DOT's help in bringing this matter to United's attention.` : `I would be grateful if United would consider ${ask}.`, false, true);
  if (f.flew && /refund/i.test(f.ask || "")) add(`I recognize that a refund is not required because ${we} completed the trip, and I ask for it as a goodwill gesture.`);
  if (refs?.united) add(`My case number with United is ${refs.united}.`);
  add("Thank you for your time and consideration.");
  return s;
}

export function fit(parts, max) {
  let keep = parts.slice();
  const join = () => keep.map((p, i) => (i ? (p.p ? "\n\n" : " ") : "") + p.text).join("");
  while (join().length > max && keep.some((p) => p.optional)) keep.splice(keep.findLastIndex((p) => p.optional), 1);
  const t = join();
  return t.length <= max ? t : t.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
}

const signed = (body, profile) => {
  const name = [profile?.first, profile?.last].filter(Boolean).join(" ");
  return name ? `${body}\n\nSincerely,\n${name}` : body;
};

export function unitedLetter(f, profile = {}) {
  const name = [profile.first, profile.last].filter(Boolean).join(" ");
  return signed(fit(sentences(f, null, "united"), UNITED_MAX - (name ? name.length + 14 : 0)), profile);
}

export function dotLetter(f, profile = {}, refs = {}) {
  const name = [profile.first, profile.last].filter(Boolean).join(" ");
  return signed(fit(sentences(f, refs, "dot"), DOT_MAX - (name ? name.length + 14 : 0)), profile);
}
