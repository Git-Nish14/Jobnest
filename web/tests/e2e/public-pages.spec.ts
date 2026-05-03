/**
 * E2E — Public pages
 *
 * Verifies that public-facing pages load, have correct titles,
 * contain key content, and are reachable without authentication.
 * These tests run against a live Next.js server (dev or staging).
 */
import { test, expect } from "@playwright/test";

test.describe("Landing page", () => {
  test("loads with correct title and hero content", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Jobnest/i);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("has working nav links", async ({ page }) => {
    await page.goto("/");
    // Pricing link in nav
    const pricingLink = page.getByRole("link", { name: /pricing/i }).first();
    await expect(pricingLink).toBeVisible();
    await pricingLink.click();
    await expect(page).toHaveURL(/\/pricing/);
  });

  test("has Get Started CTA", async ({ page }) => {
    await page.goto("/");
    const cta = page.getByRole("link", { name: /get started/i }).first();
    await expect(cta).toBeVisible();
  });
});

test.describe("Pricing page", () => {
  test("loads and shows Free and Pro plans", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page).toHaveTitle(/pricing/i);
    await expect(page.getByText(/free/i).first()).toBeVisible();
    await expect(page.getByText(/pro/i).first()).toBeVisible();
  });
});

test.describe("Auth pages", () => {
  test("login page renders form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });

  test("signup page renders form", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });

  test("forgot-password page renders form", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });
});

test.describe("Legal pages", () => {
  test("privacy page loads", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page).toHaveTitle(/privacy/i);
    // CCPA section is anchored
    await page.goto("/privacy#do-not-sell");
    await expect(page.locator("#do-not-sell")).toBeVisible();
  });

  test("terms page loads", async ({ page }) => {
    await page.goto("/terms");
    await expect(page).toHaveTitle(/terms/i);
  });

  test("cookies page loads", async ({ page }) => {
    await page.goto("/cookies");
    await expect(page).toHaveTitle(/cookie/i);
  });

  test("contact page loads and has form", async ({ page }) => {
    await page.goto("/contact");
    const textboxes = page.getByRole("textbox");
    const count = await textboxes.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

test.describe("404 Not Found page", () => {
  // URLs with a dot in the path bypass the auth proxy (proxy.ts:123 —
  // `pathname.includes(".")` → NextResponse.next() immediately) so Next.js
  // can serve not-found.tsx without requiring authentication.
  const unknownUrl = "/this-page-does-not-exist.html";

  test("returns HTTP 404 status for unknown routes", async ({ page }) => {
    const resp = await page.goto(unknownUrl);
    expect(resp?.status()).toBe(404);
  });

  test("renders correct title and heading", async ({ page }) => {
    await page.goto(unknownUrl);
    await expect(page).toHaveTitle(/Page Not Found.*Jobnest/i);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("flown the nest");
  });

  test("shows Back to Home and Go to Dashboard CTAs", async ({ page }) => {
    await page.goto(unknownUrl);
    await expect(page.getByRole("link", { name: /back to home/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /go to dashboard/i })).toBeVisible();
  });

  test("Back to Home link navigates to /", async ({ page }) => {
    await page.goto(unknownUrl);
    await page.getByRole("link", { name: /back to home/i }).click();
    await expect(page).toHaveURL("/");
  });

  test("quick nav links are all present", async ({ page }) => {
    await page.goto(unknownUrl);
    const nav = page.getByRole("navigation", { name: /helpful links/i });
    await expect(nav.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Applications" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "NESTAi" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Contact" })).toBeVisible();
  });

  test("jobnest logo is visible and links to /", async ({ page }) => {
    await page.goto(unknownUrl);
    const logo = page.getByRole("link", { name: /jobnest/i }).first();
    await expect(logo).toBeVisible();
    await logo.click();
    await expect(page).toHaveURL("/");
  });

  test("robots meta prevents indexing", async ({ page }) => {
    await page.goto(unknownUrl);
    // Next.js may render multiple robots meta tags; check that at least one
    // contains noindex (the page-level metadata sets robots: noindex).
    const metas = page.locator('meta[name="robots"]');
    const count = await metas.count();
    expect(count).toBeGreaterThan(0);
    let hasNoindex = false;
    for (let i = 0; i < count; i++) {
      const content = await metas.nth(i).getAttribute("content");
      if (content?.toLowerCase().includes("noindex")) hasNoindex = true;
    }
    expect(hasNoindex).toBe(true);
  });

  test("decorative 404 text is hidden from screen readers", async ({ page }) => {
    await page.goto(unknownUrl);
    const heroText = page.locator("p[aria-hidden='true']").filter({ hasText: "404" });
    await expect(heroText).toBeAttached();
  });

  test("dashboard link has correct href", async ({ page }) => {
    await page.goto(unknownUrl);
    const btn = page.getByRole("link", { name: /go to dashboard/i });
    const href = await btn.getAttribute("href");
    expect(href).toBe("/dashboard");
  });
});

test.describe("SEO", () => {
  test("sitemap.xml is accessible", async ({ page }) => {
    const resp = await page.goto("/sitemap.xml");
    expect(resp?.status()).toBe(200);
    const body = await resp?.text();
    expect(body).toContain("<urlset");
    expect(body).toContain("/pricing");
  });

  test("robots.txt is accessible and blocks private routes", async ({ page }) => {
    const resp = await page.goto("/robots.txt");
    expect(resp?.status()).toBe(200);
    const body = await resp?.text();
    expect(body).toContain("Disallow: /dashboard");
    expect(body).toContain("Sitemap:");
  });
});
