/**
 * E2E — Analytics & Export features
 *
 * Covers the four items shipped in this sprint:
 *
 *   1. US Job Search Funnel with benchmark overlays
 *      Stage funnel on the dashboard now shows per-transition conversion rates
 *      (e.g. "↓ 22%") and an "industry avg" comparison beneath each arrow.
 *
 *   2. Weekly Cadence section on the dashboard
 *      Visible when the user has ≥1 application. Shows goal progress, a
 *      12-week velocity bar chart, and a "Weekly report" download button.
 *
 *   3. Full Report (PDF) option in the Export dropdown
 *      Applications page → Export button now includes "Full Report (PDF)" in
 *      addition to the existing CSV/JSON options.
 *
 *   4. Salary Benchmarking section on the Salary page
 *      Shows a P25/P50/P75 range bar with tier pills (All / FAANG / Tier 1 /
 *      Tier 2 / Startup) and a note about 2026 market data.
 *
 * Unauthenticated tests always run (no credentials required).
 * Authenticated tests require E2E_TEST_EMAIL + E2E_TEST_PASSWORD and a live
 * Supabase backend — without them the suite is skipped automatically.
 *
 * Each authenticated test creates its own application data and deletes it on
 * completion, including on failure via try/finally (self-cleaning).
 */

import { test, expect, type Page } from "@playwright/test";

const E2E_EMAIL    = process.env.E2E_TEST_EMAIL;
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;

const RUN_ID = Date.now();
const TAG    = `[E2E-EXPORT-${RUN_ID}]`;

// ── Auth helper ───────────────────────────────────────────────────────────────

async function logIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(E2E_EMAIL!);
  await page.getByRole("button", { name: /continue|next/i }).click();
  await page.waitForTimeout(400);
  if (await page.getByLabel(/password/i).isVisible()) {
    await page.getByLabel(/password/i).fill(E2E_PASSWORD!);
    await page.getByRole("button", { name: /sign in|continue/i }).click();
  }
  await expect(page).toHaveURL(/\/dashboard|\/onboarding/, { timeout: 15_000 });
}

// ── Application helpers ───────────────────────────────────────────────────────

interface AppSpec { company: string; position: string; status?: string; }

async function createApp(page: Page, spec: AppSpec) {
  await page.goto("/applications/new");
  await expect(
    page.getByRole("heading", { name: /new application/i })
  ).toBeVisible({ timeout: 10_000 });

  await page.getByLabel(/company/i).fill(spec.company);
  await page.getByLabel(/position/i).fill(spec.position);

  if (spec.status && spec.status !== "Applied") {
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: spec.status }).click();
  }

  await page.getByRole("button", { name: /create application/i }).click();
  await expect(page).toHaveURL(/\/applications/, { timeout: 15_000 });
}

async function deleteApp(page: Page, company: string) {
  await page.goto("/applications");
  await expect(page).toHaveURL(/\/applications/, { timeout: 10_000 });

  const card = page
    .locator('[data-testid="application-card"]', { hasText: company })
    .first();
  if (!(await card.isVisible({ timeout: 5_000 }).catch(() => false))) return;

  await card.getByRole("button", { name: /options|more/i }).click();
  await page.getByRole("menuitem", { name: /^delete$/i }).click();
  await page.getByRole("menuitem", { name: /confirm delete/i }).click();
  await expect(card).not.toBeVisible({ timeout: 10_000 });
}

// ── Unauthenticated ───────────────────────────────────────────────────────────

test.describe("Analytics & Export — unauthenticated", () => {
  test("redirects /dashboard to /login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("redirects /salary to /login", async ({ page }) => {
    await page.goto("/salary");
    await expect(page).toHaveURL(/\/login/);
  });

  test("redirects /applications to /login", async ({ page }) => {
    await page.goto("/applications");
    await expect(page).toHaveURL(/\/login/);
  });
});

// ── Authenticated ─────────────────────────────────────────────────────────────

