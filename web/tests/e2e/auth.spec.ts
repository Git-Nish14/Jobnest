/**
 * E2E — Authentication critical paths
 *
 * These tests verify the auth UI flows work end-to-end in a real browser.
 * They do NOT complete sign-in (no real credentials) — they verify the
 * forms, validation messages, and redirects behave correctly.
 *
 * For full sign-in flows with real credentials, set:
 *   E2E_TEST_EMAIL / E2E_TEST_PASSWORD in your staging environment.
 */
import { test, expect } from "@playwright/test";

test.describe("Login flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("shows email field and continue button", async ({ page }) => {
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /continue|sign in|next/i })).toBeVisible();
  });

  test("shows validation error for invalid email", async ({ page }) => {
    await page.getByLabel(/email/i).fill("notanemail");
    await page.getByRole("button", { name: /continue|sign in|next/i }).click();
    // Should show a validation message
    await expect(page.getByText(/valid email|invalid/i)).toBeVisible({ timeout: 5000 });
  });

  test("has link to signup page", async ({ page }) => {
    const signupLink = page.getByRole("link", { name: /sign up|create account/i });
    await expect(signupLink).toBeVisible();
    await signupLink.click();
    await expect(page).toHaveURL(/\/signup/);
  });

  test("has forgot password link", async ({ page }) => {
    await expect(page.getByRole("link", { name: /forgot/i })).toBeVisible();
  });
});

test.describe("Signup flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/signup");
  });

  test("shows required fields", async ({ page }) => {
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i).first()).toBeVisible();
  });

  test("has age verification and terms checkboxes", async ({ page }) => {
    const checkboxes = page.getByRole("checkbox");
    const count = await checkboxes.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test("has link back to login", async ({ page }) => {
    await expect(page.getByRole("link", { name: /sign in|log in/i })).toBeVisible();
  });
});

test.describe("Auth redirect", () => {
  test("dashboard redirects unauthenticated users to login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("applications redirects unauthenticated users to login", async ({ page }) => {
    await page.goto("/applications");
    await expect(page).toHaveURL(/\/login/);
  });

  test("profile redirects unauthenticated users to login", async ({ page }) => {
    await page.goto("/profile");
    await expect(page).toHaveURL(/\/login/);
  });
});

// Full authenticated flow — only runs when credentials are provided
const E2E_EMAIL = process.env.E2E_TEST_EMAIL;
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;

test.describe("Authenticated flows", () => {
  test.skip(!E2E_EMAIL || !E2E_PASSWORD, "Skipped: E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set");

  test("can sign in and reach dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(E2E_EMAIL!);
    await page.getByRole("button", { name: /continue|next/i }).click();
    // Wait for password or OTP step
    await page.waitForTimeout(500);
    if (await page.getByLabel(/password/i).isVisible()) {
      await page.getByLabel(/password/i).fill(E2E_PASSWORD!);
      await page.getByRole("button", { name: /sign in|continue/i }).click();
    }
    await expect(page).toHaveURL(/\/dashboard|\/onboarding/, { timeout: 15000 });
  });
});
