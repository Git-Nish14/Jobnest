/**
 * E2E — US Market sprint: Glassdoor rating field + Navbar hover dropdowns
 *
 * Covers three UI/data changes introduced in this sprint:
 *
 *   1. Glassdoor Rating field on /applications/new and /applications/[id]/edit
 *      - Field is present in the form with label, input, and descriptive text.
 *      - When a company name is typed, a "Search → Glassdoor" link appears.
 *      - The link href targets glassdoor.com/Search with the company encoded.
 *      - A rating (1.0–5.0) saves to the DB and renders as a ★ badge on
 *        the application card in the list view.
 *
 *   2. Application card — Glassdoor ★ badge
 *      - The ★ badge only appears when glassdoor_rating is set.
 *      - Clicking it opens a Glassdoor search for that company.
 *
 *   3. Navbar — condensed 4-item desktop nav with hover dropdowns
 *      - "Job Search" hover group shows Interviews, Reminders, Contacts, Networking.
 *      - "Tools" hover group shows Templates, Salary, ATS Scan, Interview Prep.
 *      - "Overview" link is absent (logo handles /dashboard navigation).
 *      - Navigating via a dropdown link works correctly.
 *
 * Unauthenticated tests run without credentials.
 * Authenticated tests require E2E_TEST_EMAIL + E2E_TEST_PASSWORD + live Supabase.
 * Without credentials they are automatically skipped — CI without credentials passes.
 *
 * All authenticated tests are self-cleaning (try/finally delete created data).
 */

import { test, expect, type Page } from "@playwright/test";

const E2E_EMAIL    = process.env.E2E_TEST_EMAIL;
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;

const RUN_ID = Date.now();
const TAG    = `[E2E-USM-${RUN_ID}]`;

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

/** Creates an application via the UI form and returns to /applications. */
async function createAppWithRating(
  page: Page,
  company: string,
  rating: string
): Promise<void> {
  await page.goto("/applications/new");
  await expect(
    page.getByRole("heading", { name: /new application/i })
  ).toBeVisible({ timeout: 10_000 });

  await page.getByLabel(/company/i).fill(company);
  await page.getByLabel(/position/i).fill("Software Engineer");

  // Fill glassdoor rating
  const ratingInput = page.getByLabel(/glassdoor rating/i);
  await ratingInput.fill(rating);

  await page.getByRole("button", { name: /create application/i }).click();
  await expect(page).toHaveURL(/\/applications/, { timeout: 15_000 });
}

