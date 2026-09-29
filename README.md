# Keepme Chatbot Automation

End-to-end automation for the Keepme Control Centre chatbot booking flow, built with **Playwright**, **Cucumber (BDD)** and **TypeScript**. It runs the same flow against three environments, locally and in GitHub Actions.

| Env | URL | Client searched | Client config | Run |
|---|---|---|---|---|
| 🟢 DEV | https://agentdev.keepme.ai | Test Demo Client | `testDemoClientDev` | `yarn test:dev` |
| 🔵 STAGING | https://agentstaging.keepme.ai | Demo Account | `demoAccountStaging` | `yarn test:staging` |
| 🔴 PRODUCTION | https://agent.keepme.ai | Demo Account | `demoAccountProd` | `yarn test:prod` |

The colour identifies the **environment**, not the result. Results are always shown as text (PASS / FAIL).

---

## What the flow does

Scenario `Chatbot booking flow` (tag `@controlcentre`, in `src/features/smoke/chatbot.feature`):

1. Open the environment's login page and sign in. The two-step login (email, **Continue**, then password) is handled automatically.
2. Open the client switcher in the sidebar, search for the client (e.g. `Test Demo Client`) and select it with an **exact** name match, so "Test Demo Client 2" is never picked.
3. Go to the client's **Agent Training → Test Agent** page.
4. Open the chatbot. If a **GDPR & Marketing Permissions** prompt appears (production), click **Yes, I accept**.
5. Check the bot's greeting, then run the scripted conversation from the client fixture: goal, personal training, book a tour, day, time, name, email, phone, "Yes".
   - If the requested time is taken and the bot offers alternatives ("3:55 PM or 4:05 PM?"), one of the offered slots is picked automatically.
6. Pass only if the bot actually confirms the booking ("booked", "confirmed", "all set", …).

Test contact details used in every conversation: **kushal@keepme.ai**, **+9779860759186**.

---

## Quick start

```bash
yarn install
yarn browsers:install

# credentials (gitignored — never commit them)
cp configs/env/local.env.example configs/env/base.local.env   # login for DEV, STAGING and PRODUCTION
# fill in EMAIL= and PASSWORD=

yarn test:dev
```

A Chromium window opens (headed by default), the flow runs, and the HTML report opens when it finishes.

More commands: [QUICK_COMMANDS.md](QUICK_COMMANDS.md). Full guide: [RUNNING_TESTS.md](RUNNING_TESTS.md).

---

## Project structure

```text
.github/workflows/        GitHub Actions: dev, staging, production, qa-all + reusable job
configs/
├── env/
│   ├── base.env              HEADLESS, TIMEOUT, RETRY_ATTEMPTS
│   ├── agentdev.env          DEV login URL
│   ├── staging.env           STAGING login URL
│   ├── prod.env              PRODUCTION login URL
│   ├── base.local.env        login for all envs        (gitignored)
│   ├── local.env.example     template for *.local.env
│   └── env.helper.ts         loads + merges all of the above → ENV object
├── clients/
│   ├── testDemoClientDev.env     CLIENT_NAME + AGENT_TRAINING_URL (DEV)
│   ├── demoAccountStaging.env    (STAGING)
│   └── demoAccountProd.env       (PRODUCTION)
├── crm/keepme.env
└── tags/allowed-tags.ts
src/
├── features/smoke/       chatbot.feature (@controlcentre), login.feature (CRM/API scenarios)
├── steps/                Cucumber step definitions
├── pages/                Page objects (dashboardLogin, chatbot, CRM, …)
├── locators/             Selectors, one file per page
├── commons/              conversation.executor.ts (runs the chat), validators
├── fixtures/             <client>.json — conversation script, expected greeting, confirmation keywords
├── hooks/hooks.ts        browser setup, screenshot + trace on failure, video
└── utils/                logger, fixture loader, locator resolver
scripts/
├── run-smoke.ts          runs cucumber for a tag expression, then builds the report
├── generate-report.ts    cucumber JSON → HTML report
└── ci-summary.ts         PASS/FAIL summary: terminal, GitHub job summary, Slack
```

---

## Configuration

Everything that differs between environments is config, not code:

- **Login URL**: `configs/env/<env>.env`
- **Credentials**: one login for all three environments in `configs/env/base.local.env` (an optional `<env>.local.env` overrides it for one env). In CI they come from GitHub Environment secrets.
- **Client name to search, and the agent training link**: `configs/clients/<client>.env`
- **Conversation, greeting, keywords**: `src/fixtures/<client>.json`

`ENV` accepts `dev` / `agentdev`, `staging`, and `production` / `prod`. The layering order is in [CI_CD.md §3](CI_CD.md#3-how-configuration-is-layered).

### Adding another client or environment

1. `configs/clients/<name>.env` with `CLIENT_NAME=` (exactly as shown in the client switcher) and `AGENT_TRAINING_URL=`.
2. `src/fixtures/<name>.json`: copy an existing fixture and set `greeting.expectedMessage` to part of the bot's real greeting.
3. A script in `package.json`, e.g. `"test:chatbot:foo": "cross-env ENV=staging CLIENT=<name> node scripts/run-smoke.ts \"@controlcentre\""`.
4. For CI: call `_chatbot-e2e.yml` from a workflow with the new `client`.

---

## Reports & artifacts

| What | Where |
|---|---|
| HTML report | `reports/html/<client>/index.html` |
| Raw results | `reports/cucumber/<client>/<client>.json` |
| Screenshot (failures) | `screenshots/<client>/` |
| Playwright trace (failures) | `traces/<client>/trace-*.zip`, open with `npx playwright show-trace <file>` |
| Video | `videos/<client>/` (converted to mp4 if `ffmpeg` is installed) |
| Summary JSON (Slack/Teams) | `reports/summary/<env>.json` |

---

## CI/CD

GitHub Actions runs DEV, STAGING and PRODUCTION on every push to `main`, on demand, and nightly on weekdays (combined dashboard). All three environments use test accounts, so they all run the full chat flow the same way. Setup (environments, secrets, Slack) is in **[CI_CD.md](CI_CD.md)**.

## Docs

| Doc | For |
|---|---|
| [QUICK_COMMANDS.md](QUICK_COMMANDS.md) | Copy-paste commands |
| [RUNNING_TESTS.md](RUNNING_TESTS.md) | Setup, running, fixtures, tags, artifacts |
| [CI_CD.md](CI_CD.md) | GitHub Actions, secrets, production safety, Slack |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Known failures and how to fix them |
| [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md) | Index of everything |
