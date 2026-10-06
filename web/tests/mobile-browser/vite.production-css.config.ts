import { fileURLToPath } from "node:url";
import path from "node:path";
import { defineConfig } from "vite";
import base from "./vite.config";
import { nextProductionCss } from "./next-production-css";

const directory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  ...base,
  plugins: [nextProductionCss(path.resolve(directory, "../.."))],
  cacheDir: path.join(directory, "artifacts/production-css-cache"),
  server: { ...base.server, port: 4175 },
});
