/**
 * E2E — "Fill from JSON" application import feature
 *
 * Public/unauthenticated tests verify the redirect behaviour (gate still works).
 * Authenticated tests exercise the full flow:
 *   1. Open /applications/new
 *   2. Click "Fill from JSON"
 *   3. Verify the AI prompt tab shows a copyable prompt
 *   4. Switch to "Paste JSON", paste a valid payload, click "Import"
 *   5. Assert each form field is auto-filled correctly
 *   6. Verify a success toast appears
 *   7. Repeat with a payload containing edge-case values (bad URL, unknown enum)
 *      and assert the warning panel is shown with the modal staying open.
 *
 * Set E2E_TEST_EMAIL / E2E_TEST_PASSWORD in your environment to enable the
 * authenticated suite. Without them the authenticated tests are skipped
 * automatically — CI without credentials still passes.
 */
import { test, expect, type Page } from "@playwright/test";

const E2E_EMAIL    = process.env.E2E_TEST_EMAIL;
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;
const TODAY        = new Date().toISOString().split("T")[0];

// ── Helper: log in and navigate ───────────────────────────────────────────────

async function logIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(E2E_EMAIL!);
  await page.getByRole("button", { name: /continue|next/i }).click();
  await page.waitForTimeout(500);
  if (await page.getByLabel(/password/i).isVisible()) {
    await page.getByLabel(/password/i).fill(E2E_PASSWORD!);
    await page.getByRole("button", { name: /sign in|continue/i }).click();
  }
  await expect(page).toHaveURL(/\/dashboard|\/onboarding/, { timeout: 15000 });
}

// ── Valid full payload ────────────────────────────────────────────────────────

const VALID_PAYLOAD = JSON.stringify({
  company:              "Anthropic",
  position:             "Senior Software Engineer",
  applied_date:         TODAY,
  job_id:               "REQ-2026-001",
  job_url:              "https://anthropic.com/jobs/2026-001",
  salary_range:         "$200k–$280k",
  location:             "Remote",
  source:               "LinkedIn",
  ats_provider:         "Greenhouse",
  requires_sponsorship: false,
  company_tier:         "Tier 1",
  notes:                "Strong fit: AI safety background matches JD priorities.",
  job_description:      "Help build safe and beneficial AI systems.",
});

// Payload that exercises the warning path: bad URL + unknown enum
const PARTIAL_PAYLOAD = JSON.stringify({
  company:    "Acme Corp",
  position:   "Backend Engineer",
  job_url:    "not-a-valid-url",
  source:     "UnknownBoard",
  location:   "Austin, TX",
});

// ── Unauthenticated tests (always run) ───────────────────────────────────────

test.describe("JSON import — unauthenticated", () => {
  test("redirects /applications/new to login for unauthenticated users", async ({ page }) => {
    await page.goto("/applications/new");
    await expect(page).toHaveURL(/\/login/);
  });
});

// ── Authenticated tests ───────────────────────────────────────────────────────

