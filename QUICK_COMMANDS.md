# Quick Commands

Run from the project root. First time only: `yarn install && yarn browsers:install`, and fill in the credentials (see [README](README.md#quick-start)).

## Run the chatbot flow

| Env | Headed (browser visible) | Headless (like CI) |
|---|---|---|
| 🟢 DEV | `yarn test:dev` | `yarn test:dev:ci` |
| 🔵 STAGING | `yarn test:staging` | `yarn test:staging:ci` |
| 🔴 PRODUCTION | `yarn test:prod` | `yarn test:prod:ci` |
| All three, in order | `yarn test:chatbot:all` | |

`test:dev` is the same as `test:chatbot:dev` (likewise for staging and prod).

## Reports

```bash
yarn report:chatbot:dev        # re-open the DEV HTML report without re-running
yarn report:chatbot:staging
yarn report:chatbot:prod
yarn summary                   # PASS/FAIL table of the last run of all 3 envs in the terminal
```

Report files: `reports/html/<client>/index.html`
(`testDemoClientDev`, `demoAccountStaging`, `demoAccountProd`)

## Debugging

```bash
KEEP_BROWSER_OPEN=true yarn test:staging          # leave the browser open after the run
RETRY_ATTEMPTS=0 yarn test:dev                    # no retry, fail fast
npx playwright show-trace traces/demoAccountProd/trace-*.zip   # step through a failed run
```

## Checks

```bash
yarn typecheck                                                   # TypeScript
ENV=dev CLIENT=testDemoClientDev npx cucumber-js --dry-run --tags @controlcentre   # steps all bound?
```

## Custom run

```bash
# any env / client / tag expression
ENV=staging CLIENT=demoAccountStaging HEADLESS=true node scripts/run-smoke.ts "@controlcentre"
```

| Variable | Values | Default |
|---|---|---|
| `ENV` | `dev` (`agentdev`), `staging`, `production` (`prod`) | `agentdev` |
| `CLIENT` | `testDemoClientDev`, `demoAccountStaging`, `demoAccountProd` | required |
| `HEADLESS` | `true` / `false` | `false` (from `base.env`) |
| `RETRY_ATTEMPTS` | number of retries for a failed scenario | `2` locally, `1` in CI |
| `KEEP_BROWSER_OPEN` | `true` keeps the browser open after the run | `false` |
| `EMAIL` / `PASSWORD` | override the login from `*.local.env` | — |

## Clean up

```bash
yarn clean     # deletes reports/, screenshots/, videos/, logs/
```
