# SDLC AI Playwright Agents (GitHub Copilot + VS Code)

Give Copilot user stories / requirements for any **UI or API** app. A team of agents plans, generates, reviews,
executes and self-heals Playwright tests, writes process documents, and produces an **HTML report**
(summary, passed/failed, screenshots, logs).

## One-time setup
1. VS Code with extensions: **GitHub Copilot**, **Copilot Chat**, **Playwright Test for VS Code** (recommended list in `.vscode/extensions.json`).
2. `npm run setup` (installs deps + Chromium). Copy `.env.example` -> `.env` and set `BASE_URL` / `API_BASE_URL`.
3. Open the folder in VS Code. Start the Playwright MCP server when prompted (`.vscode/mcp.json`), or
   Command Palette -> **MCP: List Servers** -> `playwright` -> Start. Agents use it to inspect the live app.
4. Copilot Chat -> switch to **Agent** mode -> pick **sdlc-orchestrator** in the agent dropdown.

## Use
**Option A - chat:** select `sdlc-orchestrator` and paste:
```
Target: UI+API. UI https://demo.playwright.dev/todomvc, API https://jsonplaceholder.typicode.com
User stories: <paste stories + acceptance criteria>
```
**Option B - prompt file:** in chat type `/sdlc-pipeline` and fill the inputs.
**Option C - single stage:** pick `test-planner`, `test-generator`, `test-reviewer`, `test-healer`, or `test-reporter`.

Try it right now with `requirements/sample-user-stories.md`.

## Agents
| Agent | Does | Writes |
|---|---|---|
| sdlc-orchestrator | Runs the pipeline, normalizes stories (US/AC ids) | `requirements/*.md` |
| test-planner | Explores app, designs scenarios, coverage matrix | `specs/*.plan.md`, `docs/01-test-plan-*.md` |
| test-generator | Writes verified page objects + UI/API specs | `tests/**`, `pages/**` |
| test-reviewer | Scores quality/coverage, auto-fixes minor issues, verdict | `docs/02-review-*.md` |
| test-healer | Runs, classifies failures, fixes safely (max 3 loops), flags real bugs | `docs/03-healing-log.md` |
| test-reporter | Runs the suite, validates report, go/no-go summary | `docs/04-execution-summary.md`, `docs/00-index.md` |

## Execution & results
```
npm test            # all
npm run test:ui     # UI only
npm run test:api    # API only
npm run report      # open reports/sdlc-report/index.html
```
Outputs after every run:
- `reports/sdlc-report/index.html` - self-contained (share by email): summary cards, pass rate, **Passed / Failed / Flaky / Skipped**,
  by-project table, **requirement traceability**, per-test error, steps, **screenshots (pass and fail)**, `browser-logs` / `api-log`, stdout/stderr
- `reports/sdlc-report/summary.json` and `summary.md`; archived copies in `reports/history/`
- `playwright-report/` native report (`npx playwright show-report`) with traces; videos/traces for failures in `test-results/`

A test that fails then passes on retry is shown as **FLAKY** so instability is never hidden.

## Customize
- Browsers/projects/retries/timeouts: `playwright.config.ts` (add firefox/webkit/mobile projects).
- Rules all agents follow: `.github/copilot-instructions.md`.
- Add agents (e.g. `security-tester`, `a11y-tester`) by copying any `.agent.md` file.
- Official Playwright agents alternative: `npm run agents:init` (Playwright >= 1.56) generates planner/generator/healer definitions.

## Notes
- Agent file format (`.github/agents/*.agent.md`, `handoffs`, tool names) follows current VS Code Copilot custom agents; if your VS Code version
  is older, put the files in `.github/chatmodes/*.chatmode.md` instead.
- Agents will not modify application code and will not silently hide real defects.