test.describe("JSON import — authenticated", () => {
  test.skip(!E2E_EMAIL || !E2E_PASSWORD, "Skipped: E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set");

  test.beforeEach(async ({ page }) => {
    await logIn(page);
    await page.goto("/applications/new");
    await expect(page.getByRole("heading", { name: /new application/i })).toBeVisible({ timeout: 10000 });
  });

  // ── Button presence ─────────────────────────────────────────────────────────

  test("shows all three import buttons in the header", async ({ page }) => {
    await expect(page.getByRole("button", { name: /import from job posting/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /fill from resume/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /fill from json/i })).toBeVisible();
  });

  // ── Modal open / close ──────────────────────────────────────────────────────

  test("clicking Fill from JSON opens the modal", async ({ page }) => {
    await page.getByRole("button", { name: /fill from json/i }).click();
    await expect(page.getByText("Fill from JSON").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /1\. get ai prompt/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /2\. paste json/i })).toBeVisible();
  });

  test("pressing Escape via backdrop click closes the modal", async ({ page }) => {
    await page.getByRole("button", { name: /fill from json/i }).click();
    // Click the backdrop (outside the modal card)
    await page.mouse.click(10, 10);
    await expect(page.getByText("1. Get AI prompt")).not.toBeVisible({ timeout: 3000 });
  });

  // ── AI prompt tab ───────────────────────────────────────────────────────────

  test("AI prompt tab shows today's date in the template", async ({ page }) => {
    await page.getByRole("button", { name: /fill from json/i }).click();
    const pre = page.locator("pre");
    await expect(pre).toContainText(TODAY);
  });

  test("AI prompt tab shows field reference with enum options", async ({ page }) => {
    await page.getByRole("button", { name: /fill from json/i }).click();
    const pre = page.locator("pre");
    await expect(pre).toContainText("LinkedIn");
    await expect(pre).toContainText("Greenhouse");
    await expect(pre).toContainText("FAANG");
  });

  test("Copy prompt button is visible on AI prompt tab", async ({ page }) => {
    await page.getByRole("button", { name: /fill from json/i }).click();
    await expect(page.getByRole("button", { name: /copy prompt/i })).toBeVisible();
  });

  // ── Happy path: full valid payload ──────────────────────────────────────────

  test("imports all fields from a valid JSON payload", async ({ page }) => {
    await page.getByRole("button", { name: /fill from json/i }).click();

    // Switch to Paste JSON tab
    await page.getByRole("button", { name: /2\. paste json/i }).click();
    await page.locator("textarea").fill(VALID_PAYLOAD);
    await page.getByRole("button", { name: /import fields/i }).click();

    // Modal closes on clean import
    await expect(page.getByText("Import fields")).not.toBeVisible({ timeout: 3000 });

    // Form fields are populated
    await expect(page.locator("#company")).toHaveValue("Anthropic");
    await expect(page.locator("#position")).toHaveValue("Senior Software Engineer");
    await expect(page.locator("#applied_date")).toHaveValue(TODAY);
    await expect(page.locator("#job_id")).toHaveValue("REQ-2026-001");
    await expect(page.locator("#job_url")).toHaveValue("https://anthropic.com/jobs/2026-001");
    await expect(page.locator("#salary_range")).toHaveValue("$200k–$280k");
    await expect(page.locator("#location")).toHaveValue("Remote");

    // Toast should show the field count
    await expect(page.getByText(/fields imported/i)).toBeVisible({ timeout: 5000 });
  });

  // ── Warning path: partial / invalid payload ─────────────────────────────────

  test("keeps modal open and shows warnings for a partially invalid payload", async ({ page }) => {
    await page.getByRole("button", { name: /fill from json/i }).click();
    await page.getByRole("button", { name: /2\. paste json/i }).click();
    await page.locator("textarea").fill(PARTIAL_PAYLOAD);
    await page.getByRole("button", { name: /import fields/i }).click();

    // Modal stays open (warnings shown)
    const warningPanel = page.locator("text=Fields applied").or(page.locator("text=skipped"));
    await expect(warningPanel).toBeVisible({ timeout: 3000 });

    // Job URL and Source should be listed as skipped
    await expect(page.getByText(/job url/i)).toBeVisible();
    await expect(page.getByText(/source/i)).toBeVisible();

    // Valid fields still applied to form (modal stays open, but form values updated)
    await expect(page.locator("#company")).toHaveValue("Acme Corp");
    await expect(page.locator("#location")).toHaveValue("Austin, TX");

    // Dismiss via Close button
    await page.getByRole("button", { name: /close/i }).click();
    await expect(warningPanel).not.toBeVisible({ timeout: 3000 });
  });

  // ── Error path: invalid JSON ────────────────────────────────────────────────

  test("shows error and keeps modal open for malformed JSON", async ({ page }) => {
    await page.getByRole("button", { name: /fill from json/i }).click();
    await page.getByRole("button", { name: /2\. paste json/i }).click();
    await page.locator("textarea").fill("{this is not valid json}");
    await page.getByRole("button", { name: /import fields/i }).click();

    // Error message should appear in the modal
    await expect(page.getByText(/invalid json/i)).toBeVisible({ timeout: 3000 });

    // Modal stays open
    await expect(page.locator("textarea")).toBeVisible();
  });

  // ── Markdown fence stripping ────────────────────────────────────────────────

  test("strips markdown code fences from AI output before parsing", async ({ page }) => {
    const wrapped = "```json\n" + VALID_PAYLOAD + "\n```";

    await page.getByRole("button", { name: /fill from json/i }).click();
    await page.getByRole("button", { name: /2\. paste json/i }).click();
    await page.locator("textarea").fill(wrapped);
    await page.getByRole("button", { name: /import fields/i }).click();

    await expect(page.locator("#company")).toHaveValue("Anthropic", { timeout: 5000 });
  });

  // ── Import button disabled state ────────────────────────────────────────────

  test("Import button is disabled while the textarea is empty", async ({ page }) => {
    await page.getByRole("button", { name: /fill from json/i }).click();
    await page.getByRole("button", { name: /2\. paste json/i }).click();
    await expect(page.getByRole("button", { name: /import fields/i })).toBeDisabled();
  });
});
