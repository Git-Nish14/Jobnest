import { test, expect } from "@playwright/test";
import { fixture } from "./helpers";

for (const width of [375, 1280]) {
  test(`default dialog stays centered at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 812 });
    await fixture(page, "/controls");
    await page.getByRole("button", { name: "Open centered dialog", exact: true }).tap();
    const dialog = page.getByRole("dialog", { name: "Centered dialog fixture", exact: true });
    await expect(dialog).toBeVisible();
    await expect(async () => {
      const bounds = (await dialog.boundingBox())!;
      expect(bounds.x + bounds.width / 2).toBeCloseTo(width / 2, 0);
      expect(bounds.y + bounds.height / 2).toBeCloseTo(406, 0);
    }).toPass({ timeout: 5_000 });
  });
}
