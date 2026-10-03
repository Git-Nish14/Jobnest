import { test, expect } from "@playwright/test";
import { beginTouch, endTouch, fixture, point, swipe } from "./helpers";

test("a status dropdown opens only after a deliberate released tap", async ({ page }) => {
  const { errors } = await fixture(page, "/controls");
  const trigger = page.getByRole("button", { name: /Change status for/ });
  const cdp = await page.context().newCDPSession(page);
  await beginTouch(cdp, await point(trigger));
  await expect(page.getByRole("menu")).toHaveCount(0);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
  await swipe(page, trigger, -150);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(40);
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(page.getByTestId("changes")).toHaveText("0");
  await trigger.tap();
  await expect(page.getByRole("menu")).toBeVisible();
  await page.getByRole("menuitem", { name: /Interview Interviewing now/ }).tap();
  await expect(page.getByTestId("changes")).toHaveText("1");
  await expect(trigger).toContainText("Interview");
  expect(errors).toEqual([]);
});

test("scrolling an open action menu cannot execute an action", async ({ page }) => {
  await fixture(page, "/controls");
  const trigger = page.getByRole("button", { name: "Uncontrolled actions", exact: true });
  await trigger.tap();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  await swipe(page, page.getByRole("menuitem", { name: "Action 4", exact: true }), -95);
  await expect(menu).toBeVisible();
  await expect(page.getByTestId("changes")).toHaveText("0");
  await expect.poll(() => menu.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await page.getByRole("menuitem", { name: "Action 8", exact: true }).tap();
  await expect(page.getByTestId("changes")).toHaveText("1");
  await expect(page.getByTestId("pointer-downs")).toHaveText("1");
});

test("controlled and slotted dropdown triggers preserve tap behavior and refs", async ({ page }) => {
  await fixture(page, "/controls");
  const controlled = page.getByRole("button", { name: "Controlled actions", exact: true });
  const cdp = await page.context().newCDPSession(page);
  await beginTouch(cdp, await point(controlled));
  await expect(page.getByRole("menu")).toHaveCount(0);
  await endTouch(cdp);
  await expect(page.getByRole("menu")).toBeVisible();
  await page.getByRole("menuitem", { name: "Controlled action", exact: true }).tap();
  await expect(page.getByTestId("changes")).toHaveText("1");
  await page.getByRole("button", { name: "Focus action trigger" }).tap();
  await expect(page.getByRole("button", { name: "Uncontrolled actions", exact: true })).toBeFocused();
});

test("a select allows scrolling from its trigger and inside its option list", async ({ page }) => {
  await fixture(page, "/controls");
  const select = page.getByRole("combobox", { name: "Fixture select" });
  await swipe(page, select);
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(page.getByTestId("changes")).toHaveText("0");
  await select.tap();
  const listbox = page.getByRole("listbox");
  await expect(listbox).toBeVisible();
  await swipe(page, page.getByRole("option", { name: "Option 4", exact: true }), -75);
  await expect(page.getByTestId("changes")).toHaveText("0");
  await expect(listbox).toBeVisible();
  await page.getByRole("option", { name: "Option 8", exact: true }).tap();
  await expect(page.getByTestId("changes")).toHaveText("1");
  await expect(select).toContainText("Option 8");
});

test.describe("desktop inputs", () => {
  test.use({ isMobile: false, hasTouch: false, viewport: { width: 1280, height: 900 } });

  test("mouse press still opens a dropdown and keyboard still selects", async ({ page }) => {
    await fixture(page, "/controls");
    const trigger = page.getByRole("button", { name: "Uncontrolled actions", exact: true });
    const at = await point(trigger);
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    await expect(page.getByRole("menu")).toBeVisible();
    await page.mouse.up();
    await page.keyboard.press("Escape");
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menu")).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("changes")).toHaveText("1");
    await trigger.focus();
    await page.keyboard.press("Space");
    await expect(page.getByRole("menu")).toBeVisible();
    await page.keyboard.press("Escape");
    await trigger.focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menu")).toBeVisible();
  });
});
