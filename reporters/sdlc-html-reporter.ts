import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestResult, TestStep } from '@playwright/test/reporter';
import fs from 'node:fs';
import path from 'node:path';

/**
 * SDLC HTML Reporter
 * Produces a SELF-CONTAINED report (screenshots base64-embedded, logs inline):
 *   reports/sdlc-report/index.html      <- open this
 *   reports/sdlc-report/summary.json    <- machine-readable (used by the reporter agent)
 *   reports/sdlc-report/summary.md      <- markdown summary
 *   reports/history/report-<ts>.html    <- archived copy
 */
type Att = { name: string; kind: 'image' | 'text' | 'file'; contentType: string; data?: string; text?: string; path?: string };
type StepRow = { title: string; ms: number; depth: number; error?: string };
type Row = {
  id: string; title: string; file: string; project: string; tags: string[]; stories: string[];
  outcome: 'passed' | 'failed' | 'flaky' | 'skipped'; status: string; durationMs: number; attempts: number;
  error?: string; steps: StepRow[]; attachments: Att[]; stdout: string; stderr: string;
};

const ANSI = /\u001b\[[0-9;]*m/g;
const strip = (s = '') => s.replace(ANSI, '');
const esc = (s = '') => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const toStr = (x: string | Buffer) => (typeof x === 'string' ? x : x.toString('utf8'));
const MAX_TEXT = 60_000;

export default class SdlcHtmlReporter implements Reporter {
  private rows: Row[] = [];
  private startedAt = new Date();
  private config!: FullConfig;
  private outDir = process.env.SDLC_REPORT_DIR ?? path.join(process.cwd(), 'reports', 'sdlc-report');

  onBegin(config: FullConfig, _suite: Suite) { this.config = config; this.startedAt = new Date(); }

  onTestEnd(test: TestCase, result: TestResult) {
    // onTestEnd fires per attempt; only record the final attempt
    const isFinal = result.status === 'skipped' || result.retry === test.retries || result.status === test.expectedStatus || result.status === 'passed';
    if (!isFinal && result.retry < test.retries) return;
    const outcome = test.outcome();
    const o: Row['outcome'] = outcome === 'expected' ? 'passed' : outcome === 'flaky' ? 'flaky' : outcome === 'skipped' ? 'skipped' : 'failed';
    const title = test.titlePath().slice(3).join(' › ');
    this.rows.push({
      id: test.id, title, file: path.relative(process.cwd(), test.location.file), project: test.parent.project()?.name ?? '',
      tags: [...new Set((title.match(/@[\w-]+/g) ?? []))],
      stories: [...new Set((title.match(/\b(?:US|REQ)-\d+/g) ?? []))],
      outcome: o, status: result.status, durationMs: result.duration, attempts: result.retry + 1,
      error: result.error ? strip(result.error.stack ?? result.error.message) : undefined,
      steps: this.flattenSteps(result.steps),
      attachments: this.readAttachments(result),
      stdout: strip(result.stdout.map(toStr).join('')), stderr: strip(result.stderr.map(toStr).join('')),
    });
  }

  async onEnd(result: FullResult) {
    fs.mkdirSync(this.outDir, { recursive: true });
    const s = this.summarize(result);
    const html = this.renderHtml(s);
    fs.writeFileSync(path.join(this.outDir, 'index.html'), html);
    fs.writeFileSync(path.join(this.outDir, 'summary.json'), JSON.stringify(this.lite(s), null, 2));
    fs.writeFileSync(path.join(this.outDir, 'summary.md'), this.renderMd(s));
    const hist = path.join(path.dirname(this.outDir), 'history');
    fs.mkdirSync(hist, { recursive: true });
    fs.copyFileSync(path.join(this.outDir, 'index.html'), path.join(hist, `report-${this.startedAt.toISOString().replace(/[:.]/g, '-')}.html`));
    console.log(`\nSDLC HTML report: ${path.join(this.outDir, 'index.html')}`);
  }

  // ---------- data helpers ----------
  private flattenSteps(steps: TestStep[], depth = 0, out: StepRow[] = []): StepRow[] {
    for (const st of steps) {
      if (st.category === 'test.step' || st.category === 'pw:api' || st.category === 'expect') {
        out.push({ title: strip(st.title), ms: st.duration, depth, error: st.error ? strip(st.error.message ?? '').split('\n')[0] : undefined });
      }
      if (st.steps?.length && depth < 3) this.flattenSteps(st.steps, st.category === 'test.step' ? depth + 1 : depth, out);
    }
    return out.slice(0, 200);
  }

  private readAttachments(result: TestResult): Att[] {
    const out: Att[] = [];
    for (const a of result.attachments) {
      try {
        const buf = a.body ?? (a.path && fs.existsSync(a.path) ? fs.readFileSync(a.path) : undefined);
        if (a.contentType.startsWith('image/') && buf) out.push({ name: a.name, kind: 'image', contentType: a.contentType, data: buf.toString('base64') });
        else if ((a.contentType.startsWith('text/') || a.contentType.includes('json')) && buf) {
          const t = buf.toString('utf8'); out.push({ name: a.name, kind: 'text', contentType: a.contentType, text: t.length > MAX_TEXT ? t.slice(0, MAX_TEXT) + '\n…[truncated]' : t });
        } else out.push({ name: a.name, kind: 'file', contentType: a.contentType, path: a.path ? path.relative(process.cwd(), a.path) : undefined });
      } catch { /* ignore unreadable attachment */ }
    }
    return out;
  }

  private summarize(result: FullResult) {
    const c = { total: this.rows.length, passed: 0, failed: 0, flaky: 0, skipped: 0 };
    for (const r of this.rows) c[r.outcome]++;
    const executed = c.total - c.skipped;
    const passRate = executed ? Math.round(((c.passed + c.flaky) / executed) * 1000) / 10 : 0;
    const byProject: Record<string, typeof c> = {};
    for (const r of this.rows) { const p = (byProject[r.project] ??= { total: 0, passed: 0, failed: 0, flaky: 0, skipped: 0 }); p.total++; p[r.outcome]++; }
    const trace: Record<string, { total: number; passed: number; failed: number }> = {};
    for (const r of this.rows) for (const sid of r.stories) { const t = (trace[sid] ??= { total: 0, passed: 0, failed: 0 }); t.total++; r.outcome === 'failed' ? t.failed++ : r.outcome !== 'skipped' && t.passed++; }
    return {
      generatedAt: new Date().toISOString(), startedAt: this.startedAt.toISOString(), runStatus: result.status,
      durationMs: result.duration, counts: c, passRate, byProject, traceability: trace,
      environment: { node: process.version, os: process.platform, baseURL: process.env.BASE_URL ?? '(default)', apiBaseURL: process.env.API_BASE_URL ?? '(default)', ci: !!process.env.CI },
      tests: this.rows,
    };
  }
  private lite(s: ReturnType<SdlcHtmlReporter['summarize']>) {
    return { ...s, tests: s.tests.map(({ attachments, steps, stdout, stderr, ...r }) => ({ ...r, attachmentNames: attachments.map((a) => a.name) })) };
  }

  // ---------- renderers ----------
  private renderMd(s: ReturnType<SdlcHtmlReporter['summarize']>) {
    const L = [`# Execution Summary`, ``, `- Run: ${s.startedAt}`, `- Duration: ${(s.durationMs / 1000).toFixed(1)}s`, `- Pass rate: **${s.passRate}%**`,
      ``, `| Total | Passed | Failed | Flaky (passed on retry) | Skipped |`, `|---|---|---|---|---|`,
      `| ${s.counts.total} | ${s.counts.passed} | ${s.counts.failed} | ${s.counts.flaky} | ${s.counts.skipped} |`, ``, `## Failed tests`];
    const failed = s.tests.filter((t) => t.outcome === 'failed');
    if (!failed.length) L.push('None 🎉');
    failed.forEach((t) => L.push(`- **${t.title}** (${t.file}) — ${(t.error ?? '').split('\n')[0]}`));
    L.push('', '## Traceability', '| Story | Tests | Passed | Failed |', '|---|---|---|---|');
    Object.entries(s.traceability).forEach(([k, v]) => L.push(`| ${k} | ${v.total} | ${v.passed} | ${v.failed} |`));
    return L.join('\n') + '\n';
  }

  private renderHtml(s: ReturnType<SdlcHtmlReporter['summarize']>) {
    const c = s.counts; const pct = (n: number) => (c.total ? (n / c.total) * 100 : 0).toFixed(1);
    const badge = (o: string) => `<span class="b ${o}">${o.toUpperCase()}</span>`;
    const card = (label: string, n: number | string, cls = '') => `<div class="card ${cls}"><div class="n">${n}</div><div class="l">${label}</div></div>`;
    const projRows = Object.entries(s.byProject).map(([p, v]) => `<tr><td>${esc(p)}</td><td>${v.total}</td><td class="ok">${v.passed}</td><td class="fl">${v.flaky}</td><td class="bad">${v.failed}</td><td>${v.skipped}</td></tr>`).join('');
    const traceRows = Object.entries(s.traceability).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v.total}</td><td class="ok">${v.passed}</td><td class="bad">${v.failed}</td><td>${v.failed ? '❌' : '✅'}</td></tr>`).join('') || '<tr><td colspan="5">No story IDs (US-nnn / REQ-nnn) found in test titles</td></tr>';

    const testHtml = s.tests.sort((a, b) => ['failed', 'flaky', 'passed', 'skipped'].indexOf(a.outcome) - ['failed', 'flaky', 'passed', 'skipped'].indexOf(b.outcome)).map((t) => {
      const imgs = t.attachments.filter((a) => a.kind === 'image').map((a) => `<figure><img loading="lazy" src="data:${a.contentType};base64,${a.data}" alt="${esc(a.name)}"><figcaption>${esc(a.name)}</figcaption></figure>`).join('');
      const logs = t.attachments.filter((a) => a.kind === 'text').map((a) => `<h4>${esc(a.name)}</h4><pre>${esc(a.text)}</pre>`).join('');
      const files = t.attachments.filter((a) => a.kind === 'file').map((a) => `<li>${esc(a.name)}${a.path ? ` — <code>${esc(a.path)}</code>` : ''}</li>`).join('');
      const steps = t.steps.map((st) => `<div class="step ${st.error ? 'bad' : ''}" style="margin-left:${st.depth * 16}px">${st.error ? '✖' : '✔'} ${esc(st.title)} <small>${st.ms}ms</small>${st.error ? ` <em>${esc(st.error)}</em>` : ''}</div>`).join('');
      const out = [t.stdout && `<h4>stdout</h4><pre>${esc(t.stdout)}</pre>`, t.stderr && `<h4>stderr</h4><pre>${esc(t.stderr)}</pre>`].filter(Boolean).join('');
      return `<details class="t ${t.outcome}" data-o="${t.outcome}" ${t.outcome === 'failed' ? 'open' : ''}>
<summary>${badge(t.outcome)} <b>${esc(t.title)}</b> <span class="m">${esc(t.project)} · ${esc(t.file)} · ${t.durationMs}ms${t.attempts > 1 ? ` · attempts: ${t.attempts}` : ''}</span> ${t.stories.map((x) => `<span class="tag">${x}</span>`).join('')}${t.tags.map((x) => `<span class="tag g">${esc(x)}</span>`).join('')}</summary>
<div class="body">${t.error ? `<h4>Error</h4><pre class="err">${esc(t.error)}</pre>` : ''}${imgs ? `<h4>Screenshots</h4><div class="shots">${imgs}</div>` : ''}${steps ? `<h4>Steps</h4>${steps}` : ''}${logs}${out}${files ? `<h4>Other artifacts (trace/video)</h4><ul>${files}</ul>` : ''}</div></details>`;
    }).join('\n');

    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SDLC Test Execution Report</title><style>
:root{--bg:#f6f7f9;--fg:#1c2330;--card:#fff;--bd:#e1e5eb;--ok:#1a7f4b;--bad:#c62828;--fl:#b26a00;--sk:#6b7280}
@media(prefers-color-scheme:dark){:root{--bg:#12161d;--fg:#e6e9ef;--card:#1b212b;--bd:#2c3442;--ok:#4cc38a;--bad:#ff6b6b;--fl:#ffb454;--sk:#9aa4b2}}
*{box-sizing:border-box}body{margin:0;font:14px/1.5 system-ui,Segoe UI,Roboto,sans-serif;background:var(--bg);color:var(--fg)}
header{padding:20px 28px;border-bottom:1px solid var(--bd);background:var(--card)}h1{margin:0 0 4px;font-size:20px}.sub{color:var(--sk);font-size:13px}
main{max-width:1200px;margin:0 auto;padding:20px 28px}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px}
.card{background:var(--card);border:1px solid var(--bd);border-radius:10px;padding:14px;text-align:center}.card .n{font-size:28px;font-weight:700}.card .l{color:var(--sk);font-size:12px;text-transform:uppercase;letter-spacing:.04em}
.card.ok .n{color:var(--ok)}.card.bad .n{color:var(--bad)}.card.fl .n{color:var(--fl)}
.bar{display:flex;height:14px;border-radius:7px;overflow:hidden;margin:16px 0;background:var(--bd)}.bar i{display:block}
.ok{color:var(--ok)}.bad{color:var(--bad)}.fl{color:var(--fl)}
table{border-collapse:collapse;width:100%;background:var(--card);border:1px solid var(--bd);border-radius:8px;overflow:hidden;margin:8px 0 20px}th,td{padding:8px 12px;border-bottom:1px solid var(--bd);text-align:left}th{font-size:12px;text-transform:uppercase;color:var(--sk)}
h2{font-size:16px;margin:24px 0 8px}.filters button{border:1px solid var(--bd);background:var(--card);color:var(--fg);padding:6px 12px;border-radius:16px;cursor:pointer;margin-right:6px}.filters button.on{outline:2px solid var(--fg)}
details.t{background:var(--card);border:1px solid var(--bd);border-left:5px solid var(--sk);border-radius:8px;margin:8px 0}details.passed{border-left-color:var(--ok)}details.failed{border-left-color:var(--bad)}details.flaky{border-left-color:var(--fl)}
summary{padding:10px 14px;cursor:pointer}.m{color:var(--sk);font-size:12px;margin-left:6px}.body{padding:0 14px 14px}
.b{display:inline-block;font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px;color:#fff;margin-right:6px}.b.passed{background:var(--ok)}.b.failed{background:var(--bad)}.b.flaky{background:var(--fl)}.b.skipped{background:var(--sk)}
.tag{font-size:11px;background:#2f6feb22;color:#2f6feb;border-radius:4px;padding:1px 6px;margin-left:4px}.tag.g{background:#8883;color:var(--sk)}
pre{background:#0d1117;color:#d6deeb;padding:10px;border-radius:6px;overflow:auto;max-height:340px;font-size:12px;white-space:pre-wrap}pre.err{border-left:4px solid var(--bad)}
.shots{display:flex;flex-wrap:wrap;gap:12px}figure{margin:0}figure img{max-width:520px;width:100%;border:1px solid var(--bd);border-radius:6px}figcaption{font-size:12px;color:var(--sk)}
.step{font-size:13px;padding:1px 0}.step small{color:var(--sk)}h4{margin:14px 0 6px}
</style></head><body>
<header><h1>SDLC Test Execution Report</h1><div class="sub">Started ${esc(s.startedAt)} · Duration ${(s.durationMs / 1000).toFixed(1)}s · Run status: <b>${esc(s.runStatus)}</b> · Node ${esc(s.environment.node)} · ${esc(s.environment.os)}${s.environment.ci ? ' · CI' : ''}<br>UI: ${esc(s.environment.baseURL)} · API: ${esc(s.environment.apiBaseURL)}</div></header>
<main>
<div class="cards">${card('Total', c.total)}${card('Passed', c.passed, 'ok')}${card('Failed', c.failed, 'bad')}${card('Flaky (healed on retry)', c.flaky, 'fl')}${card('Skipped', c.skipped)}${card('Pass rate', s.passRate + '%', s.passRate >= 95 ? 'ok' : 'bad')}</div>
<div class="bar" title="pass/flaky/fail/skip"><i style="width:${pct(c.passed)}%;background:var(--ok)"></i><i style="width:${pct(c.flaky)}%;background:var(--fl)"></i><i style="width:${pct(c.failed)}%;background:var(--bad)"></i><i style="width:${pct(c.skipped)}%;background:var(--sk)"></i></div>
<h2>By project</h2><table><tr><th>Project</th><th>Total</th><th>Passed</th><th>Flaky</th><th>Failed</th><th>Skipped</th></tr>${projRows}</table>
<h2>Requirement traceability</h2><table><tr><th>Story / Requirement</th><th>Tests</th><th>Passed</th><th>Failed</th><th>Status</th></tr>${traceRows}</table>
<h2>Test results</h2><div class="filters"><button class="on" data-f="all">All</button><button data-f="failed">Failed</button><button data-f="flaky">Flaky</button><button data-f="passed">Passed</button><button data-f="skipped">Skipped</button></div>
<div id="list">${testHtml}</div></main>
<script>document.querySelectorAll('.filters button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.filters button').forEach(x=>x.classList.remove('on'));b.classList.add('on');const f=b.dataset.f;document.querySelectorAll('details.t').forEach(d=>d.style.display=(f==='all'||d.dataset.o===f)?'':'none')})</script>
</body></html>`;
  }
}
