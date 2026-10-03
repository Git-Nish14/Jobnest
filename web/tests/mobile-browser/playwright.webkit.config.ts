import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import chromiumConfig from "./playwright.config";

const directory = path.dirname(fileURLToPath(import.meta.url));

/** Safari-engine coverage is opt-in; CDP gesture tests remain Chromium-only. */
export default defineConfig({
  ...chromiumConfig,
  testMatch: ["applications.spec.ts", "form.spec.ts"],
  grepInvert: /swiping a card|mobile board|a swipe from status/,
  outputDir: path.join(directory, "artifacts/webkit-results"),
  reporter: [["list"], ["html", { outputFolder: path.join(directory, "artifacts/webkit-report"), open: "never" }]],
  use: {
    ...chromiumConfig.use,
    browserName: "webkit",
    launchOptions: {},
  },
});
