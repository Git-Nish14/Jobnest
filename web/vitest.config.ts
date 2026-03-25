import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    // Both unit tests and full user-flow (E2E) tests run through Vitest
    include: ["tests/unit/**/*.test.ts", "tests/flows/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["lib/**", "app/api/**", "proxy.ts"],
      exclude: ["**/*.d.ts", "node_modules/**", "lib/email/**"],
      reporter: ["text", "html"],
    },
    setupFiles: ["./tests/vitest-setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
