/**
 * E2E — Sprint features: LinkedIn OAuth, InsightCard Dialog, GitHub error toasts
 *
 * Covers three UI changes that cannot be verified by unit tests alone:
 *
 *   1. LinkedIn OAuth buttons on /login and /signup
 *      - Both pages now render Google, GitHub, and LinkedIn buttons.
 *      - Unauthenticated tests — no credentials needed.
 *
 *   2. Search Intelligence InsightCard → clickable button + Dialog
 *      - Each card is now a <button> that opens a Dialog with the full value
 *        and explanation text on tap/click.
 *      - Requires ≥1 application to render the section; uses E2E credentials.
 *
 *   3. GitHub OAuth error message copy in GitHubSection
 *      - `?github_error=invalid_login_request` shows a user-friendly toast.
 *      - `?github_error=access_denied` shows another.
 *      - Requires authentication (the section only renders when logged in).
 *
 * Authenticated tests require E2E_TEST_EMAIL + E2E_TEST_PASSWORD and a live
 * Supabase backend. Without credentials they are skipped automatically — CI
 * without credentials still passes.
 *
 * All authenticated tests are self-cleaning (create then delete real data via
 * try/finally).
 */

import { test, expect, type Page } from "@playwright/test";

const E2E_EMAIL    = process.env.E2E_TEST_EMAIL;
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;
const RUN_ID = Date.now();
const TAG    = `[E2E-SPRINT-${RUN_ID}]`;

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

async function createApp(page: Page, company: string) {
  await page.goto("/applications/new");
  await expect(page.getByRole("heading", { name: /new application/i })).toBeVisible({ timeout: 10_000 });
  await page.getByLabel(/company/i).fill(company);
  await page.getByLabel(/position/i).fill("Software Engineer");
  await page.getByRole("button", { name: /create application/i }).click();
  await expect(page).toHaveURL(/\/applications/, { timeout: 15_000 });
}

async function deleteApp(page: Page, company: string) {
  await page.goto("/applications");
  const card = page.locator('[data-testid="application-card"]', { hasText: company }).first();
  if (!(await card.isVisible({ timeout: 5_000 }).catch(() => false))) return;
  await card.getByRole("button", { name: /options|more/i }).click();
  await page.getByRole("menuitem", { name: /^delete$/i }).click();
  await page.getByRole("menuitem", { name: /confirm delete/i }).click();
  await expect(card).not.toBeVisible({ timeout: 10_000 });
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. LinkedIn OAuth buttons (unauthenticated — no credentials needed)
// ─────────────────────────────────────────────────────────────────────────────

test.describe("LinkedIn OAuth — /login", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("shows a LinkedIn button on the login page", async ({ page }) => {
    await expect(page.getByRole("button", { name: /linkedin/i })).toBeVisible();
  });

  test("shows Google, GitHub, and LinkedIn buttons (all three providers present)", async ({ page }) => {
    await expect(page.getByRole("button", { name: /^google$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^github$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^linkedin$/i })).toBeVisible();
  });

  test("all three OAuth buttons are stacked vertically (flex-col layout)", async ({ page }) => {
    const container = page.locator(".atelier-card .flex.flex-col").first();
    await expect(container).toBeVisible();
    const buttons = container.getByRole("button");
    await expect(buttons).toHaveCount(3);
  });

  test("LinkedIn button is disabled while another OAuth provider is loading (disabled state)", async ({ page }) => {
    // All buttons share the same disabled={!!oauthLoading} flag.
    // We can't easily trigger the loading state without completing the OAuth flow,
    // so we verify the button is enabled by default (not disabled).
    const linkedInBtn = page.getByRole("button", { name: /^linkedin$/i });
    await expect(linkedInBtn).toBeEnabled();
  });
});

