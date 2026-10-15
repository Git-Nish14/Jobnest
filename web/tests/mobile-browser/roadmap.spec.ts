import { expect, test, type Page } from "@playwright/test";

const id = "11111111-1111-4111-8111-111111111111";
const analytics = { plan: "pro", cap: { used: 1250, daily: 10_000_000, remaining: 9_998_750 },
  index: { status: "recent", embeddingCount: 42, lastUpdatedAt: "2026-10-15T12:00:00Z" } };
async function fixture(page: Page) {
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/nesta-ai/analytics") return route.fulfill({ json: analytics });
    if (url.pathname.endsWith("/endorsements") && route.request().method() === "GET") return route.fulfill({ json: { skills: [
      { skill_id: id, endorsement_count: 3, endorsed: false },
      { skill_id: "22222222-2222-4222-8222-222222222222", endorsement_count: 0, endorsed: false },
    ] } });
    return route.fulfill({ status: 500, json: { error: "Unexpected fixture request" } });
  });
  await page.goto("/roadmap-fixture");
  await expect(page.getByText("42 indexed items")).toBeVisible();
}

for (const width of [375, 1280]) {
  test.describe(`${width}px feature workflows`, () => {
    test.use({ viewport: { width, height: 900 } });
    test("index count, freshness, refresh failure and recovery", async ({ page }) => {
      await fixture(page);
      await expect(page.getByText("Recently updated")).toBeVisible();
      await page.screenshot({ path: `tests/mobile-browser/artifacts/roadmap-review/tools-${width}.png`, fullPage: true });
      await page.route("**/api/nesta-ai/analytics", route => route.fulfill({ json: { ...analytics, index: { ...analytics.index, status: "stale" } } }));
      await page.getByRole("button", { name: "Refresh AI usage" }).click();
      await expect(page.getByText("Update due")).toBeVisible();
      await page.route("**/api/nesta-ai/analytics", route => route.fulfill({ status: 503, json: {} }));
      await page.getByRole("button", { name: "Refresh AI usage" }).click();
      await expect(page.getByText("Could not refresh usage. Try again.")).toBeVisible();
      await page.route("**/api/nesta-ai/analytics", route => route.fulfill({ json: analytics }));
      await page.getByRole("button", { name: "Refresh AI usage" }).click();
      await expect(page.getByText("42 indexed items")).toBeVisible();
    });
    test("reviews, edits and saves a draft to the template library", async ({ page }) => {
      await fixture(page);
      let body: unknown;
      await page.route("**/api/nesta-ai/templates", route => { body = route.request().postDataJSON(); return route.fulfill({ status: 201, json: { template: { id, name: "Interview thanks" } } }); });
      await page.getByRole("button", { name: "Save response as email template" }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByLabel("Email body")).toHaveValue("Hi [Name], thank you for meeting with me.");
      await dialog.getByLabel("Template name").fill("Interview thanks");
      await dialog.getByLabel("Subject").fill("Thank you for your time");
      await dialog.getByLabel("Category").selectOption("Thank You");
      await dialog.getByLabel("Email body").fill("Hello [Name], I enjoyed our conversation.");
      await dialog.getByRole("button", { name: "Save template", exact: true }).click();
      await expect(dialog.getByRole("link", { name: /template/i })).toHaveAttribute("href", "/templates");
      expect(body).toEqual({ name: "Interview thanks", subject: "Thank you for your time", category: "Thank You", body: "Hello [Name], I enjoyed our conversation." });
    });
    test("keeps a failed draft and supports retry", async ({ page }) => {
      await fixture(page);
      await page.route("**/api/nesta-ai/templates", route => route.fulfill({ status: 500, json: { error: "Please retry saving your template." } }));
      await page.getByRole("button", { name: "Save response as email template" }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Template name").fill("Keep this draft"); await dialog.getByLabel("Subject").fill("Follow up");
      await dialog.getByRole("button", { name: "Save template", exact: true }).click();
      await expect(dialog.getByRole("alert")).toHaveText("Please retry saving your template.");
      await expect(dialog.getByLabel("Template name")).toHaveValue("Keep this draft");
      await page.route("**/api/nesta-ai/templates", route => route.fulfill({ status: 201, json: { template: { id } } }));
      await dialog.getByRole("button", { name: "Save template", exact: true }).click();
      await expect(dialog.getByRole("button", { name: "Done" })).toBeVisible();
    });
    test("endorses once and preserves counts on failure", async ({ page }) => {
      await fixture(page);
      let writes = 0;
      await page.route("**/endorsements", route => {
        if (route.request().method() === "GET") return route.fallback();
        writes++;
        expect(route.request().postDataJSON()).toEqual({ skillId: id });
        return route.fulfill({ json: { skills: [{ skill_id: id, endorsement_count: 4, endorsed: true }] } });
      });
      await page.getByRole("button", { name: "Endorse TypeScript, 3 endorsements", exact: true }).click();
      await expect(page.getByRole("button", { name: "Endorsed TypeScript, 4 endorsements", exact: true })).toBeDisabled();
      expect(writes).toBe(1);
      await page.route("**/endorsements", route => route.fulfill({ status: 429, json: { error: "Daily endorsement limit reached." } }));
      await page.getByRole("button", { name: "Endorse Accessible interface design, 0 endorsements", exact: true }).click();
      await expect(page.getByRole("alert")).toContainText("Daily endorsement limit reached.");
      await expect(page.getByRole("button", { name: "Endorsed TypeScript, 4 endorsements", exact: true })).toBeDisabled();
    });
    test("downloads a calendar attachment", async ({ page }) => {
      await fixture(page);
      await page.route("**/calendar", route => route.fulfill({ contentType: "text/calendar; charset=utf-8", body: "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n" }));
      const download = page.waitForEvent("download");
      await page.getByRole("button", { name: "Export calendar (.ics)" }).click();
      const result = await download;
      expect(result.suggestedFilename()).toBe(`interview-${id}.ics`); expect(await result.failure()).toBeNull();
    });
    test("adds equity, validates cliff, previews fractional shares and saves", async ({ page }) => {
      await fixture(page);
      let body: unknown; let writes = 0;
      await page.route("**/equity", route => { writes++; body = route.request().postDataJSON(); return route.fulfill({ json: body }); });
      await page.getByRole("button", { name: "Add equity vesting" }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Total shares", { exact: true }).fill("101");
      await dialog.getByLabel("Current share price (CAD)", { exact: true }).fill("1.25");
      await dialog.getByLabel("Grant date", { exact: true }).fill("2026-10-15");
      await dialog.getByLabel("Cliff (months)", { exact: true }).fill("49");
      await dialog.getByRole("button", { name: "Save equity vesting" }).click();
      await expect(dialog.getByRole("alert")).toHaveText("The cliff cannot be longer than the vesting period."); expect(writes).toBe(0);
      await dialog.getByLabel("Cliff (months)", { exact: true }).fill("12");
      await expect(dialog.getByRole("cell", { name: "25.25", exact: true })).toHaveCount(4);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: `tests/mobile-browser/artifacts/roadmap-review/equity-${width}.png` });
      await dialog.getByRole("button", { name: "Save equity vesting" }).click();
      await expect(dialog).not.toBeVisible();
      await expect(page.getByRole("button", { name: "Edit equity vesting" })).toBeVisible();
      expect(writes).toBe(1); expect(body).toEqual({ equity_details: { total_shares: 101, current_price: 1.25, grant_date: "2026-10-15", cliff_months: 12, vest_months: 48 } });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
    test("reports failed equity persistence without losing edits", async ({ page }) => {
      await fixture(page);
      await page.route("**/equity", route => route.fulfill({ status: 403, json: { error: "Unable to save this grant." } }));
      await page.getByRole("button", { name: "Add equity vesting" }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Total shares", { exact: true }).fill("10");
      await dialog.getByRole("button", { name: "Save equity vesting" }).click();
      await expect(dialog.getByRole("alert")).toHaveText("Unable to save this grant.");
      await expect(dialog.getByLabel("Total shares", { exact: true })).toHaveValue("10");
    });
  });
}
