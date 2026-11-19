import { expect, test } from "@playwright/test";
import { expectNoOverflow, fixture } from "./helpers";

for (const viewport of [
  { width: 320, height: 568, top: 59, bottom: 34, side: 0 },
  { width: 393, height: 852, top: 59, bottom: 34, side: 0 },
  { width: 430, height: 932, top: 62, bottom: 34, side: 0 },
  { width: 667, height: 375, top: 0, bottom: 21, side: 44 },
]) {
  for (const dark of [false, true]) {
    test(`notifications stay sharp and inside safe areas at ${viewport.width}px (${dark ? "dark" : "light"})`, async ({ page }) => {
      await page.setViewportSize(viewport);
      const { errors } = await fixture(page, "/dashboard?navigation-fixture=1");
      await page.route("**/api/notifications/count", (route) => route.fulfill({ json: {
        overdueReminders: 2, upcomingInterviews: 1, unreadNotifications: 3, total: 6,
      } }));
      await page.reload();
      await page.evaluate(({ dark, viewport }) => {
        const root = document.documentElement;
        root.classList.toggle("dark", dark);
        root.style.setProperty("--safe-area-top", `${viewport.top}px`);
        root.style.setProperty("--safe-area-bottom", `${viewport.bottom}px`);
        root.style.setProperty("--safe-area-left", `${viewport.side}px`);
        root.style.setProperty("--safe-area-right", `${viewport.side}px`);
        window.scrollTo(0, 650);
      }, { dark, viewport });
      const header = page.getByRole("navigation", { name: "App header" });
      await expect(header).toHaveCSS("backdrop-filter", "none");
      await expect(header).toHaveCSS("background-color", dark ? "rgb(0, 0, 0)" : "rgb(250, 249, 247)");
      const bell = header.getByRole("button", { name: /^6 notifications/i });
      await expect(bell).toHaveAccessibleName(/6 notifications/);
      await bell.tap();
      await expect(bell).toHaveAttribute("aria-expanded", "true");
      const panel = page.getByRole("region", { name: "Notifications", exact: true });
      await expect(panel).toBeVisible();
      await expect(panel).toHaveCSS("backdrop-filter", "none");
      expect(await panel.evaluate((element) => getComputedStyle(element).backgroundColor)).toMatch(/^rgb\(/);
      const bounds = (await panel.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(viewport.side);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width - viewport.side);
      expect(bounds.y).toBeGreaterThanOrEqual(viewport.top + (viewport.width >= 640 ? 64 : 56));
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height - viewport.bottom);
      const link = panel.getByRole("link", { name: /View all notifications/ });
      await link.scrollIntoViewIfNeeded();
      expect(await link.evaluate((element) => {
        const box = element.getBoundingClientRect();
        return element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
      })).toBe(true);
      await expectNoOverflow(page);
      await page.keyboard.press("Escape");
      await expect(panel).toHaveCount(0);
      await expect(bell).toHaveAttribute("aria-expanded", "false");
      await header.getByRole("button", { name: "Open menu", exact: true }).tap();
      await expect(page.locator(".nav-overlay-animate")).toHaveCSS("backdrop-filter", "none");
      const dimming = await page.locator(".nav-overlay-animate").evaluate((element) => {
        const context = document.createElement("canvas").getContext("2d")!;
        context.fillStyle = getComputedStyle(element).backgroundColor;
        context.fillRect(0, 0, 1, 1);
        return Array.from(context.getImageData(0, 0, 1, 1).data);
      });
      expect(dimming).toEqual([0, 0, 0, 140]);
      const close = page.getByRole("button", { name: "Close menu", exact: true });
      expect((await close.boundingBox())!.y).toBeGreaterThanOrEqual(viewport.top);
      await close.tap();
      expect(errors).toEqual([]);
    });
  }
}

test("mobile dialogs dim the page without applying a backdrop blur", async ({ page }) => {
  const { errors } = await fixture(page, "/controls");
  await page.getByRole("button", { name: "Open centered dialog" }).tap();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator(".app-overlay")).toHaveCSS("backdrop-filter", "none");
  expect(errors).toEqual([]);
});
