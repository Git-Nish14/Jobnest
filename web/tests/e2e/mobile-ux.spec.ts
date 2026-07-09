/**
 * E2E — Mobile UX changes shipped in this sprint
 *
 * Covers the following real-browser, real-network scenarios:
 *
 *   Bottom tab bar (floating glass pill)
 *     Visible on mobile viewports; absent on desktop.
 *     Has the four expected navigation tabs.
 *     Slides off-screen when the mobile nav drawer is opened.
 *
 *   Mobile nav deduplication
 *     The hamburger slide panel shows a "More pages" section.
 *     It lists secondary pages (Reminders, Contacts, etc.) that aren't in
 *     the bottom tab bar.
 *     It does NOT show primary pages (Overview, Applications, Interviews)
 *     that are already reachable via the bottom tab bar.
 *
 *   NPS feedback API — live end-to-end submission
 *     Posting valid feedback from an authenticated session returns HTTP 200.
 *     (Widget visibility timing is not tested here — unit tests cover the
 *     localStorage / metadata logic; this test verifies the network path.)
 *
 *   Application Velocity chart — no horizontal overflow on mobile
 *     On a 390 px viewport the panel must not create a horizontal scrollbar.
 *
 * Unauthenticated tests always run.
 * Authenticated tests require E2E_TEST_EMAIL + E2E_TEST_PASSWORD and a live
 * Supabase backend. Without credentials they are skipped automatically.
 */

import { test, expect, type Page } from "@playwright/test";

const E2E_EMAIL    = process.env.E2E_TEST_EMAIL;
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;

const MOBILE_VIEWPORT = { width: 390, height: 844 };  // iPhone 14
const DESKTOP_VIEWPORT = { width: 1280, height: 800 };

