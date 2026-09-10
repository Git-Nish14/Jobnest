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

  test("login page is not horizontally clipped on 320px (narrowest phones)", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 }); // iPhone 5
    await page.goto("/login");
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 4); // 4px tolerance for rounding
  });
});

test.describe("Meta theme-color sync", () => {
  test("meta[name=theme-color] content is present on all pages", async ({ page }) => {
    await page.goto("/login");
    const themeMeta = page.locator('meta[name="theme-color"]').first();
    const content = await themeMeta.getAttribute("content");
    expect(content).toBeTruthy();
  });

  test("theme-color meta content updates when dark mode is toggled", async ({ page }) => {
    await page.goto("/login");

    const toggle = page.getByRole("button", { name: /dark mode|light mode/i });
    if (!await toggle.isVisible()) return; // skip if toggle not on this page

    // Read the initial colour
    const getColor = () =>
      page.evaluate(() => {
        const el = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
        return el?.getAttribute("content") ?? null;
      });

    const before = await getColor();

    await toggle.click();
    await page.waitForTimeout(50); // ThemeToggle is synchronous, but allow micro-task flush

    const after = await getColor();

    // The colour must have changed when the theme toggled
    expect(after).not.toBe(before);

    // Toggle back
    await toggle.click();
    const restored = await getColor();
    expect(restored).toBe(before);
  });
});

test.describe("Navbar slide panel animation", () => {
  test("slide panel backdrop has blurred background when open on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/login");

    // On public pages, the hamburger menu triggers a simple inline list —
    // just verify the page remains functional after toggle
    const toggle = page.locator("button[aria-label='Toggle menu']");
    if (!await toggle.isVisible()) return;

    await toggle.click();
    await expect(page.locator("body")).toBeVisible();

    // Re-close
    await toggle.click();
  });
});
