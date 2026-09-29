# Chatbot Automation — Environments & CI/CD

Cucumber + Playwright (TypeScript) automation for the Keepme chatbot booking
flow, running against three environments locally and in GitHub Actions.

| Env | Colour | URL | Client searched | Client config |
|---|---|---|---|---|
| DEV | 🟢 | https://agentdev.keepme.ai | Test Demo Client | `testDemoClientDev` |
| STAGING | 🔵 | https://agentstaging.keepme.ai | Demo Account | `demoAccountStaging` |
| PRODUCTION | 🔴 | https://agent.keepme.ai | Demo Account | `demoAccountProd` |

> The colour identifies the **environment**, not the result. Results are always
> written as text: **PASS** / **FAIL** / **NO RESULTS**. A production run that
> passed shows as `🔴 PRODUCTION — 🟢 PASS`.

---

## 1. Local setup

```bash
yarn install
yarn browsers:install          # Chromium (+ headless shell)
cp configs/env/local.env.example configs/env/base.local.env   # dev + staging login
cp configs/env/local.env.example configs/env/prod.local.env   # production login
# fill EMAIL= / PASSWORD= in both files (they are gitignored)
```

## 2. Local commands

| Command | What it does |
|---|---|
| `yarn test:dev` | 🟢 DEV chatbot flow (headed browser) |
| `yarn test:staging` | 🔵 STAGING chatbot flow |
| `yarn test:prod` | 🔴 PRODUCTION chatbot flow |
| `yarn test:chatbot:all` | DEV → STAGING → PRODUCTION, one after another |
| `yarn test:dev:ci` / `test:staging:ci` / `test:prod:ci` | Same, headless (as in CI) |
| `yarn report:chatbot:dev` (`:staging`, `:prod`) | Re-open the HTML report without re-running |
| `yarn summary` | Coloured terminal summary of the last run of all 3 envs |
| `yarn typecheck` | TypeScript check |

`ENV` accepts `dev`, `staging`, `production` (aliases of `agentdev`, `staging`, `prod`), e.g.
`ENV=staging CLIENT=demoAccountStaging node scripts/run-smoke.ts "@controlcentre"`.

Each run produces:

```
reports/html/<client>/index.html      HTML report (opens automatically locally)
reports/cucumber/<client>/<client>.json
screenshots/<client>/                 failure screenshots
videos/<client>/                      scenario video
traces/<client>/trace-*.zip           Playwright trace (failures only)
logs/                                 run logs
```

## 3. How configuration is layered

`configs/env/env.helper.ts` loads, first match wins:

1. real environment variables (**CI secrets**)
2. `configs/crm/<crm>.env`
3. `configs/clients/<client>.env` — `CLIENT_NAME`, `AGENT_TRAINING_URL`
4. `configs/env/<env>.local.env` — per-env credentials (gitignored)
5. `configs/env/<env>.env` — `BASE_URL`
6. `configs/env/base.local.env` — default credentials (gitignored)
7. `configs/env/base.env` — `HEADLESS`, `TIMEOUT`, `RETRY_ATTEMPTS`

No URLs or credentials live in test code. Fixtures (conversation script,
expected greeting, confirmation keywords) are in `src/fixtures/<client>.json`.

## 4. GitHub Actions

```
.github/workflows/
├── _chatbot-e2e.yml   reusable job — the only place the run logic lives
├── dev.yml            🟢 push to main / manual → DEV
├── staging.yml        🔵 push to main / manual → STAGING
├── production.yml     🔴 push to main / manual → PRODUCTION
└── qa-all.yml         📊 nightly (weekdays) / manual → all 3 in parallel → combined dashboard
```

All three environments use **test accounts**, so they all run the full chat
flow the same way, with no extra restrictions on production. Each environment runs
independently, so a failure in one never skips the others:

```
🟢 DEV      ─┐
🔵 STAGING  ─┼──▶ 📊 combined summary + Slack
🔴 PROD     ─┘
```