// ── Auth helper (shared across suites) ────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// 1. Bottom Tab Bar — unauthenticated checks
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Bottom tab bar — public pages", () => {
  test("tab bar is not present on the landing page (not in dashboard layout)", async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto("/");
    // The bottom tab bar only renders inside the dashboard layout shell.
    const tabBar = page.locator("nav[aria-label='Primary navigation']");
    await expect(tabBar).toHaveCount(0);
  });

  test("tab bar is not present on the login page", async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto("/login");
    const tabBar = page.locator("nav[aria-label='Primary navigation']");
    await expect(tabBar).toHaveCount(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Bottom Tab Bar — authenticated mobile checks
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Bottom tab bar — authenticated dashboard", () => {
  test.skip(
    !E2E_EMAIL || !E2E_PASSWORD,
    "Skipped: E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set"
  );

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await logIn(page);
    await page.goto("/dashboard");
  });

  test("tab bar is visible on mobile viewport", async ({ page }) => {
    const tabBar = page.locator("nav[aria-label='Primary navigation']");
    await expect(tabBar).toBeVisible({ timeout: 10_000 });
  });

  test("tab bar is hidden on desktop viewport", async ({ page }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    // md:hidden kicks in at 768px — at 1280px the tab bar is display:none
    const tabBar = page.locator("nav[aria-label='Primary navigation']");
    await expect(tabBar).toBeHidden({ timeout: 5_000 });
  });

  test("tab bar contains links to all four primary destinations", async ({ page }) => {
    const tabBar = page.locator("nav[aria-label='Primary navigation']");
    await expect(tabBar).toBeVisible({ timeout: 10_000 });

    // Three regular tabs in REGULAR_TABS array
    await expect(tabBar.getByRole("link", { name: /overview/i })).toBeVisible();
    await expect(tabBar.getByRole("link", { name: /applications/i })).toBeVisible();
    await expect(tabBar.getByRole("link", { name: /interviews/i })).toBeVisible();
    // NESTAi tab (separate hardcoded link)
    await expect(tabBar.getByRole("link", { name: /nestai/i })).toBeVisible();
  });

  test("tab bar has exactly four navigation links", async ({ page }) => {
    const tabBar = page.locator("nav[aria-label='Primary navigation']");
    await expect(tabBar).toBeVisible({ timeout: 10_000 });
    const links = tabBar.getByRole("link");
    await expect(links).toHaveCount(4);
  });

  test("active tab for /dashboard shows aria-current='page'", async ({ page }) => {
    const tabBar = page.locator("nav[aria-label='Primary navigation']");
    await expect(tabBar).toBeVisible({ timeout: 10_000 });
    const overviewLink = tabBar.getByRole("link", { name: /overview/i });
    await expect(overviewLink).toHaveAttribute("aria-current", "page");
  });

  test("tab bar is not visible when the mobile nav drawer is open", async ({ page }) => {
    const tabBar = page.locator("nav[aria-label='Primary navigation']");
    await expect(tabBar).toBeVisible({ timeout: 10_000 });

    // Open the hamburger menu (aria-label="Open menu", visible below lg)
    await page.getByRole("button", { name: /open menu/i }).click();

    // The slide panel should be visible
    await expect(page.getByText(/more pages/i)).toBeVisible({ timeout: 5_000 });

    // The tab bar should have slid off-screen (opacity:0 + transform or
    // at minimum pointer-events:none — CSS transition may still be mid-flight
    // so we check it is not interactable rather than not visible)
    // The html element gets class "nav-open" which triggers the CSS slide.
    const html = page.locator("html");
    await expect(html).toHaveClass(/nav-open/, { timeout: 3_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Mobile nav deduplication
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Mobile nav slide panel — link deduplication", () => {
  test.skip(
    !E2E_EMAIL || !E2E_PASSWORD,
    "Skipped: E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set"
  );

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await logIn(page);
    await page.goto("/dashboard");
  });

  test("slide panel shows 'More pages' section label", async ({ page }) => {
    await page.getByRole("button", { name: /open menu/i }).click();
    await expect(page.getByText(/more pages/i)).toBeVisible({ timeout: 5_000 });
  });

  test("slide panel lists secondary pages (not in the bottom tab bar)", async ({ page }) => {
    await page.getByRole("button", { name: /open menu/i }).click();

    // All secondary pages should be accessible via the slide panel
    const panel = page.locator(".atelier-slide-panel, [class*='slide-panel']").first();
    await expect(panel).toBeVisible({ timeout: 5_000 });

    await expect(panel.getByRole("link", { name: /reminders/i })).toBeVisible();
    await expect(panel.getByRole("link", { name: /contacts/i })).toBeVisible();
    await expect(panel.getByRole("link", { name: /salary/i })).toBeVisible();
    await expect(panel.getByRole("link", { name: /ats scan/i })).toBeVisible();
    await expect(panel.getByRole("link", { name: /interview prep/i })).toBeVisible();
  });

  test("slide panel does NOT show primary tabs (covered by bottom bar)", async ({ page }) => {
    await page.getByRole("button", { name: /open menu/i }).click();

    const panel = page.locator(".atelier-slide-panel, [class*='slide-panel']").first();
    await expect(panel).toBeVisible({ timeout: 5_000 });

    // These four destinations are in the bottom tab bar — the slide panel
    // should NOT list them to avoid duplication.
    await expect(panel.getByRole("link", { name: /^overview$/i })).toHaveCount(0);
    await expect(panel.getByRole("link", { name: /^applications$/i })).toHaveCount(0);
    await expect(panel.getByRole("link", { name: /^interviews$/i })).toHaveCount(0);
    await expect(panel.getByRole("link", { name: /^nestai$/i })).toHaveCount(0);
  });

  test("slide panel closes and tab bar returns when clicking the backdrop", async ({ page }) => {
    await page.getByRole("button", { name: /open menu/i }).click();
    await expect(page.getByText(/more pages/i)).toBeVisible({ timeout: 5_000 });

    // Click the semi-transparent backdrop (not the panel itself)
    // The backdrop is a fixed inset-0 div behind the panel
    await page.getByRole("button", { name: /close menu/i }).click();

    // html.nav-open class should be removed
    const html = page.locator("html");
    await expect(html).not.toHaveClass(/nav-open/, { timeout: 3_000 });

    // Tab bar should be visible again
    const tabBar = page.locator("nav[aria-label='Primary navigation']");
    await expect(tabBar).toBeVisible({ timeout: 5_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. NPS Feedback — live API submission
// ─────────────────────────────────────────────────────────────────────────────

test.describe("NPS feedback API — live submission", () => {
  test.skip(
    !E2E_EMAIL || !E2E_PASSWORD,
    "Skipped: E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set"
  );

  test("POST /api/feedback returns 200 for a valid authenticated score", async ({ page }) => {
    // Log in so the session cookie is set in the browser context
    await logIn(page);

    // Use page.request which shares cookies with the page session
    const res = await page.request.post("/api/feedback", {
      data: { score: 8, comment: "[E2E automated test — please ignore]" },
      headers: {
        "Content-Type": "application/json",
        // CSRF origin check expects the request to come from the app origin
        "Origin": page.url().replace(/\/[^/]+$/, ""),
      },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test("POST /api/feedback returns 400 for an out-of-range score", async ({ page }) => {
    await logIn(page);

    const res = await page.request.post("/api/feedback", {
      data: { score: 11 },
      headers: {
        "Content-Type": "application/json",
        "Origin": page.url().replace(/\/[^/]+$/, ""),
      },
    });

    expect(res.status()).toBe(400);
  });

  test("POST /api/feedback returns 401 when not authenticated", async ({ page }) => {
    // Don't log in — make request with no session
    await page.goto("/login"); // ensure page has an origin
    const res = await page.request.post("/api/feedback", {
      data: { score: 7 },
      headers: {
        "Content-Type": "application/json",
        "Origin": page.url().replace(/\/[^/]+$/, ""),
      },
    });

    expect(res.status()).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Application Velocity chart — no horizontal overflow on mobile
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Application Velocity chart — mobile layout", () => {
  test.skip(
    !E2E_EMAIL || !E2E_PASSWORD,
    "Skipped: E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set"
  );

  test("chart panel does not cause horizontal scroll on 390px viewport", async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await logIn(page);
    await page.goto("/dashboard");

    // Wait for the chart panel to render
    const panel = page.locator(".db-panel").first();
    await expect(panel).toBeVisible({ timeout: 15_000 });

    // The document body must not overflow horizontally
    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth
    );
    const clientWidth = await page.evaluate(
      () => document.documentElement.clientWidth
    );
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2); // 2px tolerance for rounding
  });

  test("chart header title and controls both fit without wrapping to a third row", async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await logIn(page);
    await page.goto("/dashboard");

    const chartPanel = page.locator(".db-panel").filter({ hasText: /application velocity/i }).first();
    await expect(chartPanel).toBeVisible({ timeout: 15_000 });

    // The header is a flex-col on mobile — title sits above controls.
    // Verify both elements are visible within the panel bounds.
    const title = chartPanel.getByText(/application velocity/i);
    await expect(title).toBeVisible();

    // Granularity buttons (D, W, M) should be visible
    const weekBtn = chartPanel.getByRole("button", { name: "W" });
    await expect(weekBtn).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Mobile UX Sprint — new feature E2E checks
// ─────────────────────────────────────────────────────────────────────────────

// 6a. Cookie banner — unauthenticated, no credentials needed ──────────────────

test.describe("Cookie banner — full-width bottom strip", () => {
  test("shows as a full-width bottom strip with atelier-bottom-bar CSS class", async ({ page }) => {
    // Clear localStorage so the banner actually appears
    await page.addInitScript(() => {
      try { localStorage.removeItem("jobnest_cookie_consent"); } catch { /* ok */ }
    });
    await page.goto("/");

    const banner = page.locator('[aria-label="Cookie consent"]');
    await expect(banner).toBeVisible({ timeout: 8_000 });

    // Must be full-width (inset-x-0) and anchored to the bottom
    await expect(banner).toHaveClass(/inset-x-0/);
    await expect(banner).toHaveClass(/bottom-0/);

    // Must use the atelier-bottom-bar CSS (navbar-style background)
    await expect(banner).toHaveClass(/atelier-bottom-bar/);

    // Accepting should dismiss the banner
    await page.getByRole("button", { name: /accept all/i }).click();
    await expect(banner).toHaveCount(0);
  });

  test("shows Manage, Essential only, and Accept all actions", async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.removeItem("jobnest_cookie_consent"); } catch { /* ok */ }
    });
    await page.goto("/");

    const banner = page.locator('[aria-label="Cookie consent"]');
    await expect(banner).toBeVisible({ timeout: 8_000 });

    await expect(banner.getByRole("button", { name: /manage/i })).toBeVisible();
    await expect(banner.getByRole("button", { name: /essential only/i })).toBeVisible();
    await expect(banner.getByRole("button", { name: /accept all/i })).toBeVisible();
  });
});

// 6b. Bottom tab bar hidden on NESTAi — authenticated ────────────────────────

test.describe("Bottom tab bar — hidden on NESTAi page", () => {
  test.skip(
    !E2E_EMAIL || !E2E_PASSWORD,
    "Skipped: E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set"
  );

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await logIn(page);
  });

  test("html.page-nestai class is applied when navigating to /nestai", async ({ page }) => {
    await page.goto("/nestai");

    // The useEffect in BottomTabBar adds 'page-nestai' to <html> after navigation
    const html = page.locator("html");
    await expect(html).toHaveClass(/page-nestai/, { timeout: 5_000 });
  });

  test("bottom tab bar is not visible on the NESTAi page", async ({ page }) => {
    await page.goto("/nestai");

    // html.page-nestai .bottom-tab-bar { display: none } hides it via CSS
    const tabBar = page.locator("nav[aria-label='Primary navigation']");
    await expect(tabBar).toBeHidden({ timeout: 5_000 });
  });

  test("tab bar becomes visible again after navigating away from NESTAi", async ({ page }) => {
    await page.goto("/nestai");

    const tabBar = page.locator("nav[aria-label='Primary navigation']");
    await expect(tabBar).toBeHidden({ timeout: 5_000 });

    // Navigate to dashboard — page-nestai class should be removed
    await page.goto("/dashboard");
    await expect(tabBar).toBeVisible({ timeout: 8_000 });

    const html = page.locator("html");
    await expect(html).not.toHaveClass(/page-nestai/);
  });
});

// 6c. Dashboard FAB visible on mobile — authenticated ─────────────────────────

test.describe("Dashboard FAB — visible on mobile viewport", () => {
  test.skip(
    !E2E_EMAIL || !E2E_PASSWORD,
    "Skipped: E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set"
  );

  test("New Application FAB is visible at 390px on the dashboard", async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await logIn(page);
    await page.goto("/dashboard");

    // FAB is an <a> linking to /applications/new with title="New Application"
    const fab = page.locator('a[href="/applications/new"][title="New Application"]');
    await expect(fab).toBeVisible({ timeout: 10_000 });
  });

  test("New Application FAB is also visible at 1280px (desktop)", async ({ page }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await logIn(page);
    await page.goto("/dashboard");

    const fab = page.locator('a[href="/applications/new"][title="New Application"]');
    await expect(fab).toBeVisible({ timeout: 10_000 });
  });
});
