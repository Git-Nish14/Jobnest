import { test, expect } from "@playwright/test";
import { applications } from "./fixtures";
import { expectNoOverflow, expectOpaqueNavigation, fixture, swipe } from "./helpers";

for (const width of [320, 375, 430, 767]) {
  for (const theme of ["light", "dark"]) {
    test(`edit form fits ${width}px in ${theme} mode, including optional fields and save`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 812 });
      const { errors } = await fixture(page, "/applications/fixture-1/edit");
      await page.evaluate((dark) => document.documentElement.classList.toggle("dark", dark), theme === "dark");
      await expectNoOverflow(page);
      await expectOpaqueNavigation(page);
      await expect(page.getByRole("combobox", { name: "Status", exact: true })).toHaveCount(1);
      await expect(page.getByRole("button", { name: "Save Changes", exact: true })).toHaveCount(1);
      await expect(page.locator("#notes")).toBeHidden();
      await page.screenshot({ path: testInfo.outputPath(`edit-${width}-${theme}.png`), fullPage: true });
      for (const label of ["Tracking & company", "Job details", "Notes & job description", "Application documents"]) {
        await page.getByRole("button", { name: new RegExp(`^${label}`) }).tap();
      }
      await expect(page.locator("#notes")).toHaveValue(applications[0].notes!);
      await expect(page.getByRole("combobox", { name: "Source", exact: true })).toHaveCount(1);
      await expectNoOverflow(page);
      await page.screenshot({ path: testInfo.outputPath(`edit-expanded-${width}-${theme}.png`), fullPage: true });
      const save = page.getByRole("button", { name: "Save Changes", exact: true });
      await save.scrollIntoViewIfNeeded();
      expect(await save.evaluate((button) => {
        const bounds = button.getBoundingClientRect();
        const hit = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
        return hit !== null && button.contains(hit);
      })).toBe(true);
      expect(errors).toEqual([]);
    });
  }
}

test("a swipe from status does not change form values or save, and collapsed fields survive editing", async ({ page }) => {
  const { writes } = await fixture(page, "/applications/fixture-1/edit");
  const status = page.getByRole("combobox", { name: "Status", exact: true });
  await swipe(page, status, -170);
  await expect(status).toHaveValue("Applied");
  expect(writes).toEqual([]);
  expect(await page.evaluate(() => window.__mobileTestWrites)).toEqual([]);
  await status.selectOption("Interview");
  await page.getByRole("button", { name: "Save Changes", exact: true }).tap();
  await expect(page).toHaveURL(/\/applications$/);
  const updates = await page.evaluate(() => window.__mobileTestWrites);
  expect(updates).toHaveLength(1);
  expect(updates[0]).toMatchObject({ table: "job_applications", operation: "update", values: {
    status: "Interview", source: applications[0].source, notes: applications[0].notes,
    job_description: applications[0].job_description, ats_provider: applications[0].ats_provider,
    company_tier: applications[0].company_tier, job_url: applications[0].job_url,
  } });
});

test("landscape edit keeps save reachable after optional fields expand", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 667, height: 375 });
  await fixture(page, "/applications/fixture-1/edit");
  await page.getByRole("button", { name: /^Notes & job description/ }).tap();
  await page.locator("#notes").fill("Landscape edit note");
  await expectNoOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("edit-landscape.png") });
  await page.getByRole("button", { name: "Save Changes", exact: true }).tap();
  await expect(page).toHaveURL(/\/applications$/);
  expect(await page.evaluate(() => window.__mobileTestWrites)).toMatchObject([{ values: { notes: "Landscape edit note" } }]);
});

test.describe("desktop form", () => {
  test.use({ isMobile: false, hasTouch: false, viewport: { width: 1280, height: 900 } });
  test("desktop retains expanded fields and one status/source/save control", async ({ page }, testInfo) => {
    await fixture(page, "/applications/fixture-1/edit");
    await expect(page.getByRole("button", { name: /^Notes & job description/ })).toHaveCount(0);
    await expect(page.locator("#notes")).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Status", exact: true })).toHaveCount(1);
    await expect(page.getByRole("combobox", { name: "Source", exact: true })).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Save Changes", exact: true })).toHaveCount(1);
    await expectNoOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("edit-desktop.png") });
  });
});

test("an invalid field in a collapsed section is exposed and focused on save", async ({ page }) => {
  await fixture(page, "/applications/fixture-1/edit");
  const details = page.getByRole("button", { name: /^Job details/ });
  await details.tap();
  await page.locator("#job_url").fill("this is not a url");
  await details.tap();
  await expect(page.locator("#job_url")).toBeHidden();
  await page.getByRole("button", { name: "Save Changes", exact: true }).tap();
  await expect(details).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#job_url")).toBeFocused();
  await expect(page.locator("#job_url")).toHaveAttribute("aria-invalid", "true");
  expect(await page.evaluate(() => window.__mobileTestWrites)).toEqual([]);
});

test("new application uses one create action and can be saved with only essentials", async ({ page }) => {
  await fixture(page, "/applications/new");
  await expect(page.getByRole("button", { name: "Create Application", exact: true })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Import from job posting", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Autofill this application" }).tap();
  await expect(page.getByRole("button", { name: "Import from job posting", exact: true })).toHaveCount(1);
  await page.locator("#company").fill("Mobile fixture company");
  await page.locator("#position").fill("Mobile fixture engineer");
  await page.getByRole("button", { name: "Create Application", exact: true }).tap();
  await expect(page).toHaveURL(/\/applications$/);
  expect(await page.evaluate(() => window.__mobileTestWrites)).toMatchObject([{
    table: "job_applications", operation: "insert", values: { company: "Mobile fixture company", position: "Mobile fixture engineer", status: "Applied" },
  }]);
});
