/**
 * E2E — UI behaviour tests
 *
 * Tests that don't require authentication — dark mode toggle,
 * command palette keyboard shortcut, responsive layout, etc.
 */
import { test, expect } from "@playwright/test";

test.describe("Dark mode", () => {
  test("toggles dark class on html element", async ({ page }) => {
    await page.goto("/login");

    const html = page.locator("html");

    // Default: light
    await expect(html).not.toHaveClass(/dark/);

    // Find and click theme toggle if present (may not be on auth pages)
    const toggle = page.getByRole("button", { name: /dark mode|light mode/i });
    if (await toggle.isVisible()) {
      await toggle.click();
      await expect(html).toHaveClass(/dark/);

      await toggle.click();
      await expect(html).not.toHaveClass(/dark/);
    }
  });
});

test.describe("Command palette", () => {
  // Command palette is only in the dashboard shell — skip if not authenticated
  test("opens with Ctrl+K on landing page (palette not present)", async ({ page }) => {
    await page.goto("/");
    // Ctrl+K should not crash the page
    await page.keyboard.press("Control+k");
    // Page should still be functional
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("Cookie banner", () => {
  test("shows cookie banner on first visit", async ({ page }) => {
    // Clear localStorage to simulate first visit
    await page.goto("/");
    await page.evaluate(() => localStorage.removeItem("jobnest_cookie_consent"));
    await page.reload();
    // Banner or its accept button should appear
    const banner = page.getByRole("button", { name: /accept|essential/i });
    await expect(banner.first()).toBeVisible({ timeout: 5000 });
  });

  test("hides banner after accepting", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.removeItem("jobnest_cookie_consent"));
    await page.reload();
    const acceptBtn = page.getByRole("button", { name: /accept all/i });
    if (await acceptBtn.isVisible()) {
      await acceptBtn.click();
      await expect(acceptBtn).not.toBeVisible({ timeout: 3000 });
    }
  });
});

test.describe("Responsive", () => {
  test("navigation is visible on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 }); // iPhone 14
    await page.goto("/");
    // Mobile nav or bottom bar
    const nav = page.locator("nav, [role='navigation']").first();
    await expect(nav).toBeVisible();
  });

  test("pricing page renders on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/pricing");
    await expect(page.getByText(/free/i).first()).toBeVisible();
  });
});