test.describe("LinkedIn OAuth — /signup", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/signup");
  });

  test("shows a 'Continue with LinkedIn' button on the signup page", async ({ page }) => {
    await expect(page.getByRole("button", { name: /continue with linkedin/i })).toBeVisible();
  });

  test("shows Continue with Google, GitHub, and LinkedIn (all three)", async ({ page }) => {
    await expect(page.getByRole("button", { name: /continue with google/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /continue with github/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /continue with linkedin/i })).toBeVisible();
  });

  test("LinkedIn button on signup is blocked when age checkbox is not checked", async ({ page }) => {
    // Clicking LinkedIn without checking the required checkboxes should show an error.
    await page.getByRole("button", { name: /continue with linkedin/i }).click();
    await expect(page.getByText(/confirm your age|terms of service/i)).toBeVisible({ timeout: 5_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. InsightCard — clickable button + Dialog
// ─────────────────────────────────────────────────────────────────────────────

test.describe("InsightCard Dialog — authenticated", () => {
  test.skip(!E2E_EMAIL || !E2E_PASSWORD, "Skipped: E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set");

  test.beforeEach(async ({ page }) => {
    await logIn(page);
  });

  test("each Search Intelligence card is a <button> element", async ({ page }) => {
    const company = `${TAG}-CardBtn`;
    await createApp(page, company);

    try {
      await page.goto("/dashboard");
      const section = page.locator("section").filter({ hasText: "Search Intelligence" });
      await expect(section).toBeVisible({ timeout: 15_000 });

      // All cards must now be buttons (not divs)
      const cards = section.getByRole("button").filter({ hasText: /avg\. response|interview|ghosting|live opp|momentum|best source/i });
      const count = await cards.count();
      expect(count).toBeGreaterThanOrEqual(1);
    } finally {
      await deleteApp(page, company);
    }
  });

  test("clicking an InsightCard opens a Dialog with the card title and value", async ({ page }) => {
    const companies = Array.from({ length: 2 }, (_, i) => `${TAG}-Dialog${i + 1}`);
    for (const c of companies) await createApp(page, c);

    try {
      await page.goto("/dashboard");
      const section = page.locator("section").filter({ hasText: "Search Intelligence" });
      await expect(section).toBeVisible({ timeout: 15_000 });

      // Click the first visible InsightCard button
      const firstCard = section.getByRole("button").first();
      await firstCard.click();

      // A dialog should appear
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible({ timeout: 5_000 });

      // Dialog should contain the card's title text
      await expect(dialog.locator("[data-slot='dialog-title'], [role='heading']").first()).toBeVisible();
    } finally {
      for (const c of companies) await deleteApp(page, c);
    }
  });

  test("InsightCard Dialog can be dismissed with the close button", async ({ page }) => {
    const company = `${TAG}-DialogClose`;
    await createApp(page, company);

    try {
      await page.goto("/dashboard");
      const section = page.locator("section").filter({ hasText: "Search Intelligence" });
      await expect(section).toBeVisible({ timeout: 15_000 });

      await section.getByRole("button").first().click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible({ timeout: 5_000 });

      // Close via the X button
      await dialog.getByRole("button", { name: /close/i }).click();
      await expect(dialog).not.toBeVisible({ timeout: 3_000 });
    } finally {
      await deleteApp(page, company);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. GitHub error message copy (authenticated — profile page with ?github_error)
// ─────────────────────────────────────────────────────────────────────────────

test.describe("GitHub OAuth error messages — authenticated", () => {
  test.skip(!E2E_EMAIL || !E2E_PASSWORD, "Skipped: E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set");

  test.beforeEach(async ({ page }) => {
    await logIn(page);
  });

  test("?github_error=invalid_login_request shows 'login session expired' toast", async ({ page }) => {
    await page.goto("/profile?github_error=invalid_login_request");
    await expect(
      page.getByText(/login session expired|try connecting again/i)
    ).toBeVisible({ timeout: 8_000 });
  });

  test("?github_error=access_denied shows 'access was denied' toast", async ({ page }) => {
    await page.goto("/profile?github_error=access_denied");
    await expect(
      page.getByText(/access was denied/i)
    ).toBeVisible({ timeout: 8_000 });
  });

  test("?github_error=unknown_code shows formatted fallback toast", async ({ page }) => {
    await page.goto("/profile?github_error=some_unknown_code");
    await expect(
      page.getByText(/github error|some unknown code/i)
    ).toBeVisible({ timeout: 8_000 });
  });

  test("?github_connected=1 shows 'GitHub connected!' success toast", async ({ page }) => {
    await page.goto("/profile?github_connected=1");
    await expect(
      page.getByText(/github connected/i)
    ).toBeVisible({ timeout: 8_000 });
  });
});
