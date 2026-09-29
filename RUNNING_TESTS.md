# Running the Tests

Full guide to setting up and running the chatbot automation locally. For copy-paste commands see [QUICK_COMMANDS.md](QUICK_COMMANDS.md); for GitHub Actions see [CI_CD.md](CI_CD.md).

## 1. Prerequisites

- Node.js 20+ and Yarn 1.22
- macOS, Linux or Windows. Works well on a MacBook Air M1: one browser, one scenario at a time.
- Optional: `ffmpeg`, which converts scenario videos from `.webm` to `.mp4`. Without it the `.webm` files are kept and a harmless "Video conversion failed" line is logged.

```bash
yarn install
yarn browsers:install        # Chromium + headless shell
```

## 2. Credentials

Credentials are **not** in the repo. Create two gitignored files from the template:

```bash
cp configs/env/local.env.example configs/env/base.local.env
cp configs/env/local.env.example configs/env/prod.local.env
```

| File | Used by | Contents |
|---|---|---|
| `configs/env/base.local.env` | DEV and STAGING | `EMAIL=` / `PASSWORD=` of the QA dashboard login |
| `configs/env/prod.local.env` | PRODUCTION | `EMAIL=` / `PASSWORD=` of the production login |

A per-environment file (`<env>.local.env`) wins over `base.local.env`. `EMAIL` / `PASSWORD` set in the shell or CI win over both. If nothing is set, the run stops immediately with an error saying which file to create.

## 3. Running

```bash
yarn test:dev          # 🟢 DEV        – Test Demo Client
yarn test:staging      # 🔵 STAGING    – Demo Account
yarn test:prod         # 🔴 PRODUCTION – Demo Account
```

By default Chromium opens visibly (`HEADLESS=false` in `configs/env/base.env`). Append `:ci`, e.g. `yarn test:dev:ci`, or set `HEADLESS=true` to run headless.

Each command:
1. runs the `@controlcentre` scenario with Cucumber, retrying a failed scenario up to `RETRY_ATTEMPTS` times
2. builds the HTML report and opens it (not in CI)
3. exits non-zero if the scenario failed

A full run takes about 2–4 minutes, mostly waiting for the bot's replies.

## 4. What gets checked

| Step | Passes when |
|---|---|
| Login | the dashboard loads after email → Continue → password |
| Client search | the client switcher shows a button whose name is **exactly** `CLIENT_NAME` |
| Agent training | the `AGENT_TRAINING_URL` page loads and **Test Agent** opens the chat |
| GDPR prompt | clicked **Yes, I accept** if shown; skipped if not |
| Greeting | the bot's first message contains `greeting.expectedMessage` |
| Conversation | every scripted message gets a reply within 90 s |
| Booking | the bot's final reply contains a confirmation keyword (`booked`, `confirmed`, `scheduled`, `confirmation`, `all set`) |

Mismatched keywords on intermediate steps are only logged (`[KEYWORD MISMATCH]`), because an LLM bot words things differently each time. Only the greeting and the final booking confirmation fail the test.

## 5. Fixtures (the conversation script)

`src/fixtures/<client>.json`:

```jsonc
{
  "greeting": {
    "expectedMessage": "here to assist you",       // part of the bot's real greeting
    "expectedKeywords": ["hello", "welcome"]       // used only if expectedMessage is missing
  },
  "conversation": {
    "flow": [
      { "message": "Book a tour",   "expectedKeywords": ["tour", "time"] },
      { "message": "Today",         "expectedKeywords": ["time"] },
      { "message": "4:00 PM",       "expectedKeywords": ["available"] },
      { "message": "DYNAMIC_TIME_SLOT", "expectedKeywords": ["name"] },  // picks an offered slot if 4:00 PM was taken
      { "message": "kushal@keepme.ai",  "expectedKeywords": ["phone"] },
      { "message": "+9779860759186",    "expectedKeywords": ["confirm"] },
      { "message": "Yes",               "expectedKeywords": ["booked"] }
    ]
  },
  "booking1": { "confirmationKeywords": ["booked", "confirmed", "scheduled", "confirmation", "all set"] }
}
```

- `DYNAMIC_TIME_SLOT` is sent only if the bot said the time was unavailable or offered alternatives ("3:55 PM or 4:05 PM?"). The time just requested is never picked.
- DEV books **Today**. STAGING and PRODUCTION book **Tomorrow**, because STAGING often has no slots left today.
- Current greetings: DEV `here to assist you`, STAGING `Hi this is demo`. PRODUCTION has none set yet; see [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

## 6. Tags

| Tag | Scenario |
|---|---|
| `@controlcentre` | Chatbot booking flow (the one all `test:*` commands run) |
| `@smoke`, `@regression` | also on the booking flow and on the older scenarios in `login.feature` |
| `@KeepmeCRM`, `@PerfectgymCRM`, `@KeepmeAPI`, `@PerfectgymAPI` | CRM/API lead checks in `login.feature`. These need CRM settings in `configs/crm/` and aren't part of the environment runs. |

## 7. Output

```
reports/html/<client>/index.html        HTML report
reports/cucumber/<client>/<client>.json raw Cucumber results
reports/summary/<env>.json              summary for Slack/Teams (written by `yarn summary` / CI)
screenshots/<client>/                   full-page screenshot of each failure
traces/<client>/trace-*.zip             Playwright trace of each failure
videos/<client>/                        video of each scenario
logs/                                   run logs
```

Each run clears the previous screenshots, videos, traces and HTML report for that client only.

## 8. Simulating CI locally

```bash
CI=true HEADLESS=true RETRY_ATTEMPTS=1 yarn test:dev
yarn summary
```

`CI=true` stops the report opening in a browser.
