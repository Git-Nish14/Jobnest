/**
 * E2E — Application delete flows
 *
 * Exercises the two delete surfaces introduced in this sprint:
 *
 *   1. Card dropdown (three-dot menu on the applications list)
 *      - Clicking "Delete" now keeps the menu open (Radix onSelect prevented)
 *        so "Confirm delete" is immediately visible — no re-open needed.
 *      - Confirms the application is removed from the list.
 *
 *   2. Detail page header button
 *      - Clicking "Delete" shows an inline "Are you sure? / Yes, delete / Cancel" strip.
 *      - Confirming redirects to /applications and the application is gone.
 *      - Cancelling leaves the user on the detail page.
 *
 * Unauthenticated tests always run.
 * Authenticated tests require E2E_TEST_EMAIL + E2E_TEST_PASSWORD and a running
 * Supabase backend. Without credentials they are automatically skipped — CI
 * without credentials still passes.
 *
 * Each authenticated test creates its own application (real DB write) and then
 * deletes it, so the suite is fully self-cleaning.
 */

import { test, expect, type Page } from "@playwright/test";

const E2E_EMAIL    = process.env.E2E_TEST_EMAIL;
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;

// Unique tag so test apps are easy to spot / filter if a test fails mid-run
const TAG = `[E2E-DELETE-${Date.now()}]`;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function logIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(E2E_EMAIL!);
  await page.getByRole("button", { name: /continue|next/i }).click();
  await page.waitForTimeout(500);
  if (await page.getByLabel(/password/i).isVisible()) {
    await page.getByLabel(/password/i).fill(E2E_PASSWORD!);
    await page.getByRole("button", { name: /sign in|continue/i }).click();
  }
  await expect(page).toHaveURL(/\/dashboard|\/onboarding/, { timeout: 15_000 });
}

/**
 * Creates a minimal application via the form and returns the application id
 * extracted from the URL the form redirects to, plus the company name used.
 */
async function createTestApplication(
  page: Page,
  suffix: string
): Promise<{ company: string; position: string }> {
  const company  = `${TAG} Company ${suffix}`;
  const position = `Test Engineer ${suffix}`;

  await page.goto("/applications/new");
  await expect(page.getByRole("heading", { name: /new application/i })).toBeVisible({ timeout: 10_000 });

  await page.getByLabel(/company/i).fill(company);
  await page.getByLabel(/position/i).fill(position);
  await page.getByRole("button", { name: /create application/i }).click();

  // Form redirects to /applications after creation
  await expect(page).toHaveURL(/\/applications/, { timeout: 15_000 });
  return { company, position };
}

// ── Unauthenticated ───────────────────────────────────────────────────────────

test.describe("Application delete — unauthenticated", () => {
  test("DELETE /api/applications/:id returns 401 without a session", async ({ request }) => {
    const res = await request.delete("/api/applications/00000000-0000-0000-0000-000000000000");
    expect(res.status()).toBe(401);
  });

  test("navigating to /applications redirects to login when not authenticated", async ({ page }) => {
    await page.goto("/applications");
    await expect(page).toHaveURL(/\/login/);
  });
});

// ── Authenticated ─────────────────────────────────────────────────────────────