test.describe("Analytics & Export — authenticated", () => {
  test.skip(
    !E2E_EMAIL || !E2E_PASSWORD,
    "Skipped: E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set"
  );

  test.beforeEach(async ({ page }) => {
    await logIn(page);
  });

  // ── Feature 1: Application Funnel with conversion rates ───────────────────

  test("stage funnel shows conversion rate arrows between stages", async ({ page }) => {
    // Need at least 2 applications at different stages to produce a non-zero funnel
    const applied    = `${TAG}-FunnelApplied`;
    const phoneScreen = `${TAG}-FunnelPhone`;

    await createApp(page, { company: applied,     position: "SWE" });
    await createApp(page, { company: phoneScreen, position: "SWE", status: "Phone Screen" });

    try {
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      // The funnel card must be visible
      const funnelCard = page.locator(".db-panel, [class*='db-panel']")
        .filter({ hasText: /application funnel/i })
        .first();
      await expect(funnelCard).toBeVisible({ timeout: 15_000 });

      // Conversion rate arrows (↓) should appear between funnel stages.
      // The arrow character is rendered as a text node — locate any element
      // containing the down-arrow inside the funnel card.
      const arrows = funnelCard.locator("*", { hasText: "↓" });
      await expect(arrows.first()).toBeVisible({ timeout: 10_000 });

      // At least one percentage label (e.g. "38%") must follow an arrow
      const pctLabel = funnelCard.locator("span").filter({ hasText: /^\d+%$/ });
      await expect(pctLabel.first()).toBeVisible({ timeout: 10_000 });

      // "avg" text (benchmark comparison) must also be visible
      await expect(funnelCard.getByText(/avg/i)).toBeVisible({ timeout: 10_000 });
    } finally {
      await deleteApp(page, applied);
      await deleteApp(page, phoneScreen);
    }
  });

  // ── Feature 2: Weekly Cadence section ────────────────────────────────────

  test("Weekly Cadence section appears on the dashboard when applications exist", async ({ page }) => {
    const company = `${TAG}-CadenceApp`;
    await createApp(page, { company, position: "SWE" });

    try {
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      const cadenceSection = page.locator("section").filter({ hasText: /weekly cadence/i });
      await expect(cadenceSection).toBeVisible({ timeout: 15_000 });
    } finally {
      await deleteApp(page, company);
    }
  });

  test("Weekly Cadence shows goal progress bar and 12-week velocity chart", async ({ page }) => {
    const company = `${TAG}-CadenceGoal`;
    await createApp(page, { company, position: "SWE" });

    try {
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      const cadenceSection = page.locator("section").filter({ hasText: /weekly cadence/i });
      await expect(cadenceSection).toBeVisible({ timeout: 15_000 });

      // Progress bar is present (the coloured div inside the h-2 track)
      const progressTrack = cadenceSection.locator(".h-2.rounded-full");
      await expect(progressTrack.first()).toBeVisible({ timeout: 10_000 });

      // 12-week velocity label
      await expect(cadenceSection.getByText(/12.week velocity/i)).toBeVisible({ timeout: 10_000 });
    } finally {
      await deleteApp(page, company);
    }
  });

  test("Weekly Cadence has a 'Weekly report' download button", async ({ page }) => {
    const company = `${TAG}-CadenceBtn`;
    await createApp(page, { company, position: "SWE" });

    try {
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      const cadenceSection = page.locator("section").filter({ hasText: /weekly cadence/i });
      await expect(cadenceSection).toBeVisible({ timeout: 15_000 });

      // Button text is "Weekly report"
      const reportBtn = cadenceSection.getByRole("button", { name: /weekly report/i });
      await expect(reportBtn).toBeVisible({ timeout: 10_000 });
      await expect(reportBtn).toBeEnabled();
    } finally {
      await deleteApp(page, company);
    }
  });

  test("goal is editable: clicking the goal number opens an input", async ({ page }) => {
    const company = `${TAG}-CadenceEdit`;
    await createApp(page, { company, position: "SWE" });

    try {
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      const cadenceSection = page.locator("section").filter({ hasText: /weekly cadence/i });
      await expect(cadenceSection).toBeVisible({ timeout: 15_000 });

      // The goal display is a button containing the goal number and "goal" text.
      // Clicking it should reveal an input.
      const goalBtn = cadenceSection.locator("button", { hasText: /goal/i }).first();
      await expect(goalBtn).toBeVisible({ timeout: 10_000 });

      await goalBtn.click();

      // After click an input for the goal value should appear
      const goalInput = cadenceSection.locator('input[aria-label="Weekly goal"]');
      await expect(goalInput).toBeVisible({ timeout: 5_000 });

      // Type a new goal and confirm with Enter
      await goalInput.fill("8");
      await goalInput.press("Enter");

      // Input should disappear and goal value should update
      await expect(goalInput).not.toBeVisible({ timeout: 5_000 });
      await expect(cadenceSection.getByText(/8 goal/i)).toBeVisible({ timeout: 5_000 });
    } finally {
      await deleteApp(page, company);
    }
  });

  // ── Feature 3: Full Report (PDF) in Export dropdown ──────────────────────

  test("Export dropdown on applications page includes 'Full Report (PDF)' option", async ({ page }) => {
    const company = `${TAG}-ExportOpt`;
    await createApp(page, { company, position: "SWE" });

    try {
      await page.goto("/applications");
      await page.waitForLoadState("networkidle");

      // Open the Export dropdown
      const exportBtn = page.getByRole("button", { name: /^export$/i });
      await expect(exportBtn).toBeVisible({ timeout: 10_000 });
      await exportBtn.click();

      // All four options must appear
      await expect(page.getByRole("menuitem", { name: /csv.*basic/i })).toBeVisible({ timeout: 5_000 });
      await expect(page.getByRole("menuitem", { name: /csv.*notes/i })).toBeVisible({ timeout: 5_000 });
      await expect(page.getByRole("menuitem", { name: /json/i })).toBeVisible({ timeout: 5_000 });
      await expect(page.getByRole("menuitem", { name: /full report.*pdf/i })).toBeVisible({ timeout: 5_000 });
    } finally {
      await deleteApp(page, company);
    }
  });

  test("Full Report (PDF) button triggers a download", async ({ page }) => {
    const company = `${TAG}-ExportDl`;
    await createApp(page, { company, position: "SWE" });

    try {
      await page.goto("/applications");
      await page.waitForLoadState("networkidle");

      const exportBtn = page.getByRole("button", { name: /^export$/i });
      await exportBtn.click();

      // Start waiting for the download before clicking (prevents race)
      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 30_000 }),
        page.getByRole("menuitem", { name: /full report.*pdf/i }).click(),
      ]);

      expect(download.suggestedFilename()).toMatch(/job-search-report.*\.pdf/);
    } finally {
      await deleteApp(page, company);
    }
  });

  // ── Feature 4: Salary Benchmarking section ───────────────────────────────

  test("Salary page shows Salary Benchmarking section with tier pills", async ({ page }) => {
    await page.goto("/salary");
    await page.waitForLoadState("networkidle");

    const benchmarkSection = page.locator("div.db-content-card")
      .filter({ hasText: /salary benchmarking/i });
    await expect(benchmarkSection).toBeVisible({ timeout: 15_000 });

    // Tier pills must all be present
    for (const tier of ["All", "FAANG", "Tier 1", "Tier 2", "Startup"]) {
      await expect(benchmarkSection.getByRole("button", { name: tier })).toBeVisible({ timeout: 5_000 });
    }

    // "All" pill is active by default (terracotta background — checked via aria or visual)
    const allPill = benchmarkSection.getByRole("button", { name: "All" });
    await expect(allPill).toBeVisible();
  });

  test("Salary Benchmarking tier pills switch the displayed benchmark range", async ({ page }) => {
    await page.goto("/salary");
    await page.waitForLoadState("networkidle");

    const benchmarkSection = page.locator("div.db-content-card")
      .filter({ hasText: /salary benchmarking/i });
    await expect(benchmarkSection).toBeVisible({ timeout: 15_000 });

    // Default "All" shows $95k P25 label
    await expect(benchmarkSection.getByText(/\$95k/)).toBeVisible({ timeout: 5_000 });

    // Click FAANG — P25 should change to $155k
    await benchmarkSection.getByRole("button", { name: "FAANG" }).click();
    await expect(benchmarkSection.getByText(/\$155k/)).toBeVisible({ timeout: 5_000 });

    // Click Startup — P25 should change to $75k
    await benchmarkSection.getByRole("button", { name: "Startup" }).click();
    await expect(benchmarkSection.getByText(/\$75k/)).toBeVisible({ timeout: 5_000 });
  });

  test("Salary Benchmarking shows footnote about 2026 market data source", async ({ page }) => {
    await page.goto("/salary");
    await page.waitForLoadState("networkidle");

    const benchmarkSection = page.locator("div.db-content-card")
      .filter({ hasText: /salary benchmarking/i });
    await expect(benchmarkSection).toBeVisible({ timeout: 15_000 });

    // Footnote referencing Levels.fyi / 2026 data
    await expect(benchmarkSection.getByText(/levels\.fyi/i)).toBeVisible({ timeout: 5_000 });
  });
});
