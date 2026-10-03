import { test, expect } from "@playwright/test";
import { applications } from "./fixtures";
import { expectNoOverflow, expectOpaqueNavigation, fixture, swipe } from "./helpers";

for (const width of [320, 375, 430, 767]) {
  for (const theme of ["light", "dark"]) {
    test(`applications fit ${width}px in ${theme} mode with one mobile control per task`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 812 });
      const { errors } = await fixture(page, "/applications");
      await page.evaluate((dark) => document.documentElement.classList.toggle("dark", dark), theme === "dark");
      await expectNoOverflow(page);
      await expectOpaqueNavigation(page);
      await expect(page.getByRole("textbox", { name: "Search applications" })).toHaveCount(1);
      await expect(page.getByRole("button", { name: "Filters", exact: true })).toHaveCount(1);
      await expect(page.getByRole("button", { name: /^Change status for/ })).toHaveCount(0);
      await expect(page.getByRole("button", { name: /^Manage / })).toHaveCount(applications.length);
      await expect(page.locator('a[href="/applications/new"]:visible')).toHaveCount(1);
      const headingBounds = await page.getByRole("heading", { name: "Applications", exact: true }).boundingBox();
      const addBounds = await page.getByRole("link", { name: "Add application", exact: true }).boundingBox();
      expect(headingBounds!.x + headingBounds!.width).toBeLessThanOrEqual(addBounds!.x);
      await page.screenshot({ path: testInfo.outputPath(`applications-${width}-${theme}.png`) });
      await page.getByRole("button", { name: "Filters", exact: true }).tap();
      await expect(page.getByRole("dialog", { name: "Filter applications" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Close filters" })).toBeFocused();
      await expectNoOverflow(page);
      await page.screenshot({ path: testInfo.outputPath(`filters-${width}-${theme}.png`) });
      await page.getByRole("button", { name: "Close filters" }).tap();
      await expect(page.getByRole("button", { name: "Filters", exact: true })).toBeFocused();
      await page.getByRole("button", { name: /^Manage / }).first().tap();
      await expect(page.getByRole("combobox", { name: "Application status", exact: true })).toHaveCount(1);
      await expect(page.getByRole("button", { name: "Close application actions" })).toBeFocused();
      await expectNoOverflow(page);
      await page.screenshot({ path: testInfo.outputPath(`manage-${width}-${theme}.png`) });
      expect(errors).toEqual([]);
    });
  }
}

test("swiping a card or Manage cannot mutate status or open a sheet", async ({ page }) => {
  const { writes } = await fixture(page, "/applications");
  const manage = page.getByRole("button", { name: /^Manage / }).first();
  await swipe(page, manage, -160);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(/\/applications$/);
  expect(writes).toEqual([]);
  await swipe(page, page.getByTestId("mobile-application-card").first().getByRole("link"), -120);
  await expect(page).toHaveURL(/\/applications$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(writes).toEqual([]);
  await manage.tap();
  await page.getByRole("combobox", { name: "Application status", exact: true }).selectOption("Interview");
  expect(writes).toEqual([]);
  await page.getByRole("button", { name: "Close application actions" }).tap();
  expect(writes).toEqual([]);
  await manage.tap();
  await expect(page.getByRole("combobox", { name: "Application status", exact: true })).toHaveValue("Applied");
  await page.getByRole("combobox", { name: "Application status", exact: true }).selectOption("Interview");
  await page.getByRole("button", { name: "Save status", exact: true }).tap();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(writes).toEqual([{ url: "/api/applications/fixture-1/status", method: "PATCH", body: JSON.stringify({ status: "Interview" }) }]);
  await expect(page.getByTestId("mobile-application-card").first()).toContainText("Interview");
});

test("filters are drafted in one sheet and only apply on confirmation", async ({ page }) => {
  await fixture(page, "/applications?page=4&search=engineer");
  const filters = page.getByRole("button", { name: "Filters", exact: true });
  await filters.tap();
  const dialog = page.getByRole("dialog", { name: "Filter applications" });
  await dialog.getByRole("combobox", { name: "Status", exact: true }).selectOption("Interview");
  await dialog.getByRole("combobox", { name: "Sort by", exact: true }).selectOption("company_asc");
  await expect(page).toHaveURL(/page=4&search=engineer$/);
  await page.getByRole("button", { name: "Close filters" }).tap();
  await filters.tap();
  await expect(dialog.getByRole("combobox", { name: "Status", exact: true })).toHaveValue("all");
  await dialog.getByRole("combobox", { name: "Status", exact: true }).selectOption("Interview");
  await dialog.getByRole("combobox", { name: "Sort by", exact: true }).selectOption("company_asc");
  await dialog.getByRole("button", { name: "Apply filters" }).tap();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const params = new URL(page.url()).searchParams;
  expect(params.get("page")).toBeNull();
  expect(params.get("search")).toBe("engineer");
  expect(params.get("status")).toBe("Interview");
  expect(params.get("sort")).toBe("company_asc");
  await page.goBack();
  await expect(page).toHaveURL(/page=4&search=engineer$/);
  await page.getByRole("button", { name: "Filters", exact: true }).tap();
  await expect(dialog.getByRole("combobox", { name: "Status", exact: true })).toHaveValue("all");
  await expect(dialog.getByRole("combobox", { name: "Sort by", exact: true })).toHaveValue("date_desc");
});

test("a failed status save keeps the draft open and preserves the saved status", async ({ page }) => {
  await fixture(page, "/applications");
  await page.route("**/api/applications/fixture-1/status", (route) => route.fulfill({
    status: 500, contentType: "application/json", body: JSON.stringify({ error: "Could not save status" }),
  }));
  const manage = page.getByRole("button", { name: /^Manage / }).first();
  await manage.tap();
  const status = page.getByRole("combobox", { name: "Application status", exact: true });
  await status.selectOption("Interview");
  await page.getByRole("button", { name: "Save status", exact: true }).tap();
  await expect(page.getByText("Could not save status", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(status).toHaveValue("Interview");
  await page.getByRole("button", { name: "Close application actions" }).tap();
  await expect(manage).toBeFocused();
  await expect(page.getByTestId("mobile-application-card").first()).toContainText("Applied");
  await manage.tap();
  await expect(status).toHaveValue("Applied");
  await page.unroute("**/api/applications/fixture-1/status");
  await status.selectOption("Interview");
  await page.getByRole("button", { name: "Save status", exact: true }).tap();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("mobile-application-card").first()).toContainText("Interview");
});

test("short landscape sheets keep every action reachable without overflow", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 667, height: 375 });
  await fixture(page, "/applications");
  await page.getByRole("button", { name: "Filters", exact: true }).tap();
  const dialog = page.getByRole("dialog", { name: "Filter applications" });
  await expectNoOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("filters-landscape.png") });
  await dialog.getByRole("combobox", { name: "Status", exact: true }).selectOption("Interview");
  await dialog.getByRole("button", { name: "Apply filters" }).tap();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: /^Manage / }).first().tap();
  await page.getByRole("combobox", { name: "Application status", exact: true }).selectOption("Interview");
  await page.getByRole("button", { name: "Save status", exact: true }).tap();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test.describe("desktop layout", () => {
  test.use({ isMobile: false, hasTouch: false, viewport: { width: 1280, height: 900 } });
  test("desktop retains inline status and search controls", async ({ page }, testInfo) => {
    await fixture(page, "/applications");
    await expectNoOverflow(page);
    await expect(page.getByRole("button", { name: /^Manage / })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Change status for/ })).toHaveCount(applications.length);
    await expect(page.getByRole("textbox", { name: "Search applications" })).toHaveCount(1);
    await expect(page.getByRole("link", { name: "New Application", exact: true })).toHaveCount(1);
    await page.screenshot({ path: testInfo.outputPath("applications-desktop.png") });
  });
});

