import { expect, test } from "@playwright/test";
import { fixture } from "./helpers";

test("password reset preserves OTP focus across digit updates", async ({ page }) => {
  const { errors } = await fixture(page, "/forgot-password-fixture");
  await page.getByLabel("Email address").fill("user@example.test");
  await page.getByRole("button", { name: /send.*code/i }).click();
  for (let digit = 1; digit <= 5; digit++) {
    const input = page.getByLabel(`Verification code digit ${digit}`);
    await expect(input).toBeFocused();
    await page.keyboard.type(String(digit));
    await expect(input).toHaveValue(String(digit));
  }
  await expect(page.getByLabel("Verification code digit 6")).toBeFocused();
  expect(errors).toEqual([]);
});

test("command search clears obsolete results and ignores a stale response", async ({ page }) => {
  const { errors } = await fixture(page, "/command-palette-fixture");
  let releaseOldResponse: (() => void) | undefined;
  let oldRequestStarted: (() => void) | undefined;
  const started = new Promise<void>((resolve) => { oldRequestStarted = resolve; });
  const released = new Promise<void>((resolve) => { releaseOldResponse = resolve; });
  await page.route("**/api/search?*", async (route) => {
    const query = new URL(route.request().url()).searchParams.get("q");
    if (query === "old") { oldRequestStarted?.(); await released; }
    await route.fulfill({ json: { results: [{ id: query, company: `${query} company`, position: "Engineer", status: "Applied", applied_date: "2026-11-01" }] } }).catch(() => {});
  });
  await page.keyboard.press("Control+k");
  const search = page.getByLabel("Command palette search");
  await search.fill("current");
  await expect(page.getByRole("option", { name: /current company/ })).toBeVisible();
  await search.fill("c");
  await expect(page.getByRole("option", { name: /current company/ })).toHaveCount(0);
  await search.fill("old");
  await started;
  const oldCancelled = page.waitForEvent("requestfailed", {
    predicate: (request) => new URL(request.url()).searchParams.get("q") === "old",
  });
  await search.fill("new");
  await expect(page.getByRole("option", { name: /new company/ })).toBeVisible();
  await oldCancelled;
  releaseOldResponse?.();
  await expect(page.getByRole("option", { name: /old company/ })).toHaveCount(0);
  await expect(page.getByRole("option", { name: /new company/ })).toBeVisible();
  expect(errors).toEqual([]);
});
