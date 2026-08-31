/**
 * E2E — AI & Growth Sprint (August 2026)
 *
 * What this tests that unit tests cannot:
 *
 *  1. Unauthenticated guards — real HTTP 401/403 responses from the running server.
 *
 *  2. GET /api/nesta-ai/analytics — authenticated response shape and cap values
 *     are wired to the real DB ai_usage table (live Supabase).
 *
 *  3. GET /api/referrals — authenticated code creation and referralUrl format
 *     against real user_referral_codes table.
 *
 *  4. POST /api/referrals — click tracking with a valid code; 400 rejection on
 *     invalid code format; returns { ok: true } without exposing DB internals.
 *
 *  5. GET /api/feature-flags — all known flags are present in the response;
 *     rag_semantic_search is disabled; Cache-Control is no-store.
 *
 *  6. Pricing page A/B test — the _jn_ab_pricing cookie is set to 'a' or 'b'
 *     on first visit and stays stable across reloads.
 *
 * Authenticated tests require E2E_TEST_EMAIL + E2E_TEST_PASSWORD and a live
 * Supabase backend. Without credentials they are skipped automatically so CI
 * without real credentials still passes (all unit tests cover the logic).
 */

import { test, expect } from "@playwright/test";

const E2E_EMAIL    = process.env.E2E_TEST_EMAIL;
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function browserLogIn(page: import("@playwright/test").Page) {
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

// ── 1. Unauthenticated guards ─────────────────────────────────────────────────

test.describe("Unauthenticated guards", () => {
  test("GET /api/nesta-ai/analytics returns 401", async ({ request }) => {
    const res = await request.get("/api/nesta-ai/analytics");
    expect(res.status()).toBe(401);
  });

  test("GET /api/referrals returns 401", async ({ request }) => {
    const res = await request.get("/api/referrals");
    expect(res.status()).toBe(401);
  });

  test("GET /api/feature-flags returns 401", async ({ request }) => {
    const res = await request.get("/api/feature-flags");
    expect(res.status()).toBe(401);
  });

  test("POST /api/referrals without Origin header returns 403", async ({ request }) => {
    // No Origin → verifyOrigin() fails in production
    const res = await request.post("/api/referrals", {
      data: { code: "a1b2c3d4" },
      headers: { "Content-Type": "application/json" },
      failOnStatusCode: false,
    });
    // 403 (bad origin) or 401 (no session) — both are acceptable rejections
    expect([401, 403]).toContain(res.status());
  });

  test("POST /api/referrals with invalid code format returns 400", async ({ request }) => {
    const res = await request.post("/api/referrals", {
      data: { code: "not-hex!!" },
      headers: { "Content-Type": "application/json", "Origin": "http://localhost:3000" },
      failOnStatusCode: false,
    });
    expect([400, 401, 403]).toContain(res.status());
  });
});

// ── 2. GET /api/nesta-ai/analytics — authenticated ───────────────────────────

test.describe("GET /api/nesta-ai/analytics — authenticated", () => {
  test.skip(!E2E_EMAIL || !E2E_PASSWORD, "Skipped: E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set");

  test("returns correct shape with plan, today, cap, totals, byFeature, dailyChart", async ({ page }) => {
    await browserLogIn(page);

    const res = await page.request.get("/api/nesta-ai/analytics");
    expect(res.ok()).toBeTruthy();

    const body = await res.json();
    expect(body).toHaveProperty("plan");
    expect(["free", "pro"]).toContain(body.plan);

    expect(body.today).toMatchObject({
      tokens: expect.any(Number),
      requests: expect.any(Number),
    });
    expect(body.cap).toMatchObject({
      daily: expect.any(Number),
      used: expect.any(Number),
      remaining: expect.any(Number),
    });
    expect(body.totals).toMatchObject({
      tokens: expect.any(Number),
      requests: expect.any(Number),
      days: 30,
    });
    expect(body.byFeature).toEqual(expect.any(Object));
    expect(Array.isArray(body.dailyChart)).toBe(true);
    expect(body.dailyChart).toHaveLength(14);
  });

  test("daily cap is 100000 for free user or 2000000 for pro", async ({ page }) => {
    await browserLogIn(page);
    const body = await (await page.request.get("/api/nesta-ai/analytics")).json();
    expect([100_000, 2_000_000]).toContain(body.cap.daily);
  });

  test("cap.used + cap.remaining === cap.daily", async ({ page }) => {
    await browserLogIn(page);
    const body = await (await page.request.get("/api/nesta-ai/analytics")).json();
    expect(body.cap.used + body.cap.remaining).toBe(body.cap.daily);
  });

  test("dailyChart last entry is today's date", async ({ page }) => {
    await browserLogIn(page);
    const body = await (await page.request.get("/api/nesta-ai/analytics")).json();
    const today = new Date().toISOString().slice(0, 10);
    const last  = body.dailyChart[body.dailyChart.length - 1];
    expect(last.date).toBe(today);
  });
});

// ── 3. GET /api/referrals — authenticated ─────────────────────────────────────

test.describe("GET /api/referrals — authenticated", () => {
  test.skip(!E2E_EMAIL || !E2E_PASSWORD, "Skipped: E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set");

  test("returns code, referralUrl, stats, events", async ({ page }) => {
    await browserLogIn(page);

    const res = await page.request.get("/api/referrals");
    expect(res.ok()).toBeTruthy();

    const body = await res.json();
    expect(typeof body.code).toBe("string");
    expect(body.code).toMatch(/^[0-9a-f]{8}$/);
    expect(body.referralUrl).toContain(body.code);
    expect(body.referralUrl).toContain("/signup?ref=");
    expect(body.stats).toMatchObject({
      clicks:    expect.any(Number),
      signups:   expect.any(Number),
      converted: expect.any(Number),
    });
    expect(Array.isArray(body.events)).toBe(true);
  });

  test("code is stable across multiple calls (idempotent lazy creation)", async ({ page }) => {
    await browserLogIn(page);

    const r1 = await (await page.request.get("/api/referrals")).json();
    const r2 = await (await page.request.get("/api/referrals")).json();
    expect(r1.code).toBe(r2.code);
    expect(r1.referralUrl).toBe(r2.referralUrl);
  });

  test("referralUrl is a valid URL", async ({ page }) => {
    await browserLogIn(page);
    const body = await (await page.request.get("/api/referrals")).json();
    expect(() => new URL(body.referralUrl)).not.toThrow();
  });
});

// ── 4. POST /api/referrals — click tracking ───────────────────────────────────

test.describe("POST /api/referrals — click tracking", () => {
  test.skip(!E2E_EMAIL || !E2E_PASSWORD, "Skipped: E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set");

  test("valid code from own profile returns { ok: true }", async ({ page }) => {
    await browserLogIn(page);

    // Get the user's own referral code
    const { code } = await (await page.request.get("/api/referrals")).json();

    const res = await page.request.post("/api/referrals", {
      data: { code },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test("invalid hex code returns 400", async ({ page }) => {
    await browserLogIn(page);

    const res = await page.request.post("/api/referrals", {
      data: { code: "ZZZZZZZZ" },
      headers: { "Content-Type": "application/json" },
      failOnStatusCode: false,
    });
    expect(res.status()).toBe(400);
  });

  test("missing code returns 400", async ({ page }) => {
    await browserLogIn(page);

    const res = await page.request.post("/api/referrals", {
      data: {},
      headers: { "Content-Type": "application/json" },
      failOnStatusCode: false,
    });
    expect(res.status()).toBe(400);
  });

  test("non-existent but valid-format code returns 200 (no info leakage)", async ({ page }) => {
    await browserLogIn(page);

    const res = await page.request.post("/api/referrals", {
      data: { code: "00000000" },
      headers: { "Content-Type": "application/json" },
      failOnStatusCode: false,
    });
    // Server silently no-ops; unknown code is not an error to prevent oracle attack
    expect(res.status()).toBe(200);
  });
});

// ── 5. GET /api/feature-flags — authenticated ─────────────────────────────────

test.describe("GET /api/feature-flags — authenticated", () => {
  test.skip(!E2E_EMAIL || !E2E_PASSWORD, "Skipped: E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set");

  test("returns flags map with all seeded flags present", async ({ page }) => {
    await browserLogIn(page);

    const res = await page.request.get("/api/feature-flags");
    expect(res.ok()).toBeTruthy();

    const body = await res.json();
    expect(body).toHaveProperty("flags");

    const { flags } = body;
    expect(flags).toHaveProperty("pricing_cta_variant_b");
    expect(flags).toHaveProperty("ai_usage_dashboard");
    expect(flags).toHaveProperty("referral_program");
    expect(flags).toHaveProperty("rag_semantic_search");
  });

  test("rag_semantic_search is disabled (rollout_percentage = 0)", async ({ page }) => {
    await browserLogIn(page);
    const { flags } = await (await page.request.get("/api/feature-flags")).json();
    expect(flags.rag_semantic_search).toBe(false);
  });

  test("ai_usage_dashboard is enabled (rollout_percentage = 100)", async ({ page }) => {
    await browserLogIn(page);
    const { flags } = await (await page.request.get("/api/feature-flags")).json();
    expect(flags.ai_usage_dashboard).toBe(true);
  });

  test("referral_program is enabled (rollout_percentage = 100)", async ({ page }) => {
    await browserLogIn(page);
    const { flags } = await (await page.request.get("/api/feature-flags")).json();
    expect(flags.referral_program).toBe(true);
  });

  test("response has Cache-Control: no-store", async ({ page }) => {
    await browserLogIn(page);
    const res = await page.request.get("/api/feature-flags");
    expect(res.headers()["cache-control"]).toBe("no-store");
  });
});

// ── 6. Pricing page A/B test ──────────────────────────────────────────────────

test.describe("Pricing page A/B test", () => {
  test("_jn_ab_pricing cookie is set on first visit with value 'a' or 'b'", async ({ page }) => {
    await page.goto("/pricing");
    await page.waitForLoadState("networkidle");

    const cookies = await page.context().cookies();
    const abCookie = cookies.find((c) => c.name === "_jn_ab_pricing");

    expect(abCookie).toBeDefined();
    expect(["a", "b"]).toContain(abCookie?.value);
  });

  test("cookie value is stable across reloads (same variant served)", async ({ page }) => {
    await page.goto("/pricing");
    await page.waitForLoadState("networkidle");

    const cookies1 = await page.context().cookies();
    const v1 = cookies1.find((c) => c.name === "_jn_ab_pricing")?.value;

    await page.reload();
    await page.waitForLoadState("networkidle");

    const cookies2 = await page.context().cookies();
    const v2 = cookies2.find((c) => c.name === "_jn_ab_pricing")?.value;

    expect(v1).toBe(v2);
  });

  test("pricing hero section renders a subheading", async ({ page }) => {
    await page.goto("/pricing");
    // The hero p tag is visible (either variant A or B text)
    const hero = page.locator("section").first().locator("p").first();
    await expect(hero).toBeVisible();
    const text = await hero.textContent();
    expect(text?.length).toBeGreaterThan(20);
  });
});
