# Project rules for GitHub Copilot (apply to ALL agents)

This repo is an **SDLC test-automation factory** built on Playwright + TypeScript.
Input = user stories / requirements / API contracts (in the prompt, or files in `/requirements`).
Output = reviewed, self-healed automation tests + process documents + an HTML execution report.

## Folder contract
| Path | Purpose |
|---|---|
| `requirements/` | Source user stories, acceptance criteria (AC), OpenAPI/Swagger files |
| `specs/` | Test plans written by **test-planner** (`<feature>.plan.md`) |
| `tests/ui/`, `tests/api/` | Generated specs (`*.spec.ts`, `*.api.spec.ts`) |
| `pages/` | Page Objects (UI only) |
| `fixtures/ui.ts`, `fixtures/api.ts` | ALWAYS import `test`/`expect` from here, never from `@playwright/test` directly |
| `docs/` | Process documents (plan, review, healing log, execution summary) |
| `reports/sdlc-report/index.html` | Final HTML report (summary, pass/fail, screenshots, logs) |

## Non-negotiable coding standards
1. TypeScript, Playwright Test. No `waitForTimeout`/sleep; rely on auto-waiting + web-first assertions (`expect(locator).toBeVisible()`).
2. Locator priority: `getByRole` > `getByLabel` > `getByPlaceholder` > `getByText` > `getByTestId` > CSS. **Never invent a selector** - verify it in the live app using the Playwright MCP tools (`playwright/*`) before writing it.
3. Every test title starts with its traceability id: `US-101 AC-2: <behaviour> @smoke|@regression|@negative|@security`.
4. Tests are independent (own data, no order dependency), follow Arrange-Act-Assert, and clean up created data.
5. Secrets/URLs only via `process.env` (`BASE_URL`, `API_BASE_URL`, `API_TOKEN`...). Never hard-code credentials.
6. UI: use Page Objects in `/pages`. API: use the `api` fixture (it logs requests/responses with secrets redacted).
7. Assertions must be meaningful. NEVER weaken or delete an assertion just to make a test pass.
8. Run commands with: `npm test`, `npm run test:ui`, `npm run test:api`, `npx playwright test <file> --project=<name>`.

## Pipeline & document trail
PLAN -> GENERATE -> REVIEW -> EXECUTE -> HEAL (loop, max 3) -> REPORT.
Each stage writes its document in `/docs` (see each agent). Keep docs factual, concise, and traceable to story/AC ids.
