# United complaint flow

How Karen files a United Customer Care case. Mapped live on a real booking and stopped at the Submit button (never submitted). Page snapshots: `tests/fixtures/united/step*.aria.txt`. Probe script: `docs/cdp_probe.py`.

## Browser setup

united.com blocks Playwright-launched browsers (headless refused with `ERR_HTTP2_PROTOCOL_ERROR`). The working setup is the user's real Chrome with a dedicated profile, attached over CDP:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --remote-debugging-port=9222 --user-data-dir=$HOME/.karen/chrome \
  --no-first-run --no-default-browser-check "https://www.united.com/en/us/customercare"
```

```python
browser = playwright.chromium.connect_over_cdp("http://127.0.0.1:9222")
page = [p for c in browser.contexts for p in c.pages if "united.com" in p.url][-1]
```

The user signs in once in that window (Karen never types the password or one-time codes). The profile in `~/.karen/chrome` keeps the session for next time.

## Steps

All names below are accessible names (`get_by_role(role, name=..., exact=True)`).

| # | URL path | What to do |
|---|---|---|
| 0 | `/customer-care` | A `dialog "cookieconsent"` may cover the page: click button `Close`. If not signed in, a sign-in drawer (`dialog "Sign in for the best experience"`) overlays everything; wait for the user. Signed in, the page lists recent trips as buttons. Their accessible name reads `Flight from <Origin> to <Dest> Departure date ... Confirmation number <CONF> ...`, but their DOM text is just `<Origin> to <Dest><Day, Month D, YYYY><CONF><NAME> + 1`, so match the bare confirmation code (or the outbound date). Round trips are listed under the outbound leg. |
| 1 | `/customer-care/select-lof` | "Which part of your trip do you need help with?" Each leg has a radio with the same name `Select this part of your trip`; the first is pre-checked. Pick by index matching the leg's text (date and airports appear in the following `text` node). Click `Continue`. |
| 2 | `/customer-care/select-category` | Buttons: `Disrupted Travel`, `Feedback or something else`, `Problem with checked bags`, `Report an injury`, `Questions on products and policies`, `Request refund`. For delays/cancellations use `Disrupted Travel` (`Request refund` is the ticket-refund flow). |
| 3 | `/customer-care/select-subcategory` | Buttons: `Compensation and reimbursement`, `Disruption confirmation letter`, `International passenger rights`. Use `Compensation and reimbursement`. |
| 4 | `/customer-care/help-us-understand` | Textbox `Describe what occurred*` (**1000 character limit**). Collapsible buttons `Expense reimbursement (optional) ...` and `Attach files (optional) ...`. Click `Save and continue`. |
| 5 | `/customer-care/contact-information` | Comboboxes `Name`, `Phone number`, `Email` with masked options from the MileagePlus profile (e.g. `p**************r@example.com`). Values not on file cannot be typed. Checkbox `I'm submitting this case for someone else`. Click `Save and continue`. |
| 6 | `/customer-care/summary` | "Review your travel case request" with Edit buttons per section, then `Submit`. **Karen stops here. The user clicks Submit.** |

## Gotchas

- **Two file inputs on step 4.** `input[type=file]` index 0 belongs to Expense reimbursement; setting a file there creates "Receipt 1" which then requires Expense type, Currency and Amount. To attach evidence, expand `Attach files (optional)` and use the file chooser on its `Choose file` button:
  ```python
  with page.expect_file_chooser() as fc:
      page.get_by_role("button", name="Choose file").click()
  fc.value.set_files(path)
  ```
  If a stray receipt appears, remove it with the `Remove` button inside `region "Expense reimbursement ..."`.
- **Attachments:** up to 3 files, 15 MB total, `.doc .jpeg .png .xls .pdf .txt .csv`. Expense receipts: up to 10 files, jpg/png/pdf.
- **1000-character description.** The full letter (about 1,700 chars) must be condensed. Drop the signature (the case is tied to the signed-in account and the contact page).
- **United's flight record can be wrong.** For UA 1234 on Mar 12 it showed `Actual: 11:05 AM` (on time) while the United app showed a 7 hour delay. Say so in the description and attach the app screenshot.
- **Contact options are masked and limited to what's on the MileagePlus profile.** A phone number not on the profile can't be selected; mention it in the description if it matters.
- After clicking `Save and continue`, an error summary (`Fix the following N errors to continue:`) can stay on screen after the cause is fixed; re-read the page instead of trusting it.
- Wait 2-3 s after each click; the app is a client-side SPA and the URL changes before content renders.
