# Troubleshooting

Start with the failure screenshot (`screenshots/<client>/`) and the trace (`npx playwright show-trace traces/<client>/trace-*.zip`). The trace shows every click, the DOM, network calls and console output at each step.

## Known open issues (29 Sep 2026)

| Env | Symptom | Cause | Fix |
|---|---|---|---|
| 🔵 STAGING | `Timed out waiting for new bot response` after **Book a tour** | The staging bot stops replying ("…" typing indicator stays) | Backend: check the staging Demo Account agent. The test waits 90 s per reply. |
| 🔴 PRODUCTION | `Expected greeting to contain "hello"… Received: "<%@ page import="com.mongodb…` | The Demo Account greeting in production is set to a JSP code snippet that includes a MongoDB connection string | Replace the greeting in Prompt Studio, **rotate that MongoDB password**, then set `greeting.expectedMessage` in `src/fixtures/demoAccountProd.json` |

## Login

**`EMAIL/PASSWORD not set for ENV=…`**
The `*.local.env` credentials file is missing. See [RUNNING_TESTS.md §2](RUNNING_TESTS.md#2-credentials). In CI: add `QA_EMAIL` / `QA_PASSWORD` to that GitHub Environment.

**Stuck on the login page, then timeout waiting for `Search clients...` / `Expand sidebar`**
The credentials were rejected: no error is shown, the page just stays on login. Check that the account works on that environment (all three use the login in `base.local.env` / the `QA_EMAIL` secret).

**`strict mode violation: … resolved to 2 elements`** when selecting the client
Two clients match the name. The dropdown selector matches the name exactly, so check that `CLIENT_NAME` in `configs/clients/<client>.env` is the full, exact name shown in the switcher.

## Chatbot

**`Expected greeting to contain "…"`**
The bot's greeting changed. Copy a stable part of the new greeting into `greeting.expectedMessage` in the fixture.

**`Booking confirmation validation failed … Found: []`**
The bot didn't confirm the booking. Common reasons (read `[SENDING]` / `[BOT MESSAGE]` in the log):
- No slots on the requested day ("We don't have any tour slots left today"): change `"Today"` to `"Tomorrow"` in the fixture.
- The bot asked for something the script didn't send, e.g. a valid email or the day. Adjust the `flow` order in the fixture.
- The bot replied with different confirmation wording: add the word to `booking1.confirmationKeywords`. Only add wording that really means "booked".

**`Timed out waiting for new bot response` / `[DEBUG] No new bot reply within 90000ms`**
The bot didn't answer within 90 s: the environment is slow or the bot is stuck. Rerun. If it keeps happening on the same step, it's a bot problem, not a test problem.

**GDPR prompt isn't clicked**
The flow looks for a button named exactly **Yes, I accept**, inside the chat iframe or on the page. If the wording changed, update `gdprAcceptButton` in `src/locators/chatbot.locators.ts`.

## Environment / tooling

**`Executable doesn't exist at …chrome-headless-shell…`**
The headless browser isn't installed: `yarn browsers:install`. Headed runs (the default locally) only need Chromium.

**`Video conversion failed: Command failed: ffmpeg …`**
`ffmpeg` isn't installed. This is harmless: the `.webm` video is kept. Install it with `brew install ffmpeg` to get `.mp4`.

**`yarn typecheck` errors**
Run it before pushing. CI uses Node 20. Local Node versions newer than that are fine.

## CI

**Job waits with "Waiting for review"**
The GitHub Environment has **Required reviewers**. Approve it, or remove the rule in *Settings → Environments*.

**`QA_EMAIL / QA_PASSWORD secrets are missing on the '<env>' GitHub Environment`**
Add both secrets to that environment. Repository-level secrets with the same name also work.

**No Slack message**
`SLACK_WEBHOOK_URL` isn't set; the log shows a `WARNING` line. It's optional.

**Debug a CI failure locally**
Download `<env>-report` from the run and open `reports/html/<client>/index.html`; the failure screenshot is in the report and in `<env>-screenshots`; video and trace are in `<env>-debug` (both only present when tests failed), then reproduce with the headed command (e.g. `yarn test:staging`) to watch it happen.
