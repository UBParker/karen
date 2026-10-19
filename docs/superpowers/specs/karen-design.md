# Karen v1 design: Chrome extension

Status: approved

## Purpose

Karen makes complaining easier and more effective. v1 helps U.S. air travelers whose United flight was delayed, cancelled, or diverted: it turns their flight details into a firm, specific complaint, fills United's Customer Care form and the U.S. DOT complaint form in their own browser, and reminds them daily until they mark the complaint done.

Goals, in priority order: it actually fills both forms; it is easy for non-technical people; it needs as little code as possible.

## Users and distribution

- Anyone with Chrome on a desktop. No account, no Karen server.
- Published as an MIT-licensed GitHub repo (install as an unpacked extension), then the Chrome Web Store. Pushing to GitHub and submitting to the store each need explicit approval first.

## Modes

| Mode | Input | Letters | Network |
|---|---|---|---|
| Template (default) | Short form the user fills | Fill-in templates | None |
| AI (optional) | The user describes what happened in their own words and pastes screenshots of United emails or the app; Karen extracts the facts and asks only the required questions it could not answer | The chosen provider writes them from the facts | Browser to Anthropic (default) or OpenAI with the user's own key |

The user pastes an Anthropic API key in Settings to enable AI mode. The key stays in `chrome.storage.local`.

## User flow

1. **New complaint.** Template mode: a short form with follow-ups that appear only when they apply. AI mode: "What happened?" plus pasted screenshots, then only the questions Karen still needs.
2. **Letters.** Karen produces a United letter (at most 1000 characters, United's limit) and a DOT letter. The user can edit both. The complaint is saved, so the user can draft during the delay and file after landing (airlines often won't accept a complaint until the flight is over).
3. **File with United.** Karen opens `https://www.united.com/en/us/customercare` in a new tab. The user signs in. Karen runs the steps in `docs/united-flow.md` and stops on the review page ("Review your travel case request").
4. **File with DOT.** Karen opens `https://airconsumer.dot.gov/consumer/s/oacp-form`, fills all six pages, and stops on "REVIEW AND SUBMIT".
5. **After submitting**, Karen notices the user's own Submit click, reads a case number if the page shows one, and marks that form filed. "I filed with ..." buttons remain as a fallback.
6. **Reminders.** Once a day Karen shows a Chrome notification for each open complaint with its next step, until the user marks it Done.

## Hard rules

- Karen never clicks Submit and never checks DOT's affirmation box ("I affirm, to the best of my knowledge and belief, that this complaint submission is true and accurate.").
- Karen never types passwords or one-time codes.
- All complaint data lives in `chrome.storage.local`. Nothing is sent anywhere except the two complaint forms the user files and, in AI mode, the Anthropic API.
- Letters state only facts the user confirmed. They cite a rule only if it is on the reference sheet (below). The app footer says Karen is not legal advice.
- When a form asks something Karen has no answer for, it stops on that page and tells the user which question needs them. It never guesses.

## Complaint data

```js
{
  id, createdAt, status,            // "draft" | "filed" | "done"; which forms are filed lives in refs
  facts: {
    airline: "United", flightNumber, date /* YYYY-MM-DD */, origin, destination /* IATA */,
    schedDep, schedArr, actualDep, actualArr /* HH:MM */,
    problem /* delayed | cancelled | diverted */, delayMinutes,
    cause /* maintenance | crew | technology | weather | atc | other */,
    firstToldWhen /* before_leaving | at_airport_before_departure | after_scheduled_departure */,
    flew, rebookedFree, mealVoucherPerPerson, mealRequestDenied, overnight,
    passengers, mealSpend, rebookSpend, reimbursed, confirmation, itinerary, boughtDirect, arrDate, impact, ask
  },
  letters: { united, dot },
  screenshots: [dataURL],            // AI mode or attachments; DOT allows 5 files x 5 MB, United 3 files / 15 MB
  refs: { united, dot },
  log: [{ at, text }]
}
```

Profile (name, address, email, phone, MileagePlus number) is stored once and reused.

## Components

| File | Job |
|---|---|
| `manifest.json` | MV3; permissions `storage`, `alarms`, `notifications`, `scripting`, `tabs`; host permissions for `www.united.com`, `airconsumer.dot.gov`, `api.anthropic.com` |
| `app.html`, `app.js` | Opens in a tab from the toolbar icon (a popup would close when a file picker opens): complaint list, new-complaint form, letter review, File buttons, Settings (profile, API key) |
| `reminders.js` | Pure: which complaints get today's reminder |
| `letters.js` | Pure: templates for both letters, the reference sheet, United 1000-char fitting |
| `ai.js` | Official `@anthropic-ai/sdk` (bundled with esbuild, `dangerouslyAllowBrowser: true`), model `claude-opus-5-5`: extract facts from screenshots (structured output), write letters |
| `answers.js` | Pure: `dotAnswers(facts, profile, letter)` and `unitedPlan(facts, profile, letter)` built from the probed field names |
| `fill.js` | Injected into the form tab: shadow-DOM-piercing find-by-label, fill text/select/radio/checkbox/type-ahead, file attach, page walking, stop at review |
| `background.js` | Daily `chrome.alarms` reminder and notifications |

## Form knowledge

- **DOT:** six pages (submission type, contact, flight, details, description + uploads, review). Probed field names are in `tests/fixtures/dot/fields.json` and the page snapshots. Airline and airports are type-ahead lookups (type, then pick the option containing `(UA)` / `(IATA)`). Dates use `Mar 12, 2026`, phone `###-###-####`. Several required follow-ups are not starred. The page is Salesforce Lightning; fields sit inside shadow roots.
- **United:** steps, accessible names, and gotchas in `docs/united-flow.md` (two file inputs on the details page; use the Attach files chooser, not the expense one; 1000-char limit; contact fields are masked dropdowns from the MileagePlus profile).

## Reference sheet (the only rules letters may cite)

- DOT refund rule: refund when the airline cancels, or delays/changes a flight by 3 hours or more domestic (6 or more international), and the passenger chooses not to travel or accept credits; due within 7 business days (card) or 20 calendar days (other). Source: https://www.transportation.gov/individuals/aviation-consumer-protection/refunds (checked 2026-10-19).
- Controllable (DOT): "a delay or cancellation caused by the airline. Examples include: maintenance or crew problems; cabin cleaning; baggage loading; and fueling." United commits, for controllable delays, to free rebooking, a meal or voucher at 3+ hours, and a hotel plus transport for overnight delays; not to cash, credit, or miles. Source: https://www.transportation.gov/airconsumer/airline-cancellation-delay-dashboard (checked 2026-10-19). Users find the cause in United's delay email/text or the app's flight status./meal-or-meal-cashvoucher-when-flight-delay-results
- A passenger who flew the delayed flight is generally not owed a ticket refund under the rule; a refund request then is a goodwill request, and letters must not claim otherwise.

## Testing

- `node --test` unit tests for the pure modules: letter templates (facts appear, no uncited rules, United letter at most 1000 chars), `dotAnswers` keys all exist in the DOT fixtures, reminder text and timing.
- `fill.js` find-by-label tested in a headless browser against small local HTML pages that use shadow roots.
- Manual release checklist: with a test profile, run both forms live up to the review page and close the tab without submitting.

## Out of scope for v1

Other airlines, a hosted server, mobile, accounts or sync, automatic detection of airline replies, Obsidian, automatic submit.
