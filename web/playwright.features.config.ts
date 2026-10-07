import { loadEnvConfig } from '@next/env';
import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

loadEnvConfig(process.cwd());
// Use local source by default; E2E_BASE_URL explicitly selects a staging build.
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
  || (process.platform === 'win32' && existsSync(chrome) ? chrome : undefined);

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['notification-realtime.spec.ts', 'docx-preview.spec.ts'],
  fullyParallel: false,
  // Both viewports use the same dedicated account; isolate badge baselines.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 60_000,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: { baseURL, launchOptions: { executablePath }, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
  ],
  ...(process.env.E2E_BASE_URL ? {} : {
    webServer: { command: 'npm run dev', url: baseURL, reuseExistingServer: !process.env.CI, timeout: 120_000 },
  }),
});