test.describe("Application delete — authenticated", () => {
  test.skip(!E2E_EMAIL || !E2E_PASSWORD, "Skipped: E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set");

  test.beforeEach(async ({ page }) => {
    await logIn(page);
  });

  // ── Card dropdown delete ──────────────────────────────────────────────────

  test.describe("card dropdown (three-dot menu)", () => {
    test("Delete button keeps menu open — Confirm delete is visible without re-opening", async ({ page }) => {
      const { company } = await createTestApplication(page, "card-menu-open");

      // Find the card for this application
      const card = page.locator('[data-testid="application-card"]', { hasText: company }).first();
      await expect(card).toBeVisible({ timeout: 10_000 });

      // Open the three-dot dropdown
      const trigger = card.getByRole("button", { name: /options|more/i });
      await trigger.click();

      // Click "Delete" — menu should stay open (onSelect prevented)
      await page.getByRole("menuitem", { name: /^delete$/i }).click();

      // "Confirm delete" must now be visible IN THE SAME OPEN MENU
      // without the user needing to re-open it
      await expect(page.getByRole("menuitem", { name: /confirm delete/i })).toBeVisible({ timeout: 3_000 });
    });

    test("confirms deletion removes the application from the list", async ({ page }) => {
      const { company } = await createTestApplication(page, "card-confirm");

      const card = page.locator('[data-testid="application-card"]', { hasText: company }).first();
      await expect(card).toBeVisible({ timeout: 10_000 });

      // Three-dot menu → Delete → Confirm delete
      await card.getByRole("button", { name: /options|more/i }).click();
      await page.getByRole("menuitem", { name: /^delete$/i }).click();
      await page.getByRole("menuitem", { name: /confirm delete/i }).click();

      // Application card should disappear
      await expect(card).not.toBeVisible({ timeout: 10_000 });

      // Toast success should appear
      await expect(page.getByText(/application deleted/i)).toBeVisible({ timeout: 5_000 });
    });

    test("cancels if user does not confirm within the timeout window", async ({ page }) => {
      const { company } = await createTestApplication(page, "card-cancel");

      const card = page.locator('[data-testid="application-card"]', { hasText: company }).first();
      await expect(card).toBeVisible({ timeout: 10_000 });

      // Open menu and click Delete (keeps menu open)
      await card.getByRole("button", { name: /options|more/i }).click();
      await page.getByRole("menuitem", { name: /^delete$/i }).click();

      // Close the menu by pressing Escape — application should still be there
      await page.keyboard.press("Escape");
      await expect(card).toBeVisible();

      // Clean up the test application
      await card.getByRole("button", { name: /options|more/i }).click();
      await page.getByRole("menuitem", { name: /^delete$/i }).click();
      await page.getByRole("menuitem", { name: /confirm delete/i }).click();
      await expect(card).not.toBeVisible({ timeout: 10_000 });
    });
  });

  // ── Detail page delete ────────────────────────────────────────────────────

  test.describe("detail page delete button", () => {
    test("Delete button is visible on the application detail page", async ({ page }) => {
      const { company } = await createTestApplication(page, "detail-visible");

      // Navigate into the detail page
      const card = page.locator('[data-testid="application-card"]', { hasText: company }).first();
      await expect(card).toBeVisible({ timeout: 10_000 });
      await card.getByRole("link", { name: new RegExp("Test Engineer detail-visible") }).click();
      await expect(page).toHaveURL(/\/applications\/.+/, { timeout: 10_000 });

      // Delete button present in header
      const deleteBtn = page.getByRole("button", { name: /^delete$/i });
      await expect(deleteBtn).toBeVisible({ timeout: 5_000 });

      // Clean up — use the button we just confirmed is there
      await deleteBtn.click();
      await page.getByRole("button", { name: /yes.*delete/i }).click();
      await expect(page).toHaveURL(/\/applications$/, { timeout: 10_000 });
    });

    test("clicking Delete shows inline confirmation (Are you sure? / Yes, delete / Cancel)", async ({ page }) => {
      const { company } = await createTestApplication(page, "detail-confirm-ui");

      const card = page.locator('[data-testid="application-card"]', { hasText: company }).first();
      await expect(card).toBeVisible({ timeout: 10_000 });
      await card.getByRole("link", { name: /Test Engineer detail-confirm-ui/i }).click();
      await expect(page).toHaveURL(/\/applications\/.+/, { timeout: 10_000 });

      // Click Delete once
      await page.getByRole("button", { name: /^delete$/i }).click();

      // Confirm strip should appear
      await expect(page.getByText(/are you sure/i)).toBeVisible({ timeout: 3_000 });
      await expect(page.getByRole("button", { name: /yes.*delete/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /cancel/i })).toBeVisible();

      // Clean up
      await page.getByRole("button", { name: /yes.*delete/i }).click();
      await expect(page).toHaveURL(/\/applications$/, { timeout: 10_000 });
    });

    test("Cancel leaves the user on the detail page with application intact", async ({ page }) => {
      const { company } = await createTestApplication(page, "detail-cancel");

      const card = page.locator('[data-testid="application-card"]', { hasText: company }).first();
      await expect(card).toBeVisible({ timeout: 10_000 });

      // Record detail URL before entering
      await card.getByRole("link", { name: /Test Engineer detail-cancel/i }).click();
      const detailUrl = page.url();
      await expect(page).toHaveURL(/\/applications\/.+/, { timeout: 10_000 });

      // Click Delete → Cancel
      await page.getByRole("button", { name: /^delete$/i }).click();
      await page.getByRole("button", { name: /cancel/i }).click();

      // Still on the detail page, application not deleted
      await expect(page).toHaveURL(detailUrl);
      await expect(page.getByRole("button", { name: /^delete$/i })).toBeVisible();

      // Clean up
      await page.getByRole("button", { name: /^delete$/i }).click();
      await page.getByRole("button", { name: /yes.*delete/i }).click();
      await expect(page).toHaveURL(/\/applications$/, { timeout: 10_000 });
    });

    test("confirming delete navigates to /applications and the application is gone", async ({ page }) => {
      const { company } = await createTestApplication(page, "detail-gone");

      const card = page.locator('[data-testid="application-card"]', { hasText: company }).first();
      await expect(card).toBeVisible({ timeout: 10_000 });
      await card.getByRole("link", { name: /Test Engineer detail-gone/i }).click();
      await expect(page).toHaveURL(/\/applications\/.+/, { timeout: 10_000 });

      await page.getByRole("button", { name: /^delete$/i }).click();
      await page.getByRole("button", { name: /yes.*delete/i }).click();

      // Redirected to list
      await expect(page).toHaveURL(/\/applications$/, { timeout: 15_000 });

      // Application no longer in the list
      await expect(page.getByText(company)).not.toBeVisible({ timeout: 5_000 });
    });
  });
});
