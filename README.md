# Karen

A Chrome extension that helps you complain to United Airlines and the U.S. Department of Transportation (DOT) when your flight was delayed, cancelled, or diverted.

1. Tell Karen what went wrong in your own words and paste screenshots of United's emails or app. Karen works out the details and asks only what it still needs. This needs your own Claude or ChatGPT API key; Settings has a "Get your API key" guide. Without a key, fill in a short form instead.
2. Karen writes a letter for United (1,000 character limit) and one for DOT. Edit them as you like.
3. Click **File with United** or **File with DOT**. Karen opens the official form, fills it in, and stops on the review page. **You read it and click Submit yourself.**
4. Karen reminds you once a day, after your flight date, until you mark the complaint done. You can draft during the delay and file after landing.

Everything is stored in your browser. Without an API key, Karen sends nothing anywhere except the forms you choose to file. Karen is not legal advice.

## Install

1. Download this repo (Code → Download ZIP) and unzip it.
2. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and pick the folder.
3. Click the Karen icon, open **Settings**, and enter your name, address, email, and phone (used for the DOT form).

On United's site, sign in if asked. Karen looks for your trip and flight; if she can't tell which one, click your trip, then pick the flight leg and click Continue, and Karen fills in the rest. On DOT, Karen fills every page and tells you if a question needs you. Both forms stop on their review page for you to read and submit. Karen never types passwords and never clicks Submit.

## Develop

```bash
npm install
npm test                                            # letters, form answers, reminders
uv run --with playwright python tests/fill_test.py  # form filler against saved DOT pages
npm run build                                       # rebuilds ai.bundle.js after editing ai.js
```

Form maps: `docs/united-flow.md` and `tests/fixtures/`. Design: `docs/superpowers/specs/karen-design.md`.

## License

MIT
