# Karen: file a United Airlines and DOT flight delay complaint in minutes

**Karen is a free Chrome extension that files flight delay and cancellation complaints for you.** Tell her what happened (type it or say it out loud), paste a screenshot of United's delay email or app, and she writes a polite, persuasive complaint letter and fills in both official forms: **United Airlines Customer Care** and the **U.S. Department of Transportation (DOT) air travel complaint form**. You read each form and click Submit yourself.

- ✈️ For delayed, cancelled, or diverted **United Airlines** flights (more airlines planned)
- 🎤 Speak or type your complaint; Karen asks only what she still needs
- 📝 Professional letters that cite United's own DOT commitments (meals, hotels, rebooking) and DOT's refund rule
- 🤖 Fills the United and DOT forms for you, then stops so you can review and submit
- 🔒 Free, open source (MIT), no account with us, everything stays in your browser

Karen is not legal advice.

## What you need

- **Chrome** on a Mac, Windows, or Linux computer (not a phone).
- A **United MileagePlus login** (the United form only shows trips on your account).
- *Optional, recommended:* a **Claude API key** from Anthropic so Karen can understand your description and screenshots. Without a key, you fill in a short form instead and Karen uses letter templates.

## Install (2 minutes)

1. On this page, click the green **Code** button, then **Download ZIP**. Unzip it (double-click the file).
2. In Chrome, go to `chrome://extensions` (paste it into the address bar).
3. Turn on **Developer mode** (switch in the top right).
4. Click **Load unpacked** and choose the unzipped `karen` folder.
5. Karen opens in a new tab. To get back to her later, click the puzzle-piece icon in Chrome's toolbar, then **Karen** (click the pin to keep her in the toolbar).

## Get a Claude API key (optional, 5 minutes)

Karen's **Settings → Get your API key** button walks you through this too.

1. Go to [platform.claude.com/settings/keys](https://platform.claude.com/settings/keys) and sign in, or create a free Anthropic account.
2. Under **Billing**, add a payment method or buy a small amount of credits. You pay Anthropic per use; this is separate from any Claude.ai subscription.
3. On **API keys**, click **Create key**, name it "Karen", choose **one workspace** (Default is fine), and copy the key.
4. In Karen, open **Settings**, choose **Claude by Anthropic**, paste the key, and click **Save**.

**What it costs:** Karen uses Claude Opus 5.5, priced at $4 per million input tokens and $20 per million output tokens ([claude.com/pricing](https://claude.com/pricing)). Reading a few screenshots and writing two letters is a couple of requests, which we estimate at a few cents to a few tens of cents per complaint. You can set a spend limit in the Console.

Prefer ChatGPT? Choose **ChatGPT by OpenAI** in Settings and use a key from [platform.openai.com/api-keys](https://platform.openai.com/api-keys) instead.

## File a complaint

1. **Tell Karen what happened.** Type it or click **🎤 Speak it**. Paste (⌘V / Ctrl+V) or drop screenshots of United's delay email, text, or app screen. Click **Let Karen work it out**.
2. **Answer what she asks.** Karen only asks what she couldn't find, usually a few one-tap Yes/No questions. Questions marked <b>*</b> are required to file. The first time, she also asks for your contact details for the DOT form (Chrome can fill these in for you).
3. **Check the letters.** Karen writes one for United (1,000 character limit) and one for DOT. Edit them if you like.
4. **Click "File with United + DOT".** Two tabs open:
   - **United:** sign in if asked. If Karen can't tell which trip it is, click your trip, then pick the flight leg and click Continue. **That's all you do: Karen takes over and fills in the rest of United's form.**
   - **DOT:** **Karen fills in every page for you.** If a question needs your answer, she tells you which one; answer it and click Continue on her note.
5. **Submit.** Each form stops on its review page. Read it, then click **Submit** yourself (on DOT, tick the "I affirm" box first). Karen notices and marks it filed.

Airlines often won't accept a complaint until after the flight, so you can start one at the airport and file later. Karen reminds you once a day after your flight until you mark it done.

## Privacy

Your complaints, contact details, and key are stored only in your Chrome browser. Karen sends information only to the forms you file and, if you added a key, to the AI provider you chose. Speaking uses Chrome's on-device speech recognition when available; otherwise Chrome sends the audio to Google to transcribe, and Karen tells you while she listens.

## Troubleshooting

- **"Karen couldn't read that" with an API key error:** check the key in Settings. If the error mentions a workspace, create a new key with one workspace selected (step 3 above).
- **Karen stops on United's trip page:** click your trip and flight leg yourself; she continues on the next page.
- **Karen stops on a DOT page:** her note names the question. Answer it on the page and click **Continue** on her note.
- **The microphone doesn't work:** allow the microphone for Karen using the icon at the right end of Chrome's address bar.

## FAQ

**How do I file a complaint against United Airlines?**
Use United's Customer Care form at [united.com/customercare](https://www.united.com/en/us/customercare): choose your trip, then *Disrupted Travel → Compensation and reimbursement*, and describe what happened (1,000 characters max). Karen does all of this for you and stops before Submit.

**How do I file a complaint with the U.S. Department of Transportation about an airline?**
Use DOT's air travel complaint form at [airconsumer.dot.gov](https://airconsumer.dot.gov/consumer/s/oacp-form). DOT forwards complaints to the airline, and airlines must acknowledge a complaint within 30 days and send a written response within 60 days ([DOT: File a Consumer Complaint](https://www.transportation.gov/airconsumer/file-consumer-complaint)). Karen fills in every page of the DOT form for you.

**Am I entitled to a refund if my flight was cancelled or delayed?**
Under DOT's refund rule, you are entitled to a refund if the airline cancels your flight for any reason, or delays it so you arrive 3 hours or more late (6 hours or more on international trips), and you choose not to travel or accept a voucher or other compensation. Card refunds are due within 7 business days ([DOT: Refunds](https://www.transportation.gov/individuals/aviation-consumer-protection/refunds)). If you did take the delayed flight, a refund isn't required, so Karen asks for one only as a goodwill gesture.

**What does United owe me for a delay caused by maintenance or crew problems?**
DOT calls delays caused by the airline, such as "maintenance or crew problems; cabin cleaning; baggage loading; and fueling", controllable. For controllable delays, United has committed to free rebooking, a meal or meal voucher when the wait is 3 hours or more, and a hotel plus transportation for overnight delays. United has not committed to cash, travel credit, or miles for delays ([DOT Airline Cancellation and Delay Dashboard](https://www.transportation.gov/airconsumer/airline-cancellation-delay-dashboard)).

**Where do I find out why my flight was delayed?**
United often states the reason in its delay email or text, or under flight status in the United app. Paste a screenshot and Karen reads it.

**Can I complain before my flight is over?**
Airlines often only accept complaints after the flight. Start one in Karen at the airport; she saves it and reminds you daily to file.

**Is Karen free? Does she work with ChatGPT?**
Karen is free. The optional AI features use your own Claude (recommended) or ChatGPT API key, billed by that provider. Without a key, Karen uses a short form and letter templates.

**Which airlines does Karen support?**
United Airlines today. Other airlines are planned.

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