test("mobile board switches from filters and horizontal card swipes never edit or change status", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 812 });
  const { writes, errors } = await fixture(page, "/applications");
  await page.getByRole("button", { name: "Filters", exact: true }).tap();
  await page.getByRole("combobox", { name: "Display", exact: true }).selectOption("kanban");
  await page.getByRole("button", { name: "Apply filters" }).tap();
  await expect(page).toHaveURL(/view=kanban$/);
  await expect(page.getByRole("button", { name: /^Change status for/ })).toHaveCount(0);
  await expectNoOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("board-320-light.png") });
  const board = page.locator(".overflow-x-auto:visible");
  const card = page.locator('[draggable="true"]').first();
  await swipe(page, card, -110, "x");
  await expect.poll(() => board.evaluate((element) => element.scrollLeft)).toBeGreaterThan(25);
  await expect(page).toHaveURL(/view=kanban$/);
  expect(writes).toEqual([]);
  await board.evaluate((element) => { element.scrollLeft = 0; });
  const edit = card.getByRole("link", { name: "Edit application", exact: true });
  await swipe(page, edit, -65, "x");
  await expect(page).toHaveURL(/view=kanban$/);
  expect(writes).toEqual([]);
  await board.evaluate((element) => { element.scrollLeft = 0; });
  await edit.tap();
  await expect(page).toHaveURL(/\/applications\/fixture-1\/edit$/);
  await expect(page.getByRole("button", { name: "Save Changes", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("debounced search resets pagination and browser Back restores the previous query", async ({ page }) => {
  await fixture(page, "/applications?page=4");
  const search = page.getByRole("textbox", { name: "Search applications", exact: true });
  await search.fill("engineer");
  await expect(page).toHaveURL(/\/applications\?search=engineer$/);
  await search.fill("northstar");
  await expect(page).toHaveURL(/\/applications\?search=northstar$/);
  await page.goBack();
  await expect(search).toHaveValue("engineer");
  await page.waitForTimeout(450);
  await expect(page).toHaveURL(/\/applications\?search=engineer$/);
});

test("mobile sheets close when the viewport crosses into the desktop layout", async ({ page }) => {
  await fixture(page, "/applications");
  await page.getByRole("button", { name: "Filters", exact: true }).tap();
  await expect(page.getByRole("dialog", { name: "Filter applications" })).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Search applications", exact: true })).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole("button", { name: /^Manage / }).first().tap();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Change status for/ }).first()).toBeVisible();
});
