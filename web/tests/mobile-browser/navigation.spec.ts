import { expect, test, type Locator } from "@playwright/test";
import { expectNoOverflow, expectOpaqueNavigation, fixture } from "./helpers";

async function expectUncovered(target: Locator) {
  const bounds = await target.boundingBox();
  expect(bounds).not.toBeNull();
  const center = { x: bounds!.x + bounds!.width / 2, y: bounds!.y + bounds!.height / 2 };
  expect(await target.evaluate((element, point) => element.contains(document.elementFromPoint(point.x, point.y)), center)).toBe(true);
}

for (const viewport of [
  { width: 320, height: 568, top: 0, bottom: 0, side: 0 },
  { width: 375, height: 812, top: 59, bottom: 34, side: 0 },
  { width: 667, height: 375, top: 0, bottom: 21, side: 44 },
  { width: 812, height: 375, top: 0, bottom: 21, side: 44 },
]) {
  for (const theme of ["light", "dark"]) {
    test(`navigation stays readable and tappable at ${viewport.width}px in ${theme} with safe areas`, async ({ page }, testInfo) => {
      await page.setViewportSize(viewport);
      const { errors } = await fixture(page, "/dashboard?navigation-fixture=1");
      // Desktop engines don't expose hardware insets: exercise the CSS contract
      // with notch/home-indicator values, then verify real geometry and taps.
      await page.evaluate(({ theme, viewport }) => {
        const root = document.documentElement;
        root.classList.toggle("dark", theme === "dark");
        root.style.setProperty("--safe-area-top", `${viewport.top}px`);
        root.style.setProperty("--safe-area-bottom", `${viewport.bottom}px`);
        root.style.setProperty("--safe-area-left", `${viewport.side}px`);
        root.style.setProperty("--safe-area-right", `${viewport.side}px`);
      }, { theme, viewport });

      const header = page.getByRole("navigation", { name: "App header" });
      await expect(header).toHaveCSS("backdrop-filter", "none");
      await expect(header).toHaveCSS("background-color", theme === "dark" ? "rgb(0, 0, 0)" : "rgb(250, 249, 247)");
      const menu = page.getByRole("button", { name: "Open menu", exact: true });
      expect((await menu.boundingBox())!.y).toBeGreaterThanOrEqual(viewport.top);
      await expectNoOverflow(page);
      await page.evaluate(() => window.scrollTo(0, 700));
      await expect(header).toHaveJSProperty("offsetHeight", (viewport.width >= 640 ? 64 : 56) + viewport.top + 1);
      await expectUncovered(menu);
      const bell = header.getByRole("button", { name: /Notifications/ });
      await expectUncovered(bell);
      await bell.tap();
      await expect(header.getByText("View all notifications")).toBeVisible();
      await bell.tap();

      const tabs = page.getByRole("navigation", { name: "Primary navigation" });
      if (viewport.width < 768) {
        await expectOpaqueNavigation(page);
        await expect(tabs).toHaveCSS("backdrop-filter", "none");
        const bounds = (await tabs.boundingBox())!;
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height - viewport.bottom);
        await expectUncovered(tabs.getByRole("link", { name: "Applications", exact: true }));
      }

      await page.screenshot({ path: testInfo.outputPath("navigation.png") });
      await menu.tap();
      const close = page.getByRole("button", { name: "Close menu", exact: true });
      await expect(close).toBeVisible();
      expect((await close.boundingBox())!.y).toBeGreaterThanOrEqual(viewport.top);
      await expectUncovered(close);
      await expectUncovered(page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link", { name: "Reminders" }));
      if (viewport.width < 768) await expect(tabs).toHaveCSS("pointer-events", "none");
      await page.screenshot({ path: testInfo.outputPath("navigation-drawer.png") });
      await close.tap();
      await expect(close).toHaveCount(0);
      if (viewport.width < 768) {
        await tabs.getByRole("link", { name: "Applications", exact: true }).tap();
        await expect(page).toHaveURL(/\/applications$/);
      } else {
        await menu.tap();
        await page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link", { name: "Reminders" }).tap();
        await expect(page).toHaveURL(/\/reminders$/);
      }
      expect(errors).toEqual([]);
    });
  }
}

test("landing header clears the status bar and its theme control responds to touch", async ({ page }) => {
  const { errors } = await fixture(page, "/?navigation-fixture=1");
  await page.evaluate(() => document.documentElement.style.setProperty("--safe-area-top", "59px"));
  const header = page.locator("header.landing-header");
  await expect(header).toHaveCSS("backdrop-filter", "none");
  const toggle = header.getByRole("button", { name: "Switch to dark mode" });
  expect((await toggle.boundingBox())!.y).toBeGreaterThanOrEqual(59);
  await expectUncovered(toggle);
  await toggle.tap();
  await expect(header).toHaveCSS("background-color", "rgb(0, 0, 0)");
  expect(errors).toEqual([]);
});
