import { test as base, expect } from '@playwright/test';

/**
 * UI test with an auto-fixture that captures browser console, page errors,
 * failed requests and HTTP >= 400 responses, and attaches them as "browser-logs".
 * The SDLC reporter embeds this log in the HTML report.
 */
export const test = base.extend<{ _browserLogs: void }>({
  _browserLogs: [
    async ({ page }, use, testInfo) => {
      const lines: string[] = [];
      const ts = () => new Date().toISOString();
      page.on('console', (m) => lines.push(`[${ts()}] console.${m.type()}: ${m.text()}`));
      page.on('pageerror', (e) => lines.push(`[${ts()}] pageerror: ${e.message}`));
      page.on('requestfailed', (r) =>
        lines.push(`[${ts()}] requestfailed: ${r.method()} ${r.url()} - ${r.failure()?.errorText}`));
      page.on('response', (r) => {
        if (r.status() >= 400) lines.push(`[${ts()}] HTTP ${r.status()}: ${r.request().method()} ${r.url()}`);
      });
      await use();
      await testInfo.attach('browser-logs', {
        body: lines.join('\n') || '(no browser console/network issues captured)',
        contentType: 'text/plain',
      });
    },
    { auto: true },
  ],
});

export { expect };
