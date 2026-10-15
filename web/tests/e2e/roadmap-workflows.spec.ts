import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { featureUserId, loginFeatureAccount } from "./helpers/feature-account";

test("saved templates, equity grants and calendar downloads persist through the real application", async ({ page }) => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for isolated fixture cleanup.");
  const userId = await featureUserId();
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } });
  const applicationId = randomUUID(), interviewId = randomUUID();
  const templateName = `E2E draft ${randomUUID()}`;
  let templateId: string | undefined;
  const equity = { total_shares: 101, current_price: 1.25, cliff_months: 12, vest_months: 48, grant_date: "2026-10-15" };
  try {
    expect((await admin.from("job_applications").insert({ id: applicationId, user_id: userId, company: "E2E Vesting", position: "Engineer" })).error).toBeNull();
    expect((await admin.from("interviews").insert({ id: interviewId, application_id: applicationId, user_id: userId, type: "Technical", scheduled_at: "2026-11-01T01:30:00-04:00", duration_minutes: 60, timezone: "America/New_York", location: "E2E office", meeting_url: "https://example.com/interview" })).error).toBeNull();
    await loginFeatureAccount(page);
    const origin = new URL(page.url()).origin;
    const template = await page.request.post("/api/nesta-ai/templates", { headers: { Origin: origin }, data: {
      name: templateName, subject: "Thanks for your time", body: "Hello [Name], thank you for the interview.", category: "Thank You",
    } });
    expect(template.status()).toBe(201);
    templateId = (await template.json()).template.id;
    await page.goto("/templates");
    await page.getByText(templateName, { exact: true }).scrollIntoViewIfNeeded();
    await expect(page.getByText(templateName, { exact: true })).toBeVisible();
    const savedTemplate = await admin.from("email_templates").select("user_id, body, category").eq("id", templateId).single();
    expect(savedTemplate.data).toMatchObject({ user_id: userId, body: "Hello [Name], thank you for the interview.", category: "Thank You" });

    // Saving a grant before any salary record exists must insert it, not silently update zero rows.
    await page.goto(`/applications/${applicationId}`);
    await page.getByRole("button", { name: "Add equity vesting" }).click();
    const dialog = page.getByRole("dialog", { name: "Equity vesting" });
    await dialog.getByLabel("Total shares", { exact: true }).fill("101");
    await dialog.getByLabel("Current share price (USD)", { exact: true }).fill("1.25");
    await dialog.getByLabel("Grant date", { exact: true }).fill(equity.grant_date);
    const saved = page.waitForResponse(response => response.url().endsWith(`/applications/${applicationId}/equity`) && response.request().method() === "PUT");
    await dialog.getByRole("button", { name: "Save equity vesting" }).click();
    expect((await saved).status()).toBe(200);
    await expect(dialog).not.toBeVisible();
    const first = await admin.from("salary_details").select("equity_details").eq("application_id", applicationId).single();
    expect(first.data?.equity_details).toEqual(equity);

    expect((await admin.from("salary_details").update({ base_salary: 100000, bonus: 5000, currency: "CAD" }).eq("application_id", applicationId)).error).toBeNull();
    const update = await page.request.put(`/api/applications/${applicationId}/equity`, { headers: { Origin: origin }, data: { equity_details: { ...equity, total_shares: 202 } } });
    expect(update.status()).toBe(200);
    const salary = await admin.from("salary_details").select("base_salary, bonus, currency, equity_details").eq("application_id", applicationId).single();
    expect(salary.data).toMatchObject({ base_salary: 100000, bonus: 5000, currency: "CAD", equity_details: { total_shares: 202 } });
    await page.goto("/salary");
    const row = page.getByRole("row").filter({ has: page.getByRole("link", { name: "E2E Vesting", exact: true }) });
    await row.getByRole("button", { name: "Edit equity vesting" }).click();
    await expect(page.getByRole("dialog").getByLabel("Total shares", { exact: true })).toHaveValue("202");
    await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();

    const calendar = await page.request.get(`/api/interviews/${interviewId}/calendar`);
    expect(calendar.status()).toBe(200);
    expect(calendar.headers()["content-type"]).toContain("text/calendar");
    const content = await calendar.text();
    expect(content).toContain("DTSTART:20261101T053000Z\r\nDTEND:20261101T063000Z");
    expect(content).toContain("LOCATION:E2E office");
    expect(content).toContain("URL:https://example.com/interview");
    await page.goto(`/applications/${applicationId}`);
    const downloaded = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export calendar (.ics)" }).click();
    expect((await downloaded).suggestedFilename()).toBe(`interview-${interviewId}.ics`);
    const unknown = await page.request.get(`/api/interviews/${randomUUID()}/calendar`);
    expect(unknown.status()).toBe(404);
    const inaccessible = await page.request.put(`/api/applications/${randomUUID()}/equity`, { headers: { Origin: origin }, data: { equity_details: equity } });
    expect(inaccessible.status()).toBe(404);
    const analytics = await page.request.get("/api/nesta-ai/analytics");
    expect(analytics.status()).toBe(200);
    const usage = await analytics.json();
    expect(usage).toHaveProperty("index");
  } finally {
    if (templateId) expect((await admin.from("email_templates").delete().eq("id", templateId).eq("user_id", userId)).error).toBeNull();
    expect((await admin.from("job_applications").delete().eq("id", applicationId).eq("user_id", userId)).error).toBeNull();
  }
});
