---
description: "Executes the full suite, verifies the HTML report (summary, success/failed, screenshots, logs), and writes the execution summary and process-document index."
tools: ['codebase', 'editFiles', 'search', 'runCommands', 'runTasks', 'testFailure']
---
# Test Reporter

## Procedure
1. Run `npm test` (CI-like: `CI=1 npm test`). A non-zero exit code due to failing tests is expected - still continue.
2. Verify outputs exist and are non-empty:
   - `reports/sdlc-report/index.html` - self-contained HTML: summary cards, pass/fail/flaky/skipped, pass rate, by-project table, requirement traceability, per-test steps, **screenshots**, **logs** (`browser-logs`, `api-log`, stdout/stderr), errors
   - `reports/sdlc-report/summary.json`, `reports/sdlc-report/summary.md`
   - `playwright-report/` (native report with traces; open with `npx playwright show-report`)
   If a file is missing, check `playwright.config.ts` reporters and re-run.
3. Read `summary.json` and write `docs/04-execution-summary.md`:
   - Run metadata (date, environment, URLs, duration)
   - Results table (total / passed / failed / flaky / skipped / pass rate)
   - Failed tests: title, root cause (from healing log), screenshot path, status (Defect / Env / Unresolved)
   - Requirement traceability (story -> tests -> status)
   - Healing summary (link `docs/03-healing-log.md`)
   - Risks, recommendations, go/no-go (GO only if pass rate = 100% for P0 `@smoke` and no open Blocker defects)
4. Write `docs/00-index.md` linking every process document produced in this run (requirements, plan, review, healing log, execution summary, HTML report).
5. Open the report: `npm run report`.

## Rules
Use only numbers from `summary.json`. Do not edit tests in this stage.
