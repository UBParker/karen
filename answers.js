// Pure: turn a complaint into form answers. Keys are the forms' visible labels (see tests/fixtures).
import { fmtDate } from "./letters.js";

const yn = (b) => (b == null ? undefined : b ? "Yes" : "No");
const amt = (n) => (n == null ? undefined : String(+n));
const MAIN = { delayed: "The flight was delayed", cancelled: "The flight was canceled", diverted: "The flight made an unscheduled landing (diverted)" };
const CAUSE = { maintenance: "Maintenance", crew: "Crew Availability", technology: "Airline Technology Problem", ops: "Other/Not Sure", weather: "Weather", atc: "Air Traffic Control", other: "Other/Not Sure" };

// DOT OACP form. Strings fill text boxes and pick select/radio options, true checks a box,
// {type, pick} types into a type-ahead lookup and clicks the option containing `pick`.
export function dotAnswers(f, p, letter) {
  const a = {
    "Select One:": "Complaint",
    "I am a(n)": "Passenger",
    "First Name": p.first, "Last Name": p.last,
    "Country": p.country || "United States",
    "Street Address": p.street, "City": p.city, "State/Province": p.state,
    "Zip/Postal Code (Format of ##### or #####-####)": p.zip,
    "Phone (Format of ###-###-####)": (p.phone || "").replace(/\D/g, "").slice(-10).replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3"),
    "Email Address": p.email, "Verify Email Address": p.email,
    "Did your trip start, end, or pass through the U.S. or a U.S. Territory?": "Yes",
    "Were you successfully able to complete your booking?": "Yes",
    "Please identify who this complaint is about.": "Airline",
    "Did you purchase your ticket directly with an Airline?": yn(f.boughtDirect),
    "Flight Itinerary": f.itinerary || "One-Way",
    "Airline": { type: "United", pick: "(UA)" },
    "If known, please enter your Confirmation Number / Confirmation Code.": f.confirmation,
    "Flight Number": f.flightNumber,
    "Date of Departure": f.date && fmtDate(f.date),
    "Date of Arrival": (f.arrDate || f.date) && fmtDate(f.arrDate || f.date),
    "Departure (Origin) Airport": f.origin && { type: f.origin, pick: `(${f.origin})` },
    "Arrival Airport": f.destination && { type: f.destination, pick: `(${f.destination})` },
    "Flight Problem": true,
    "What was the main problem?": MAIN[f.problem],
    "Please select the cause of the delay:": CAUSE[f.cause] || "Other/Not Sure",
    "Did the airline rebook the passenger(s) during the delay at no cost?": yn(f.rebookedFree),
    "How much did the the passenger(s) spend to rebook on the same or a different airline?": amt(f.rebookSpend),
    "To date, how much has the airline reimbursed?": amt(f.reimbursed),
    "Did the flight delay result in the passenger(s) waiting 3 hours or more?": f.delayMinutes == null ? undefined : yn(f.delayMinutes >= 180),
    "Did the airline deny a request from the passenger to provide a meal or meal voucher during the delay?": yn(f.mealRequestDenied),
    "How much did the passenger(s) spend on meals during the delay?": amt(f.mealSpend),
    "Did the delay continue overnight?": yn(f.overnight),
    "textarea": letter,
  };
  for (const k in a) if (a[k] == null || a[k] === "") delete a[k];
  return a;
}

// United Customer Care, one entry per page (docs/united-flow.md). The filler runs the entry
// matching the current URL path; `stop` pages hand control back to the user.
export function unitedPlan(f, letter) {
  const leg = [`(${f.origin})`, `(${f.destination})`, fmtDate(f.date)];
  // Trip cards read "Chicago to Denver Tue, March 10, 2026 ABC123 PASSENGER ONE + 1"; match the code, or the date without one.
  const long = new Date(f.date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  return [
    { path: "/customer-care/summary", stop: "Review your case, then click Submit yourself." },
    { path: "/customer-care/contact-information", do: [{ click: "Save and continue" }] },
    { path: "/customer-care/help-us-understand", do: [{ fill: "Describe what occurred*", value: letter }, { attach: "Attach files (optional)" }, { click: "Save and continue" }] },
    { path: "/customer-care/select-subcategory", do: [{ click: "Compensation and reimbursement" }] },
    { path: "/customer-care/select-category", do: [{ click: "Disrupted Travel" }] },
    { path: "/customer-care/select-lof", do: [{ leg }, { click: "Continue" }] },
    { path: "/customer-care", do: [{ dismiss: "cookieconsent" }, { trip: f.confirmation || long }] },
  ];
}
