import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = process.env.BASE_URL ?? 'https://demo.playwright.dev/todomvc';
const API_BASE_URL = process.env.API_BASE_URL ?? 'https://jsonplaceholder.typicode.com';

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1, // a retry that passes is reported as FLAKY
  workers: process.env.CI ? 2 : undefined,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }], // native Playwright report (traces)
    ['json', { outputFile: 'reports/playwright-results.json' }],
    ['./reporters/sdlc-html-reporter.ts'], // self-contained summary report + screenshots + logs
  ],

  use: {
    screenshot: 'on',            // screenshot for PASSED and FAILED tests
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },

  projects: [
    {
      name: 'ui-chromium',
      testDir: './tests/ui',
      use: { ...devices['Desktop Chrome'], baseURL: BASE_URL },
    },
    {
      name: 'api',
      testDir: './tests/api',
      use: { baseURL: API_BASE_URL, extraHTTPHeaders: { Accept: 'application/json' } },
    },
  ],
});
