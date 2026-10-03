import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { defineConfig } from "@playwright/test";

const directory = path.dirname(fileURLToPath(import.meta.url));
const localChrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
  || (process.platform === "win32" && existsSync(localChrome) ? localChrome : undefined);

export default defineConfig({
  testDir: directory,
  testMatch: "**/*.spec.ts",
  outputDir: path.join(directory, "artifacts/results"),
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 30_000,
  reporter: [["list"], ["html", { outputFolder: path.join(directory, "artifacts/report"), open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    browserName: "chromium",
    launchOptions: { executablePath },
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node node_modules/vite/bin/vite.js --config tests/mobile-browser/vite.config.ts",
    cwd: path.resolve(directory, "../.."),
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
