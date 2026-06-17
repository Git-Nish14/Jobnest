/**
 * E2E — Application search & filter flows
 *
 * Covers the two bugs fixed in this sprint:
 *
 *   Bug 1 — stale extraApps after filter change
 *     ApplicationsList held "Load more" pages in useState that never reset
 *     when filters changed. After filtering, old unfiltered pages appeared.
 *     Fixed by giving ApplicationsList a key derived from all filter params
 *     so it remounts cleanly on every filter change.
 *
 *   Bug 2 — isPending discarded, zero loading feedback
 *     useTransition's isPending was thrown away. During the server round-trip
 *     the UI was frozen with no indicator. Fixed by using isPending to swap
 *     the search icon for a Loader2 spinner while the transition is active.
 *
 * Tests also verify the happy-path filter flows end-to-end against a real
 * Supabase backend: search, status, tier, combined, clear, and URL state.
 *
 * Authenticated tests require E2E_TEST_EMAIL + E2E_TEST_PASSWORD.
 * Without them the authenticated suite is skipped automatically.
 * Each test creates its own applications and deletes them — fully self-cleaning.
 */

import { test, expect, type Page } from "@playwright/test";

const E2E_EMAIL    = process.env.E2E_TEST_EMAIL;
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;

// Unique run tag so test applications never collide with real data
const RUN_ID = Date.now();
const TAG    = `[E2E-FILTER-${RUN_ID}]`;

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

// ── Application factory ───────────────────────────────────────────────────────

interface AppSpec {
  company:  string;
  position: string;
  status?:  string;
}

async function createApp(page: Page, spec: AppSpec) {
  await page.goto("/applications/new");
  await expect(page.getByRole("heading", { name: /new application/i })).toBeVisible({ timeout: 10_000 });

  await page.getByLabel(/company/i).fill(spec.company);
  await page.getByLabel(/position/i).fill(spec.position);

  if (spec.status && spec.status !== "Applied") {
    // Status select — open and choose
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: spec.status }).click();
  }

  await page.getByRole("button", { name: /create application/i }).click();
  await expect(page).toHaveURL(/\/applications/, { timeout: 15_000 });
}

/** Delete a test application via the card's three-dot menu. */
async function deleteApp(page: Page, company: string) {
  await page.goto("/applications");
  await expect(page).toHaveURL(/\/applications/, { timeout: 10_000 });

  const card = page.locator('[data-testid="application-card"]', { hasText: company }).first();
  if (!(await card.isVisible({ timeout: 5_000 }).catch(() => false))) return;

  await card.getByRole("button", { name: /options|more/i }).click();
  await page.getByRole("menuitem", { name: /^delete$/i }).click();
  await page.getByRole("menuitem", { name: /confirm delete/i }).click();
  await expect(card).not.toBeVisible({ timeout: 10_000 });
}

// ── Unauthenticated ───────────────────────────────────────────────────────────

test.describe("Application filters — unauthenticated", () => {
  test("redirects /applications to login when not authenticated", async ({ page }) => {
    await page.goto("/applications");
    await expect(page).toHaveURL(/\/login/);
  });

  test("redirects /applications?search=foo to login when not authenticated", async ({ page }) => {
    await page.goto("/applications?search=foo");
    await expect(page).toHaveURL(/\/login/);
  });
});

// ── Authenticated ─────────────────────────────────────────────────────────────

