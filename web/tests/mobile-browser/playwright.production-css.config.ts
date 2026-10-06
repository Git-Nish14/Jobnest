import { fileURLToPath } from "node:url";
import path from "node:path";
import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

const directory = path.dirname(fileURLToPath(import.meta.url));
const baseURL = "http://127.0.0.1:4175";

export default defineConfig({
  ...base,
  testMatch: ["applications.spec.ts", "dialog-position.spec.ts"],
  grep: /applications fit|short landscape sheets|filters are drafted|failed status save|mobile sheets close|default dialog stays centered/,
  outputDir: path.join(directory, "artifacts/production-css-results"),
  reporter: [["list"], ["html", { outputFolder: path.join(directory, "artifacts/production-css-report"), open: "never" }]],
  use: { ...base.use, baseURL },
  projects: [
    { name: "chromium-production-css", metadata: { productionCss: true }, use: { browserName: "chromium" } },
    { name: "webkit-production-css", metadata: { productionCss: true }, use: { browserName: "webkit", launchOptions: {} } },
  ],
  webServer: {
    command: "node node_modules/vite/bin/vite.js --config tests/mobile-browser/vite.production-css.config.ts",
    cwd: path.resolve(directory, "../.."),
    url: baseURL,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
