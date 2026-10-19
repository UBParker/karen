import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { unitedLetter, dotLetter, UNITED_MAX, DOT_MAX, REFS } from "../letters.js";
import { dotAnswers, unitedPlan } from "../answers.js";
import { dueReminders } from "../reminders.js";

const facts = { airline: "United", flightNumber: "1234", date: "2026-03-12", origin: "DEN", destination: "ORD", problem: "delayed", delayMinutes: 300, cause: "maintenance", firstToldWhen: "after_scheduled_departure", flew: true, mealVoucherPerPerson: 15, passengers: 2, confirmation: "ABC123", ask: "a full refund of the trip", impact: "We missed an important meeting." };
const profile = { first: "Test", last: "Passenger", street: "1 Main St", city: "Denver", state: "CO", zip: "80202", phone: "(303) 555-0100", email: "passenger@example.com" };

test("united letter has the facts and fits 1000 chars", () => {
  const t = unitedLetter(facts);
  assert.ok(t.length <= UNITED_MAX);
  for (const s of ["1234", "DEN", "ORD", "5 hours", "maintenance", "ABC123", "goodwill"]) assert.match(t, new RegExp(s));
});

test("long impact still fits, required ask kept", () => {
  const t = unitedLetter({ ...facts, impact: "x ".repeat(300) });
  assert.ok(t.length <= UNITED_MAX);
  assert.match(t, /would be grateful if United would consider/);
  assert.match(t, /Thank you for your time/);
});

test("tone: courteous greeting, operations-communication point, polite close, no accusations", () => {
  const t = unitedLetter({ ...facts, passengers: 1 }, profile);
  assert.ok(t.startsWith("Dear United Customer Care,") && t.endsWith("Sincerely,\nTest Passenger"), t);
  assert.match(t, /not informed of the delay until after the scheduled departure time/);
  assert.match(t, /operations staff/);
  assert.match(t, /within the airline's control/);
  assert.doesNotMatch(t + dotLetter(facts, profile), /negligen|unacceptable|outrage|demand/i);
  assert.ok(t.length <= UNITED_MAX);
});

test("letters cite only reference-sheet rules", () => {
  const t = dotLetter({ ...facts, flew: false, problem: "cancelled" }, profile, { united: "C-1" });
  assert.ok(t.length <= DOT_MAX);
  assert.ok(t.includes(REFS.refund) && t.includes("C-1") && t.endsWith("Test Passenger"));
  assert.doesNotMatch(t, /CFR|EU 261|Montreal/);
  assert.doesNotMatch(unitedLetter({ ...facts, cause: "weather" }), /3 hours or more/);
});

test("unanswered questions never become claims", () => {
  const t = unitedLetter({ flightNumber: "1234", date: "2026-03-12", origin: "DEN", destination: "ORD", problem: "delayed", delayMinutes: 300, cause: "maintenance", flew: true });
  assert.doesNotMatch(t, /meal|overnight|rebook|refused|spent|told/i);
  assert.match(unitedLetter({ ...facts, mealVoucherPerPerson: 0 }), /No meal or meal voucher was offered/);
});

test("controllable causes cite United's DOT commitments; weather does not", () => {
  const t = dotLetter({ ...facts, mealVoucherPerPerson: 0, overnight: true }, profile, {});
  for (const r of [REFS.controllable, REFS.meals, REFS.hotel]) assert.ok(t.includes(r), r);
  const w = dotLetter({ ...facts, cause: "weather", mealVoucherPerPerson: 0, overnight: true }, profile, {});
  for (const r of [REFS.controllable, REFS.meals, REFS.hotel]) assert.ok(!w.includes(r), r);
  assert.ok(unitedLetter({ ...facts, cause: "ops", mealVoucherPerPerson: 0, overnight: true, impact: "x ".repeat(200) }).length <= UNITED_MAX);
});

test("dot answers use labels that exist on the form", () => {
  const names = new Set(Object.keys(JSON.parse(readFileSync("tests/fixtures/dot/probe_answers.json"))));
  for (const s of JSON.parse(readFileSync("tests/fixtures/dot/fields.json"))) for (const f of s.fields) names.add(f.name.replace(/^\*/, "")), f.group && names.add(f.group);
  const a = dotAnswers(facts, profile, "letter");
  for (const k of Object.keys(a)) if (k !== "textarea") assert.ok(names.has(k), k);
  assert.equal(a["Phone (Format of ###-###-####)"], "303-555-0100");
  assert.equal(a["Date of Departure"], "Mar 12, 2026");
  assert.deepEqual(a["Arrival Airport"], { type: "ORD", pick: "(ORD)" });
  assert.equal(a["Did the flight delay result in the passenger(s) waiting 3 hours or more?"], "Yes");
});

test("dot answers leave unknowns blank instead of guessing No or $0", () => {
  const a = dotAnswers({ flightNumber: "1234", date: "2026-03-12", origin: "DEN", destination: "ORD", problem: "delayed" }, profile, "x");
  for (const k of Object.keys(a)) assert.doesNotMatch(k, /meal|overnight|rebook|reimbursed|3 hours/, k);
});

test("united plan matches the mapped pages and never submits", () => {
  const plan = unitedPlan(facts, "letter");
  assert.equal(plan.find((s) => "/en/us/customer-care/select-lof".includes(s.path)).path, "/customer-care/select-lof");
  assert.ok(plan[0].stop);
  assert.doesNotMatch(JSON.stringify(plan), /"click":"Submit/i);
});

test("united trip is matched by date when there's no confirmation code", () => {
  const trip = (f) => unitedPlan(f, "x").find((s) => s.path === "/customer-care").do[1].trip;
  assert.equal(trip(facts), "ABC123");
  assert.equal(trip({ ...facts, confirmation: null }), "Thu, March 12, 2026");
  assert.equal(dotAnswers({ ...facts, cause: null }, profile, "x")["Please select the cause of the delay:"], "Other/Not Sure");
});

test("reminders: daily, only after the flight, until done", () => {
  const c = (status, date, refs = {}) => ({ id: status + date, status, refs, facts: { ...facts, date } });
  const due = dueReminders([c("draft", "2026-03-12"), c("draft", "2026-03-19"), c("done", "2026-03-01"), c("filed", "2026-03-01", { united: "C-1" })], "2026-03-13");
  assert.deepEqual(due.map((d) => d.id), ["draft2026-03-12", "filed2026-03-01"]);
  assert.match(due[0].text, /United/);
  assert.match(due[1].text, /DOT/);
});
