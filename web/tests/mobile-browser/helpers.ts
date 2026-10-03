import { expect, type CDPSession, type Locator, type Page } from "@playwright/test";

export async function fixture(page: Page, path: string) {
  const writes: Array<{ url: string; method: string; body: string | null }> = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/")) {
      writes.push({ url: url.pathname, method: request.method(), body: request.postData() });
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
    } else if (url.hostname !== "127.0.0.1") {
      await route.abort();
    } else {
      await route.continue();
    }
  });
  await page.goto(path);
  await expect(page.locator("#root")).not.toBeEmpty();
  return { writes, errors };
}

export async function point(locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  const bounds = await locator.boundingBox();
  if (!bounds) throw new Error("Touch target has no rendered bounds");
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}

export async function beginTouch(cdp: CDPSession, at: { x: number; y: number }) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...at, id: 1 }] });
}

export async function endTouch(cdp: CDPSession) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

export async function swipe(page: Page, locator: Locator, distance = -180, axis: "x" | "y" = "y") {
  const cdp = await page.context().newCDPSession(page);
  const start = await point(locator);
  await beginTouch(cdp, start);
  for (let step = 1; step <= 12; step += 1) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{
        x: start.x + (axis === "x" ? distance * step / 12 : 0),
        y: start.y + (axis === "y" ? distance * step / 12 : 0),
        id: 1,
      }],
    });
    await page.waitForTimeout(16);
  }
  await endTouch(cdp);
  await cdp.detach();
}

export async function expectNoOverflow(page: Page) {
  expect(await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))).toEqual({ width: page.viewportSize()!.width, scrollWidth: page.viewportSize()!.width });
}

export async function expectOpaqueNavigation(page: Page) {
  const alpha = await page.getByRole("navigation", { name: "Primary navigation" }).evaluate((navigation) => {
    const color = getComputedStyle(navigation).backgroundColor;
    if (color === "transparent") return 0;
    if (color.startsWith("rgba(")) return Number(color.split(",").at(-1)?.replace(")", ""));
    if (color.includes("/")) return Number(color.split("/").at(-1)?.replace(")", ""));
    return 1;
  });
  expect(alpha, "Navigation needs an opaque backing when backdrop blur is unavailable").toBe(1);
}
