---
description: "Run the full SDLC test-automation pipeline on the requirements I provide."
agent: sdlc-orchestrator
---
Run the complete pipeline (plan -> generate -> review -> execute -> heal -> report) for the requirements below.

Target type (UI / API / UI+API): ${input:target:UI, API or UI+API}
Application / API base URL: ${input:url:https://...}

Requirements / user stories / acceptance criteria:
${input:requirements:Paste user stories here, or write "see requirements/<file>.md"}

Deliver: tests, process documents in /docs, and the HTML report at reports/sdlc-report/index.html with summary, success/failed counts, screenshots and logs.