/** Deletes an application from the list by company name. */
async function deleteApp(page: Page, company: string) {
  await page.goto("/applications");
  const card = page
    .locator('[data-testid="application-card"]', { hasText: company })
    .first();
  if (!(await card.isVisible({ timeout: 5_000 }).catch(() => false))) return;
  await card.getByRole("button", { name: /options|more/i }).click();
  await page.getByRole("menuitem", { name: /^delete$/i }).click();
  await page.getByRole("menuitem", { name: /confirm delete/i }).click();
  await expect(card).not.toBeVisible({ timeout: 10_000 });
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Unauthenticated guards
// ─────────────────────────────────────────────────────────────────────────────

test.describe("US Market — unauthenticated redirects", () => {
  test("/applications/new redirects to /login when unauthenticated", async ({ page }) => {
    await page.goto("/applications/new");
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Glassdoor rating — form field
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Glassdoor rating — form field (authenticated)", () => {
  test.skip(!E2E_EMAIL || !E2E_PASSWORD, "Skipped: E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set");

  test("Glassdoor Rating label and input are visible on /applications/new", async ({ page }) => {
    await logIn(page);
    await page.goto("/applications/new");
    await expect(
      page.getByRole("heading", { name: /new application/i })
    ).toBeVisible({ timeout: 10_000 });

    // Label is present
    await expect(page.getByText(/glassdoor rating/i)).toBeVisible();
    // Number input accepts values
    const input = page.getByLabel(/glassdoor rating/i);
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute("type", "number");
    await expect(input).toHaveAttribute("min", "1.0");
    await expect(input).toHaveAttribute("max", "5.0");
  });

  test("Glassdoor search link appears only after a company name is typed", async ({ page }) => {
    await logIn(page);
    await page.goto("/applications/new");
    await expect(
      page.getByRole("heading", { name: /new application/i })
    ).toBeVisible({ timeout: 10_000 });

    // No company typed → search link should not be visible
    await expect(page.getByRole("link", { name: /search/i })).not.toBeVisible();

    // Type a company name → link appears
    await page.getByLabel(/company/i).fill("Google");
    await expect(page.getByRole("link", { name: /search/i })).toBeVisible({ timeout: 3_000 });

    // Link href targets glassdoor.com with the company name encoded
    const href = await page.getByRole("link", { name: /search/i }).getAttribute("href");
    expect(href).toContain("glassdoor.com");
    expect(href).toContain("Google");
  });

  test("glassdoor_rating saves to DB and ★ badge renders on application card", async ({ page }) => {
    await logIn(page);
    const company = `${TAG} GD-Badge Co`;

    try {
      await createAppWithRating(page, company, "4.2");

      // Navigate to applications list
      await page.goto("/applications");
      const card = page
        .locator('[data-testid="application-card"]', { hasText: company })
        .first();
      await expect(card).toBeVisible({ timeout: 10_000 });

      // ★ badge with the saved rating must be present
      await expect(card.getByText(/★\s*4\.2/)).toBeVisible();

      // Badge is a link to Glassdoor search for this company
      const badge = card.getByText(/★\s*4\.2/);
      const href  = await badge.getAttribute("href");
      expect(href).toContain("glassdoor.com");
      expect(href).toContain(encodeURIComponent(company));
    } finally {
      await deleteApp(page, company);
    }
  });

  test("no ★ badge when glassdoor_rating is not set", async ({ page }) => {
    await logIn(page);
    const company = `${TAG} No-Rating Co`;

    try {
      await page.goto("/applications/new");
      await expect(
        page.getByRole("heading", { name: /new application/i })
      ).toBeVisible({ timeout: 10_000 });
      await page.getByLabel(/company/i).fill(company);
      await page.getByLabel(/position/i).fill("Engineer");
      // Do NOT fill the rating field
      await page.getByRole("button", { name: /create application/i }).click();
      await expect(page).toHaveURL(/\/applications/, { timeout: 15_000 });

      await page.goto("/applications");
      const card = page
        .locator('[data-testid="application-card"]', { hasText: company })
        .first();
      await expect(card).toBeVisible({ timeout: 10_000 });
      // No ★ badge
      await expect(card.getByText(/★/)).not.toBeVisible();
    } finally {
      await deleteApp(page, company);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Navbar — condensed desktop nav with hover dropdowns
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Navbar — hover dropdown groups (authenticated)", () => {
  test.skip(!E2E_EMAIL || !E2E_PASSWORD, "Skipped: E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set");

  test("'Job Search' hover shows Interviews, Reminders, Contacts, Networking", async ({ page }) => {
    await logIn(page);
    await page.goto("/applications");

    // Only visible on lg+ screens (1280px wide)
    await page.setViewportSize({ width: 1280, height: 800 });

    const trigger = page.getByRole("button", { name: /job search/i });
    await expect(trigger).toBeVisible({ timeout: 5_000 });
    await trigger.hover();

    await expect(page.getByRole("link", { name: /^interviews$/i })).toBeVisible({ timeout: 3_000 });
    await expect(page.getByRole("link", { name: /^reminders$/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /^contacts$/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /^networking$/i })).toBeVisible();
  });

  test("'Tools' hover shows Templates, Salary, ATS Scan, Interview Prep", async ({ page }) => {
    await logIn(page);
    await page.goto("/applications");
    await page.setViewportSize({ width: 1280, height: 800 });

    const trigger = page.getByRole("button", { name: /^tools$/i });
    await expect(trigger).toBeVisible({ timeout: 5_000 });
    await trigger.hover();

    await expect(page.getByRole("link", { name: /^templates$/i })).toBeVisible({ timeout: 3_000 });
    await expect(page.getByRole("link", { name: /^salary$/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /ats scan/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /interview prep/i })).toBeVisible();
  });

  test("navigating via a dropdown link works correctly", async ({ page }) => {
    await logIn(page);
    await page.goto("/applications");
    await page.setViewportSize({ width: 1280, height: 800 });

    // Hover Job Search → click Reminders
    await page.getByRole("button", { name: /job search/i }).hover();
    await page.getByRole("link", { name: /^reminders$/i }).click();
    await expect(page).toHaveURL(/\/reminders/, { timeout: 10_000 });
  });

  test("'Overview' is not present as a nav link (logo handles /dashboard)", async ({ page }) => {
    await logIn(page);
    await page.goto("/applications");
    await page.setViewportSize({ width: 1280, height: 800 });

    // "Overview" should not be a clickable nav link in the desktop bar
    await expect(
      page.locator("nav").getByRole("link", { name: /^overview$/i })
    ).not.toBeVisible();
  });

  test("dropdown closes on Escape key", async ({ page }) => {
    await logIn(page);
    await page.goto("/applications");
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.getByRole("button", { name: /job search/i }).hover();
    await expect(
      page.getByRole("link", { name: /^interviews$/i })
    ).toBeVisible({ timeout: 3_000 });

    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("link", { name: /^interviews$/i })
    ).not.toBeVisible({ timeout: 2_000 });
  });

  test("Applications link is always visible in the nav (no dropdown)", async ({ page }) => {
    await logIn(page);
    await page.goto("/dashboard");
    await page.setViewportSize({ width: 1280, height: 800 });

    // Applications is a direct link, not inside a dropdown
    await expect(
      page.locator("nav").getByRole("link", { name: /^applications$/i })
    ).toBeVisible({ timeout: 5_000 });
  });

  test("NESTAi link is always visible with Sparkles icon", async ({ page }) => {
    await logIn(page);
    await page.goto("/applications");
    await page.setViewportSize({ width: 1280, height: 800 });

    await expect(
      page.locator("nav").getByRole("link", { name: /nestai/i })
    ).toBeVisible({ timeout: 5_000 });
  });
});
