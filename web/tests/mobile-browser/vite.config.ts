import { fileURLToPath } from "node:url";
import path from "node:path";
import { defineConfig } from "vite";

const directory = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(directory, "../..");

export default defineConfig({
  root: directory,
  publicDir: false,
  cacheDir: path.join(directory, "artifacts/vite-cache"),
  define: {
    "process.env.NEXT_PUBLIC_SUPABASE_URL": JSON.stringify("https://fixture.invalid"),
    "process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY": JSON.stringify("fixture-only-no-credentials"),
    "process.env.NEXT_PUBLIC_APP_URL": JSON.stringify("http://127.0.0.1:4173"),
  },
  resolve: {
    alias: [
      { find: "next/link", replacement: path.join(directory, "mocks/link.tsx") },
      { find: "next/navigation", replacement: path.join(directory, "mocks/navigation.ts") },
      { find: "@/lib/supabase/client", replacement: path.join(directory, "mocks/supabase.ts") },
      { find: "@", replacement: webRoot },
    ],
  },
  css: { postcss: webRoot },
  server: {
    host: "127.0.0.1", port: 4173, strictPort: true,
    fs: { allow: [webRoot] },
    watch: { ignored: ["**/artifacts/**"] },
  },
});
