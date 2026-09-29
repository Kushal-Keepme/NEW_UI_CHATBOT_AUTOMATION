# Documentation Index

| Doc | Read it when you want to… |
|---|---|
| [README.md](README.md) | understand what the automation does, the project layout, and how to add a client |
| [QUICK_COMMANDS.md](QUICK_COMMANDS.md) | copy a command |
| [RUNNING_TESTS.md](RUNNING_TESTS.md) | set up credentials, understand each check, edit a conversation fixture |
| [CI_CD.md](CI_CD.md) | set up or use GitHub Actions, secrets, Slack, the CI dashboard |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | fix a failing run; see the current known issues |

## Where things live

| I need to change… | File |
|---|---|
| a login URL | `configs/env/<env>.env` |
| login credentials (local) | `configs/env/base.local.env` (gitignored, used by all envs) |
| login credentials (CI) | GitHub → Settings → Environments → `dev` / `staging` / `production` → `QA_EMAIL`, `QA_PASSWORD` |
| the client name searched / agent training link | `configs/clients/<client>.env` |
| the conversation, greeting or confirmation words | `src/fixtures/<client>.json` |
| a selector | `src/locators/*.locators.ts` |
| the scenario steps | `src/features/smoke/chatbot.feature` |
| how the chat is driven | `src/commons/conversation.executor.ts`, `src/pages/chatbot.page.ts` |
| CI triggers / jobs | `.github/workflows/*.yml` (logic in `_chatbot-e2e.yml`) |
| the CI summary / Slack text | `scripts/ci-summary.ts` |