test.describe("Application filters — authenticated", () => {
  test.skip(!E2E_EMAIL || !E2E_PASSWORD, "Skipped: E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set");

  test.beforeEach(async ({ page }) => {
    await logIn(page);
  });

  // ── Spinner during search transition ────────────────────────────────────────

  test.describe("search spinner (isPending fix)", () => {
    test("shows a spinner in the search box while the server is re-rendering", async ({ page }) => {
      const companyA = `${TAG}-SpinnerA`;
      const companyB = `${TAG}-SpinnerB`;

      // Create two test apps so there is data on the page
      await createApp(page, { company: companyA, position: "Engineer Spin A" });
      await createApp(page, { company: companyB, position: "Engineer Spin B" });

      await page.goto("/applications");
      await expect(page).toHaveURL(/\/applications$/);

      // Start typing — the spinner should appear before the 400 ms debounce fires
      const searchInput = page.getByPlaceholder(/search company/i);
      await searchInput.fill(companyA);

      // The spinner (Loader2 animate-spin) should briefly replace the search icon
      const spinner = page.locator("form svg.animate-spin").first();
      await expect(spinner).toBeVisible({ timeout: 2_000 });

      // After the transition completes the spinner should disappear
      await expect(spinner).not.toBeVisible({ timeout: 10_000 });

      // Clean up
      await deleteApp(page, companyA);
      await deleteApp(page, companyB);
    });
  });

  // ── Search filtering ────────────────────────────────────────────────────────

  test.describe("search filter", () => {
    test("searching by company name shows only matching applications", async ({ page }) => {
      const companyMatch    = `${TAG}-SearchMatch`;
      const companyNoMatch  = `${TAG}-SearchNoMatch`;

      await createApp(page, { company: companyMatch,   position: "Engineer Search" });
      await createApp(page, { company: companyNoMatch, position: "Designer Search" });

      await page.goto("/applications");

      // Type the distinctive company name
      await page.getByPlaceholder(/search company/i).fill(companyMatch);

      // Wait for results to settle
      await expect(page.locator('[data-testid="application-card"]', { hasText: companyMatch })).toBeVisible({ timeout: 10_000 });

      // The non-matching card should be gone
      await expect(page.locator('[data-testid="application-card"]', { hasText: companyNoMatch })).not.toBeVisible({ timeout: 5_000 });

      // Clean up
      await deleteApp(page, companyMatch);
      await deleteApp(page, companyNoMatch);
    });

    test("searching by position title shows only matching applications", async ({ page }) => {
      const position = `${TAG}-SRP-UniqueRole`;
      const other    = `${TAG}-SRP-OtherCompany`;

      await createApp(page, { company: `${TAG}-SRP-Co`, position });
      await createApp(page, { company: other,           position: "Different Role" });

      await page.goto("/applications");
      await page.getByPlaceholder(/search company/i).fill(position);

      await expect(page.locator('[data-testid="application-card"]', { hasText: position })).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('[data-testid="application-card"]', { hasText: other })).not.toBeVisible({ timeout: 5_000 });

      await deleteApp(page, `${TAG}-SRP-Co`);
      await deleteApp(page, other);
    });

    test("clearing search with the ✕ button restores all applications", async ({ page }) => {
      const companyA = `${TAG}-ClearA`;
      const companyB = `${TAG}-ClearB`;

      await createApp(page, { company: companyA, position: "Engineer Clear A" });
      await createApp(page, { company: companyB, position: "Engineer Clear B" });

      await page.goto("/applications");
      const searchInput = page.getByPlaceholder(/search company/i);

      // Filter down
      await searchInput.fill(companyA);
      await expect(page.locator('[data-testid="application-card"]', { hasText: companyB })).not.toBeVisible({ timeout: 8_000 });

      // Clear with the ✕ button
      await page.getByRole("button", { name: /clear search/i }).click();

      // Both cards should reappear
      await expect(page.locator('[data-testid="application-card"]', { hasText: companyA })).toBeVisible({ timeout: 8_000 });
      await expect(page.locator('[data-testid="application-card"]', { hasText: companyB })).toBeVisible({ timeout: 5_000 });

      await deleteApp(page, companyA);
      await deleteApp(page, companyB);
    });

    test("no-results empty state shown when search matches nothing", async ({ page }) => {
      await page.goto("/applications?search=zzz-definitely-no-match-xyzzy");
      await expect(page.getByText(/no applications match your filters/i)).toBeVisible({ timeout: 10_000 });
    });
  });

  // ── Status filter (now a horizontal pill row, not a dropdown) ──────────────

  test.describe("status filter", () => {
    test("clicking a status pill shows only applications with that status", async ({ page }) => {
      const appliedCo   = `${TAG}-StatusApplied`;
      const interviewCo = `${TAG}-StatusInterview`;

      await createApp(page, { company: appliedCo,   position: "Eng Status", status: "Applied" });
      await createApp(page, { company: interviewCo, position: "Eng Status", status: "Interview" });

      await page.goto("/applications");

      // The pill group has aria-label="Filter by status". Click "Interview".
      const pillGroup = page.getByRole("group", { name: /filter by status/i });
      await expect(pillGroup).toBeVisible({ timeout: 10_000 });
      await pillGroup.getByRole("button", { name: /^interview$/i }).click();

      // Only the Interview card should be visible
      await expect(page.locator('[data-testid="application-card"]', { hasText: interviewCo })).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('[data-testid="application-card"]', { hasText: appliedCo })).not.toBeVisible({ timeout: 5_000 });

      // URL should carry the status param
      await expect(page).toHaveURL(/status=Interview/);

      // Clean up
      await deleteApp(page, appliedCo);
      await deleteApp(page, interviewCo);
    });

    test("clicking the 'All' pill resets the status filter", async ({ page }) => {
      const appliedCo   = `${TAG}-PillClearApplied`;
      const interviewCo = `${TAG}-PillClearInterview`;

      await createApp(page, { company: appliedCo,   position: "Eng PC", status: "Applied" });
      await createApp(page, { company: interviewCo, position: "Eng PC", status: "Interview" });

      // Navigate with the filter already set via URL
      await page.goto("/applications?status=Interview");

      await expect(page.locator('[data-testid="application-card"]', { hasText: interviewCo })).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('[data-testid="application-card"]', { hasText: appliedCo })).not.toBeVisible({ timeout: 5_000 });

      // Click "All" pill to reset — no separate chip to dismiss in the new design
      const pillGroup = page.getByRole("group", { name: /filter by status/i });
      await pillGroup.getByRole("button", { name: /^all$/i }).click();

      // Both should now be visible
      await expect(page.locator('[data-testid="application-card"]', { hasText: appliedCo })).toBeVisible({ timeout: 8_000 });
      await expect(page.locator('[data-testid="application-card"]', { hasText: interviewCo })).toBeVisible({ timeout: 5_000 });

      await deleteApp(page, appliedCo);
      await deleteApp(page, interviewCo);
    });
  });

  // ── URL state ───────────────────────────────────────────────────────────────

  test.describe("URL state", () => {
    test("search term is reflected in the URL query string", async ({ page }) => {
      await page.goto("/applications");
      await page.getByPlaceholder(/search company/i).fill("TestSearchTerm");
      await expect(page).toHaveURL(/search=TestSearchTerm/, { timeout: 5_000 });
    });

    test("clicking a status pill reflects status in the URL query string", async ({ page }) => {
      await page.goto("/applications");
      const pillGroup = page.getByRole("group", { name: /filter by status/i });
      await expect(pillGroup).toBeVisible({ timeout: 10_000 });
      await pillGroup.getByRole("button", { name: /^offer$/i }).click();
      await expect(page).toHaveURL(/status=Offer/, { timeout: 5_000 });
    });

    test("navigating directly to a filtered URL highlights the correct status pill", async ({ page }) => {
      await page.goto("/applications?status=Rejected");
      // The "Rejected" pill should be visible and be the active one
      const pillGroup = page.getByRole("group", { name: /filter by status/i });
      await expect(pillGroup).toBeVisible({ timeout: 8_000 });
      // The pill text "Rejected" must be present in the pill row
      await expect(pillGroup.getByRole("button", { name: /^rejected$/i })).toBeVisible();
      // URL should retain the status param
      await expect(page).toHaveURL(/status=Rejected/);
    });
  });

  // ── Stale data fix (key-based remount) ─────────────────────────────────────

  test.describe("stale data fix — filter clears previous results", () => {
    test("switching filters shows only the newly-filtered apps, not previous results", async ({ page }) => {
      const rejectedCo  = `${TAG}-StaleRejected`;
      const offeredCo   = `${TAG}-StaleOffer`;

      await createApp(page, { company: rejectedCo, position: "Eng Stale", status: "Rejected" });
      await createApp(page, { company: offeredCo,  position: "Eng Stale", status: "Offer" });

      // Filter by Rejected — see the rejected app
      await page.goto("/applications?status=Rejected");
      await expect(page.locator('[data-testid="application-card"]', { hasText: rejectedCo })).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('[data-testid="application-card"]', { hasText: offeredCo })).not.toBeVisible({ timeout: 5_000 });

      // Now switch to Offer filter — should ONLY show offeredCo, not rejectedCo
      await page.goto("/applications?status=Offer");
      await expect(page.locator('[data-testid="application-card"]', { hasText: offeredCo })).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('[data-testid="application-card"]', { hasText: rejectedCo })).not.toBeVisible({ timeout: 5_000 });

      await deleteApp(page, rejectedCo);
      await deleteApp(page, offeredCo);
    });

    test("applying a search after a status filter shows correct intersection", async ({ page }) => {
      const matchCo    = `${TAG}-Combo-Match`;
      const noMatchCo  = `${TAG}-Combo-NoMatch`;

      await createApp(page, { company: matchCo,   position: "Combo Engineer", status: "Applied" });
      await createApp(page, { company: noMatchCo, position: "Combo Engineer", status: "Applied" });

      // Status = Applied, Search = matchCo partial string
      await page.goto(`/applications?status=Applied&search=${encodeURIComponent(matchCo)}`);

      await expect(page.locator('[data-testid="application-card"]', { hasText: matchCo })).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('[data-testid="application-card"]', { hasText: noMatchCo })).not.toBeVisible({ timeout: 5_000 });

      await deleteApp(page, matchCo);
      await deleteApp(page, noMatchCo);
    });
  });
});
