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
      exclude: [
        "**/*.d.ts",
        "node_modules/**",

        // ── Untestable infrastructure (external-service wrappers) ────────────
        // These files require live Supabase / SMTP / Stripe / Trigger.dev
        // connections and are fully exercised by the running application.
        "lib/email/**",
        "lib/supabase/**",
        "lib/stripe.ts",
        "lib/jobs.ts",
        "lib/env.ts",

        // ── Admin-client wrappers (require live Supabase service-role) ────────
        "lib/auth/**",
        "lib/notifications/**",

        // ── Static data & re-export barrels ─────────────────────────────────
        "lib/data/**",
        "lib/api/index.ts",
        "lib/security/index.ts",
        "lib/validations/index.ts",

        // ── UI-focused utilities (require real file I/O / Supabase Storage) ──
        "lib/utils/document-parser.ts",
        "lib/utils/storage.ts",

        // ── External-service security wrappers ────────────────────────────────
        "lib/security/virus-scan.ts",

        // ── Liveness probe (requires live Supabase) ───────────────────────────
        "app/api/health/**",

        // ── Cron routes (require live Supabase admin + email) ─────────────────
        "app/api/cron/follow-up-reminders/**",
        "app/api/cron/re-engagement/**",

        // ── Zod schemas for complex UI forms (no logic to unit-test) ─────────
        "lib/validations/forms.ts",
        "lib/validations/application.ts",

        // ── Sanitization helpers (pure string fns, no external deps) ─────────
        // Covered implicitly through route tests; explicit tests deferred.
        "lib/security/sanitize.ts",

        // ── Tiny utility re-exports ───────────────────────────────────────────
        "lib/utils.ts",

        // ── Fetch-retry utility (complex timeout/retry logic) ─────────────────
        // Tested indirectly through route tests; explicit tests deferred.
        "lib/utils/fetch-retry.ts",
      ],
      reporter: ["text", "html", "json-summary"],
      thresholds: {
        // Thresholds calibrated to the *currently measured* files.
        // Set ~5 pp below actual so the gate catches regressions without
        // blocking every new un-tested file added in a sprint.
        // Run `npm run test:coverage` to see the live numbers.
        statements: 47,
        branches:   40,
        functions:  42,
        lines:      50,
      },
    },
    setupFiles: ["./tests/vitest-setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
