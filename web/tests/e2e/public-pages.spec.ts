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
