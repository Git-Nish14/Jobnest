import { expect, test } from "@playwright/test";
import { expectNoOverflow, fixture } from "./helpers";

const skeletons = [
  "DashboardSkeleton", "ApplicationsSkeleton", "ApplicationDetailSkeleton", "ApplicationFormSkeleton",
  "NestAiSkeleton", "DocumentsSkeleton", "ATSSkeleton", "SalarySkeleton", "PrepSkeleton",
  "NotificationsSkeleton", "ProfileSkeleton", "ContactsSkeleton", "InterviewsSkeleton",
  "RemindersSkeleton", "TemplatesSkeleton", "NetworkingSkeleton", "PortfolioSkeleton", "CenteredFormSkeleton",
];

for (const width of [320, 375, 767, 1280]) {
  for (const theme of ["light", "dark"]) {
    test(`page loaders fit ${width}px in ${theme} mode with reduced motion`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width, height: 900 });
      for (const component of skeletons) {
        await page.unroute("**/*");
        page.removeAllListeners("pageerror");
        const { errors } = await fixture(page, `/skeleton-fixture?component=${component}`);
        await page.evaluate((dark) => document.documentElement.classList.toggle("dark", dark), theme === "dark");
        const status = page.getByRole("status");
        await expect(status).toHaveCount(1);
        await expect(status).toContainText("Loading");
        await expectNoOverflow(page);
        const animations = await status.evaluate((root) => [root, ...root.querySelectorAll("*")]
          .filter((element) => getComputedStyle(element).animationName !== "none").length);
        expect(animations, `${component} must respect reduced motion`).toBe(0);
        expect(errors, component).toEqual([]);
      }
    });
  }
}

test("dashboard loader selects the mobile layout below the desktop breakpoint", async ({ page }) => {
  await fixture(page, "/skeleton-fixture?component=DashboardSkeleton");
  await expect(page.locator(".mobile-dashboard")).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator(".mobile-dashboard")).toBeHidden();
});
