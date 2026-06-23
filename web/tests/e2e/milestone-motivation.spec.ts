/**
 * E2E — Milestone & Motivation email infrastructure
 *
 * Tests the features shipped in the milestone/motivation sprint:
 *
 *   1. Timezone API (POST /api/profile/timezone)
 *      Authenticated users can store their UTC offset so cron emails
 *      arrive at ~8am local time rather than a fixed UTC hour.
 *
 *   2. Cron auth guard (GET /api/cron/milestone-celebrations and weekly-motivation)
 *      Both endpoints require Bearer CRON_SECRET and return 401 otherwise.
 *
 *   3. Applications page mobile header
 *      Import CSV and Export buttons are hidden on < sm viewports so the
 *      header no longer overflows on phones.
 *
 *   4. Mobile scroll restoration
 *      Navigating via the bottom tab bar always starts the destination page
 *      at scroll position 0 (ScrollRestorer component).
 *
 * Unauthenticated tests always run.
 * Authenticated tests require E2E_TEST_EMAIL + E2E_TEST_PASSWORD and a live
 * Supabase backend — without them the suite is skipped automatically.
 */

import { test, expect, type Page } from "@playwright/test";

const E2E_EMAIL    = process.env.E2E_TEST_EMAIL;
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;
const CRON_SECRET  = process.env.CRON_SECRET ?? "not-set";

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

// ── 1. Cron auth guard ────────────────────────────────────────────────────────

test.describe("Cron endpoints — auth guard", () => {
  test("milestone-celebrations returns 401 without CRON_SECRET", async ({ request }) => {
    const res = await request.get("/api/cron/milestone-celebrations");
    expect(res.status()).toBe(401);
  });

  test("milestone-celebrations returns 401 with wrong secret", async ({ request }) => {
    const res = await request.get("/api/cron/milestone-celebrations", {
      headers: { authorization: "Bearer wrong-secret" },
    });
    expect(res.status()).toBe(401);
  });

  test("weekly-motivation returns 401 without CRON_SECRET", async ({ request }) => {
    const res = await request.get("/api/cron/weekly-motivation");
    expect(res.status()).toBe(401);
  });

  test("weekly-motivation returns 401 with wrong secret", async ({ request }) => {
    const res = await request.get("/api/cron/weekly-motivation", {
      headers: { authorization: "Bearer wrong-secret" },
    });
    expect(res.status()).toBe(401);
  });
});

// ── 2. Timezone API — unauthenticated ─────────────────────────────────────────

test.describe("POST /api/profile/timezone — unauthenticated", () => {
  test("returns 401 when not logged in", async ({ request }) => {
    const res = await request.post("/api/profile/timezone", {
      data: { timezone: "America/New_York", utcOffsetHours: -5 },
      headers: { origin: "http://localhost:3000" },
    });
    expect(res.status()).toBe(401);
  });
});

// ── 3. Timezone API — authenticated (real DB) ─────────────────────────────────

test.describe("POST /api/profile/timezone — authenticated", () => {
  test.skip(
    !E2E_EMAIL || !E2E_PASSWORD,
    "Skipped: E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set"
  );

  test("stores timezone in user_metadata and returns ok: true", async ({ page, request }) => {
    await logIn(page);

    // Grab auth cookies from the logged-in browser context
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

    const res = await request.post("/api/profile/timezone", {
      data: { timezone: "America/Chicago", utcOffsetHours: -6 },
      headers: {
        "Content-Type": "application/json",
        "origin": "http://localhost:3000",
        "cookie": cookieHeader,
      },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test("rejects out-of-range utcOffsetHours with 400", async ({ page, request }) => {
    await logIn(page);
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

    const res = await request.post("/api/profile/timezone", {
      data: { timezone: "Invalid/Zone", utcOffsetHours: 99 },
      headers: {
        "Content-Type": "application/json",
        origin: "http://localhost:3000",
        cookie: cookieHeader,
      },
    });
    expect(res.status()).toBe(400);
  });
});

// ── 4. Applications page mobile header ────────────────────────────────────────

test.describe("Applications page — mobile header", () => {
  test.skip(
    !E2E_EMAIL || !E2E_PASSWORD,
    "Skipped: E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set"
  );

  test("Import CSV and Export buttons are hidden on 390px mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await logIn(page);
    await page.goto("/applications");
    await page.waitForLoadState("networkidle");

    // These buttons should not be visible on mobile — they're in hidden sm:flex wrapper
    await expect(page.getByRole("button", { name: /import csv/i })).not.toBeVisible();
    await expect(page.getByRole("button", { name: /^export$/i })).not.toBeVisible();
  });

  test("Import CSV and Export buttons ARE visible on desktop (1280px)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await logIn(page);
    await page.goto("/applications");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("button", { name: /import csv/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /^export$/i })).toBeVisible({ timeout: 10_000 });
  });

  test("ViewToggle (list/kanban) is always visible on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await logIn(page);
    await page.goto("/applications");
    await page.waitForLoadState("networkidle");

    // ViewToggle uses aria-label "Switch to list view" / "Switch to Kanban view"
    const listBtn = page.getByRole("button", { name: /list view/i });
    await expect(listBtn).toBeVisible({ timeout: 10_000 });
  });
});

// ── 4b. Note on timezone-aware delivery ──────────────────────────────────────
// utc_offset_hours is stored in user_metadata (via POST /api/profile/timezone)
// for future Pro-plan use (sub-hourly cron scheduling). On Hobby plan, both
// crons run once per day/week at a fixed UTC time — no local-hour filtering.

// ── 5. Scroll restoration via bottom tab bar ──────────────────────────────────

test.describe("ScrollRestorer — bottom tab bar navigation", () => {
  test.skip(
    !E2E_EMAIL || !E2E_PASSWORD,
    "Skipped: E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set"
  );

  test("navigating via bottom tab bar starts destination page at scroll 0", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await logIn(page);

    // Go to applications page and scroll down
    await page.goto("/applications");
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => window.scrollTo(0, 500));
    const scrollBefore = await page.evaluate(() => window.scrollY);
    expect(scrollBefore).toBeGreaterThan(0);

    // Navigate to dashboard via the bottom tab bar
    const dashboardTab = page.getByRole("navigation", { name: /primary navigation/i })
      .getByRole("link", { name: /overview/i });
    await dashboardTab.click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
    await page.waitForLoadState("networkidle");

    // ScrollRestorer should have reset to 0
    const scrollAfter = await page.evaluate(() => window.scrollY);
    expect(scrollAfter).toBe(0);
  });
});

// ── 6. Cron returns ok:true with valid CRON_SECRET (smoke) ───────────────────

test.describe("Cron endpoints — valid secret smoke test", () => {
  test.skip(
    !CRON_SECRET || CRON_SECRET === "not-set",
    "Skipped: CRON_SECRET not available in test environment"
  );

  test("milestone-celebrations returns ok: true with valid secret", async ({ request }) => {
    const res = await request.get("/api/cron/milestone-celebrations", {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    // May be 200 with { ok: true } even if no users have milestones
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test("weekly-motivation returns ok: true with valid secret", async ({ request }) => {
    const res = await request.get("/api/cron/weekly-motivation", {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});
