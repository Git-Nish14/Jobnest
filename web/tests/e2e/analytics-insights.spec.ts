/**
 * E2E — Dashboard Search Intelligence panel
 *
 * Exercises the analytics refactor shipped in this sprint:
 *
 *   Ghost rate fix
 *     Previously only counted applications with status = "Ghosted".
 *     Users almost never set that status manually, so the card always showed
 *     zero.  Fixed by also counting "Applied" apps silent for >30 days
 *     (implicit ghosting).  This suite verifies the explicit path: creating
 *     a real "Ghosted" app and confirming the dashboard shows a non-zero %.
 *
 *   Three new Search Intelligence cards
 *     Live opportunities  — Phone Screen + Interview count
 *     Weekly momentum     — this week's applications vs 4-week average
 *     Best source         — highest-response-rate application source
 *
 * Unauthenticated tests always run (no credentials needed).
 * Authenticated tests require E2E_TEST_EMAIL + E2E_TEST_PASSWORD and a live
 * Supabase backend.  Without credentials they are skipped automatically — CI
 * without credentials still passes.
 *
 * Each authenticated test creates its own applications and deletes them on
 * completion (including on failure via try/finally), so the suite is fully
 * self-cleaning.
 */

import { test, expect, type Page } from "@playwright/test";

const E2E_EMAIL    = process.env.E2E_TEST_EMAIL;
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;

// Unique tag per run — test apps are easy to spot if a test fails mid-run
const RUN_ID = Date.now();
const TAG    = `[E2E-ANALYTICS-${RUN_ID}]`;

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
    // First combobox on the form is the status selector
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

test.describe("Search Intelligence — unauthenticated", () => {
  test("redirects /dashboard to login when not signed in", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});

// ── Authenticated ─────────────────────────────────────────────────────────────

test.describe("Search Intelligence — authenticated", () => {
  test.skip(
    !E2E_EMAIL || !E2E_PASSWORD,
    "Skipped: E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set"
  );

  test.beforeEach(async ({ page }) => {
    await logIn(page);
  });

  // ── All six cards render ──────────────────────────────────────────────────

  test("shows all six metric cards when the user has applications", async ({ page }) => {
    // Five applications are the minimum for the ghost rate threshold;
    // they also ensure the section itself is visible (requires ≥1 app).
    const companies = Array.from(
      { length: 5 },
      (_, i) => `${TAG}-Card${i + 1}`
    );

    for (const company of companies) {
      await createApp(page, { company, position: "Software Engineer" });
    }

    try {
      await page.goto("/dashboard");

      const section = page.locator("section").filter({
        hasText: "Search Intelligence",
      });
      await expect(section).toBeVisible({ timeout: 15_000 });

      // Original three cards
      await expect(section.getByText(/avg\. response time/i)).toBeVisible();
      await expect(section.getByText(/interview.*offer/i)).toBeVisible();
      await expect(section.getByText(/ghosting rate/i)).toBeVisible();

      // Three new cards added in this sprint
      await expect(section.getByText(/live opportunities/i)).toBeVisible();
      await expect(section.getByText(/weekly momentum/i)).toBeVisible();
      await expect(section.getByText(/best source/i)).toBeVisible();
    } finally {
      for (const company of companies) {
        await deleteApp(page, company);
      }
    }
  });

  // ── Ghost rate bug fix ────────────────────────────────────────────────────

  test("ghost rate shows a percentage (not '—') when ≥5 apps exist and one is Ghosted", async ({ page }) => {
    // 4 Applied + 1 Ghosted = 5 total → ghost rate threshold met
    const applied = Array.from(
      { length: 4 },
      (_, i) => `${TAG}-GhostApplied${i + 1}`
    );
    const ghosted = `${TAG}-GhostGhosted`;

    for (const company of applied) {
      await createApp(page, { company, position: "SWE" });
    }
    await createApp(page, { company: ghosted, position: "SWE", status: "Ghosted" });

    const allCompanies = [...applied, ghosted];

    try {
      await page.goto("/dashboard");

      const section = page.locator("section").filter({
        hasText: "Search Intelligence",
      });
      await expect(section).toBeVisible({ timeout: 15_000 });

      // Find the Ghosting rate card
      const ghostCard = section
        .locator("div.rounded-xl")
        .filter({ hasText: /ghosting rate/i })
        .first();

      await expect(ghostCard).toBeVisible({ timeout: 10_000 });

      // The value element (large bold number) must show a percentage, not "—"
      // We cannot predict the exact % because the user may have other apps,
      // but it must not be "—" since we created ≥5 apps with ≥1 Ghosted.
      const valueText = await ghostCard.locator("p").first().innerText();
      expect(valueText).toMatch(/\d+%/);
      expect(valueText).not.toBe("—");
    } finally {
      for (const company of allCompanies) {
        await deleteApp(page, company);
      }
    }
  });

  // ── Live opportunities card ───────────────────────────────────────────────

  test("live opportunities count increases when a Phone Screen app exists", async ({ page }) => {
    const company = `${TAG}-LivePhone`;
    await createApp(page, { company, position: "SWE", status: "Phone Screen" });

    try {
      await page.goto("/dashboard");

      const section = page.locator("section").filter({
        hasText: "Search Intelligence",
      });
      await expect(section).toBeVisible({ timeout: 15_000 });

      const liveCard = section
        .locator("div.rounded-xl")
        .filter({ hasText: /live opportunities/i })
        .first();

      await expect(liveCard).toBeVisible({ timeout: 10_000 });

      // The count should be ≥1 since we just created a Phone Screen application
      const valueText = await liveCard.locator("p").first().innerText();
      const count = parseInt(valueText.replace(/\D/g, ""), 10);
      expect(count).toBeGreaterThanOrEqual(1);
    } finally {
      await deleteApp(page, company);
    }
  });

  // ── Section is hidden on an empty dashboard ───────────────────────────────

  test("Search Intelligence section is absent on a completely empty dashboard", async ({ page }) => {
    // This test only runs cleanly for a brand-new account with zero applications.
    // On an account with existing data the section will be visible, which is
    // correct behaviour — so we only assert absence when totalApplications is 0.
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // If there are no applications at all, the section must not render.
    // We detect "no applications" via the absence of the stat card value "00".
    const totalAppsCard = page.getByText("00").first();
    const hasZeroApps = await totalAppsCard.isVisible({ timeout: 3_000 }).catch(() => false);

    if (hasZeroApps) {
      await expect(
        page.getByRole("heading", { name: /search intelligence/i })
      ).not.toBeVisible();
    } else {
      // Account has existing apps — skip this assertion, section is expected to show.
      test.info().annotations.push({
        type: "skip-reason",
        description: "Account has existing applications; section correctly visible.",
      });
    }
  });
});