Every job:
1. installs deps + Chromium, checks credentials exist
2. runs the flow headless (`node scripts/run-smoke.ts "$TAGS"`)
3. writes a `$GITHUB_STEP_SUMMARY` dashboard (table, failed tests, branch, commit,
   actor, suite, browser, links to the run and artifacts) and prints a colour-coded
   banner in the log
4. uploads **`<env>-report`** (HTML report + results, ~3 MB) on every run, and
   **`<env>-debug`** (screenshots, video, trace, logs) **only when tests failed**.
   Retention follows the repository limit.
5. fails the job if the tests failed

Error text in summaries/Slack is **redacted** for anything that looks like a
connection string or `password=`… value. The HTML report inside the artifact is
not redacted — artifacts are only visible to people with repo access.

### Parallelism

Each environment is a separate job, and all three run in parallel. Inside a job
Cucumber runs one scenario at a time (`parallel: 1`): the flow is a single long
LLM conversation per environment, so extra workers add load without saving time.
Retries: `1` everywhere (LLM replies are nondeterministic).

## 5. One-time GitHub setup

**Settings → Environments → New environment**, create three:

| GitHub Environment | Secrets | Protection rules |
|---|---|---|
| `dev` | `QA_EMAIL`, `QA_PASSWORD` (DEV login) | none |
| `staging` | `QA_EMAIL`, `QA_PASSWORD` (STAGING login) | none |
| `production` | `QA_EMAIL`, `QA_PASSWORD` (PRODUCTION login) | **Required reviewers**, `main` only |

Every PRODUCTION run (on push, manual or nightly) waits with
**"Waiting for review"** until a required reviewer clicks
**Review deployments → Approve and deploy** on the run page. DEV and STAGING
start immediately. The flow itself is the same full chat flow in all three.

Optional repository secret: `SLACK_WEBHOOK_URL` (Slack → Apps → Incoming
Webhooks). Without it the Slack step logs a warning and is skipped.

Never commit `configs/env/*.local.env` — `.gitignore` already excludes them.

## 6. Running a single environment on demand

**Actions** tab → pick `🟢 DEV`, `🔵 STAGING`, `🔴 PRODUCTION` or `📊 QA · All environments`
→ **Run workflow**. The per-environment workflows accept an optional Cucumber
tag expression (default `@controlcentre`).

## 7. Slack message format

```
🟢 QA AUTOMATION PASSED                    🔴 QA AUTOMATION FAILED

🟢 DEV — 🟢 PASS                            🔴 PRODUCTION — 🔴 FAIL
Client: testDemoClientDev | Passed: 1 |     Client: demoAccountProd | Passed: 0 |
Failed: 0 | Skipped: 0 | Duration: 02:37    Failed: 1 | Skipped: 0 | Duration: 00:21
                                            ❌ Chatbot booking flow → When user completes conversation flow
🔗 GitHub Actions run  🔗 Report & artifacts
```

Teams/email can reuse `reports/summary/<env>.json`, written on every run.

## 8. Debugging a failed run

1. Open the run → **Summary** tab: failed step + first line of the error.
2. Download **`<env>-report`** → open `reports/html/<client>/index.html`.
3. Download **`<env>-debug`** → `screenshots/<client>/*.png` shows the page at the moment of failure,
   `videos/<client>/` the whole run.
4. Step through it: `npx playwright show-trace traces/<client>/trace-*.zip`
   (actions, network, console, errors). For DOM snapshots + screenshots per
   action, re-run with `TRACE_FULL=true` (traces get much larger).
5. Reproduce locally with a visible browser: `yarn test:staging`
   (or `KEEP_BROWSER_OPEN=true yarn test:staging`).

Common causes: greeting text changed (`greeting.expectedMessage` in the
fixture), bot slow/hanging (reply wait is 90 s), no slots for the requested
day, login credentials rotated.
