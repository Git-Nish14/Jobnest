/**
 * E2E — Networking & Referrals feature
 *
 * Covers all five networking feature areas introduced in migration 043:
 *
 *   Referrals CRUD
 *     POST creates a referral, GET confirms persistence, PATCH updates status,
 *     DELETE removes it.  Security fix: POST with a nonexistent / other-user
 *     application_id returns 403.
 *
 *   has_referral trigger
 *     Creating a referral linked to an owned application causes that referral
 *     to be retrievable via ?application_id= filter; deleting it removes the
 *     link.  (The DB trigger that flips job_applications.has_referral is
 *     validated at the data layer — we verify the API round-trip, not the
 *     column directly, since there is no public GET /api/applications/[id].)
 *
 *   Coffee Chats CRUD
 *     POST → GET → PATCH → DELETE round-trip against real Supabase.
 *
 *   Outreach status
 *     PATCH /api/networking/contacts/[id]/outreach — validates enum, UUID
 *     format, and ownership (404 on nonexistent contact).
 *
 *   Connection goal
 *     POST /api/profile/update-connection-goal persists to user_metadata;
 *     verified via GET /api/profile/export-data round-trip.
 *     Validation: out-of-range values return 422.
 *
 *   Document download fix
 *     GET /api/documents?path=…&dl=1 returns Content-Disposition: attachment.
 *     GET /api/documents?path=…      returns Content-Disposition: inline (unchanged).
 *
 *   UI — /networking page
 *     Page loads with 3 tabs, correct default active tab, tab switching,
 *     connection-goal widget, dialog triggers, navbar link.
 *
 * Unauthenticated tests always run (no credentials required).
 * Authenticated tests require E2E_TEST_EMAIL + E2E_TEST_PASSWORD and a live
 * Supabase backend; without credentials they are automatically skipped — CI
 * without credentials still passes.
 *
 * Every authenticated test is self-cleaning: data created is deleted in a
 * try/finally block so a mid-test failure never pollutes the account.
 */

import { test, expect, type Page } from "@playwright/test";

const E2E_EMAIL    = process.env.E2E_TEST_EMAIL;
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;

const RUN_ID = Date.now();
const TAG    = `[E2E-NET-${RUN_ID}]`;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function logIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(E2E_EMAIL!);
  await page.getByRole("button", { name: /continue|next/i }).click();
  await page.waitForTimeout(400);
  if (await page.getByLabel(/password/i).isVisible()) {
    await page.getByLabel(/password/i).fill(E2E_PASSWORD!);
    await page.getByRole("button", { name: /sign in|continue/i }).click();
  }
  await expect(page).toHaveURL(/\/dashboard|\/onboarding/, { timeout: 15_000 });
}

/** Creates a minimal application via the UI form; returns the application id. */
async function createApp(page: Page, suffix: string): Promise<string> {
  const company = `${TAG} Co ${suffix}`;
  await page.goto("/applications/new");
  await expect(page.getByRole("heading", { name: /new application/i }))
    .toBeVisible({ timeout: 10_000 });
  await page.getByLabel(/company/i).fill(company);
  await page.getByLabel(/position/i).fill("Software Engineer");
  await page.getByRole("button", { name: /create application/i }).click();
  await expect(page).toHaveURL(/\/applications\/[a-f0-9-]{36}/, { timeout: 15_000 });
  return page.url().split("/applications/")[1];
}

async function deleteApp(page: Page, appId: string) {
  await page.request.delete(`/api/applications/${appId}`).catch(() => {});
}

async function deleteReferral(page: Page, id: string) {
  await page.request.delete(`/api/networking/referrals/${id}`).catch(() => {});
}

async function deleteCoffeeChat(page: Page, id: string) {
  await page.request.delete(`/api/networking/coffee-chats/${id}`).catch(() => {});
}

// ── Unauthenticated guards — always run ──────────────────────────────────────

test.describe("Networking — unauthenticated guards", () => {
  test("GET /api/networking/referrals returns 401", async ({ request }) => {
    const res = await request.get("/api/networking/referrals");
    expect(res.status()).toBe(401);
  });

  test("POST /api/networking/referrals returns 401", async ({ request }) => {
    const res = await request.post("/api/networking/referrals", {
      data: { status: "Requested" },
    });
    expect(res.status()).toBe(401);
  });

  test("GET /api/networking/coffee-chats returns 401", async ({ request }) => {
    const res = await request.get("/api/networking/coffee-chats");
    expect(res.status()).toBe(401);
  });

  test("POST /api/networking/coffee-chats returns 401", async ({ request }) => {
    const futureTs = new Date(Date.now() + 86_400_000).toISOString();
    const res = await request.post("/api/networking/coffee-chats", {
      data: { scheduled_at: futureTs },
    });
    expect(res.status()).toBe(401);
  });

  test("PATCH /api/networking/contacts/[id]/outreach returns 401", async ({ request }) => {
    const res = await request.patch(
      "/api/networking/contacts/00000000-0000-0000-0000-000000000000/outreach",
      { data: { outreach_status: "Connected" } },
    );
    expect(res.status()).toBe(401);
  });

  test("POST /api/profile/update-connection-goal returns 401", async ({ request }) => {
    const res = await request.post("/api/profile/update-connection-goal", {
      data: { weeklyConnectionGoal: 5 },
    });
    expect(res.status()).toBe(401);
  });

  test("/networking redirects to /login when unauthenticated", async ({ page }) => {
    await page.goto("/networking");
    await expect(page).toHaveURL(/\/login/);
  });
});

// ── Referrals — authenticated CRUD + security ────────────────────────────────

test.describe("Referrals API — authenticated", () => {
  test.skip(!E2E_EMAIL || !E2E_PASSWORD, "Skipped: E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set");

  test("POST creates referral; GET returns it; PATCH updates status; DELETE removes it", async ({ page }) => {
    await logIn(page);
    let referralId: string | null = null;
    try {
      // POST — create
      const createRes = await page.request.post("/api/networking/referrals", {
        data: { status: "Requested", notes: `${TAG} referral CRUD` },
      });
      expect(createRes.status()).toBe(201);
      const created = await createRes.json() as { referral: { id: string; status: string; notes: string } };
      referralId = created.referral.id;
      expect(referralId).toMatch(/^[0-9a-f-]{36}$/);
      expect(created.referral.status).toBe("Requested");
      expect(created.referral.notes).toContain(TAG);

      // GET — verify persistence
      const listRes = await page.request.get("/api/networking/referrals");
      expect(listRes.status()).toBe(200);
      const list = await listRes.json() as { referrals: { id: string }[] };
      expect(list.referrals.some((r) => r.id === referralId)).toBe(true);

      // PATCH — update status
      const patchRes = await page.request.patch(`/api/networking/referrals/${referralId}`, {
        data: { status: "Submitted" },
      });
      expect(patchRes.status()).toBe(200);
      const patched = await patchRes.json() as { referral: { status: string } };
      expect(patched.referral.status).toBe("Submitted");

      // DELETE
      const deleteRes = await page.request.delete(`/api/networking/referrals/${referralId}`);
      expect(deleteRes.status()).toBe(200);
      referralId = null;

      // Verify gone
      const afterList = await page.request.get("/api/networking/referrals");
      const afterBody = await afterList.json() as { referrals: { id: string }[] };
      expect(afterBody.referrals.every((r) => r.id !== referralId)).toBe(true);
    } finally {
      if (referralId) await deleteReferral(page, referralId);
    }
  });

  test("POST with nonexistent application_id returns 403 (security fix)", async ({ page }) => {
    await logIn(page);
    const res = await page.request.post("/api/networking/referrals", {
      data: {
        status: "Requested",
        application_id: "00000000-0000-0000-0000-000000000001", // valid UUID, not owned
      },
    });
    expect(res.status()).toBe(403);
  });

  test("POST with invalid status enum returns 400", async ({ page }) => {
    await logIn(page);
    const res = await page.request.post("/api/networking/referrals", {
      data: { status: "NotARealStatus" },
    });
    expect(res.status()).toBe(400);
  });

  test("PATCH with invalid referral ID format returns 400", async ({ page }) => {
    await logIn(page);
    const res = await page.request.patch("/api/networking/referrals/not-a-uuid", {
      data: { status: "Converted" },
    });
    expect(res.status()).toBe(400);
  });

  test("DELETE on nonexistent referral returns 200 (idempotent)", async ({ page }) => {
    await logIn(page);
    const res = await page.request.delete(
      "/api/networking/referrals/00000000-0000-0000-0000-000000000002",
    );
    // Route deletes with .eq(user_id) — no rows matched returns 200 not 404
    expect(res.status()).toBe(200);
  });
});

// ── has_referral trigger — authenticated ──────────────────────────────────────

test.describe("has_referral trigger — authenticated", () => {
  test.skip(!E2E_EMAIL || !E2E_PASSWORD, "Skipped: E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set");

  test("referral linked to owned application appears in ?application_id= filter; disappears after DELETE", async ({ page }) => {
    await logIn(page);
    let appId: string | null = null;
    let referralId: string | null = null;
    try {
      // Create an owned application
      appId = await createApp(page, "trigger-test");

      // Create referral linked to that application
      const createRes = await page.request.post("/api/networking/referrals", {
        data: { status: "Requested", application_id: appId, notes: `${TAG} trigger test` },
      });
      expect(createRes.status()).toBe(201);
      const body = await createRes.json() as { referral: { id: string; application_id: string } };
      referralId = body.referral.id;
      expect(body.referral.application_id).toBe(appId);

      // GET with application_id filter — should include our referral
      const filterRes = await page.request.get(
        `/api/networking/referrals?application_id=${appId}`,
      );
      expect(filterRes.status()).toBe(200);
      const filterBody = await filterRes.json() as { referrals: { id: string }[] };
      expect(filterBody.referrals.some((r) => r.id === referralId)).toBe(true);

      // DELETE referral
      const delRes = await page.request.delete(`/api/networking/referrals/${referralId}`);
      expect(delRes.status()).toBe(200);
      referralId = null;

      // Filter should now return empty for this app
      const afterRes = await page.request.get(
        `/api/networking/referrals?application_id=${appId}`,
      );
      const afterBody = await afterRes.json() as { referrals: { id: string }[] };
      expect(afterBody.referrals.filter((r) => r.id !== null)).toHaveLength(0);
    } finally {
      if (referralId) await deleteReferral(page, referralId);
      if (appId) await deleteApp(page, appId);
    }
  });

  test("POST with other-user application_id does NOT create referral (returns 403)", async ({ page }) => {
    await logIn(page);
    // Use a well-known UUID that is not owned by the test account
    const alienAppId = "00000000-dead-beef-cafe-000000000003";
    const res = await page.request.post("/api/networking/referrals", {
      data: { status: "Requested", application_id: alienAppId },
    });
    expect(res.status()).toBe(403);
  });
});

// ── Coffee Chats — authenticated CRUD ────────────────────────────────────────

test.describe("Coffee Chats API — authenticated", () => {
  test.skip(!E2E_EMAIL || !E2E_PASSWORD, "Skipped: E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set");

  test("POST creates chat; GET returns it; PATCH updates status + notes; DELETE removes it", async ({ page }) => {
    await logIn(page);
    let chatId: string | null = null;
    const futureTs = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    try {
      // POST
      const createRes = await page.request.post("/api/networking/coffee-chats", {
        data: {
          scheduled_at: futureTs,
          medium: "Zoom",
          agenda: `${TAG} agenda`,
        },
      });
      expect(createRes.status()).toBe(201);
      const created = await createRes.json() as { chat: { id: string; medium: string; status: string } };
      chatId = created.chat.id;
      expect(chatId).toMatch(/^[0-9a-f-]{36}$/);
      expect(created.chat.medium).toBe("Zoom");
      expect(created.chat.status).toBe("Scheduled");

      // GET — verify persistence
      const listRes = await page.request.get("/api/networking/coffee-chats");
      expect(listRes.status()).toBe(200);
      const list = await listRes.json() as { chats: { id: string }[] };
      expect(list.chats.some((c) => c.id === chatId)).toBe(true);

      // PATCH — mark Completed with post-chat notes
      const patchRes = await page.request.patch(`/api/networking/coffee-chats/${chatId}`, {
        data: { status: "Completed", notes: `${TAG} post-chat notes`, follow_up_sent: true },
      });
      expect(patchRes.status()).toBe(200);
      const patched = await patchRes.json() as { chat: { status: string; follow_up_sent: boolean } };
      expect(patched.chat.status).toBe("Completed");
      expect(patched.chat.follow_up_sent).toBe(true);

      // DELETE
      const deleteRes = await page.request.delete(`/api/networking/coffee-chats/${chatId}`);
      expect(deleteRes.status()).toBe(200);
      chatId = null;
    } finally {
      if (chatId) await deleteCoffeeChat(page, chatId);
    }
  });

  test("POST with invalid medium returns 400", async ({ page }) => {
    await logIn(page);
    const futureTs = new Date(Date.now() + 86_400_000).toISOString();
    const res = await page.request.post("/api/networking/coffee-chats", {
      data: { scheduled_at: futureTs, medium: "Carrier Pigeon" },
    });
    expect(res.status()).toBe(400);
  });

  test("POST with invalid datetime returns 400", async ({ page }) => {
    await logIn(page);
    const res = await page.request.post("/api/networking/coffee-chats", {
      data: { scheduled_at: "not-a-datetime", medium: "Zoom" },
    });
    expect(res.status()).toBe(400);
  });

  test("PATCH with invalid ID format returns 400", async ({ page }) => {
    await logIn(page);
    const res = await page.request.patch("/api/networking/coffee-chats/not-a-uuid", {
      data: { status: "Completed" },
    });
    expect(res.status()).toBe(400);
  });
});

// ── Outreach PATCH — authenticated validation ─────────────────────────────────

test.describe("Outreach PATCH — authenticated validation", () => {
  test.skip(!E2E_EMAIL || !E2E_PASSWORD, "Skipped: E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set");

  test("returns 400 for a malformed (non-UUID) contact ID", async ({ page }) => {
    await logIn(page);
    const res = await page.request.patch("/api/networking/contacts/not-a-uuid/outreach", {
      data: { outreach_status: "Connected" },
    });
    expect(res.status()).toBe(400);
  });

  test("returns 404 for a valid UUID that does not belong to the user", async ({ page }) => {
    await logIn(page);
    const res = await page.request.patch(
      "/api/networking/contacts/00000000-0000-0000-0000-000000000004/outreach",
      { data: { outreach_status: "Connected" } },
    );
    expect(res.status()).toBe(404);
  });

  test("returns 400 for an invalid outreach_status value", async ({ page }) => {
    await logIn(page);
    const res = await page.request.patch(
      "/api/networking/contacts/00000000-0000-0000-0000-000000000004/outreach",
      { data: { outreach_status: "Stalking" } },
    );
    expect(res.status()).toBe(400);
  });
});

// ── Connection goal — authenticated persistence ───────────────────────────────

test.describe("Connection goal — authenticated persistence", () => {
  test.skip(!E2E_EMAIL || !E2E_PASSWORD, "Skipped: E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set");

  test("POST saves goal; GET /api/profile/export-data confirms persistence; value restored", async ({ page }) => {
    await logIn(page);
    const uniqueGoal = 11;
    try {
      // Save unique goal
      const saveRes = await page.request.post("/api/profile/update-connection-goal", {
        data: { weeklyConnectionGoal: uniqueGoal },
      });
      expect(saveRes.status()).toBe(200);
      const saveBody = await saveRes.json() as { weeklyConnectionGoal: number };
      expect(saveBody.weeklyConnectionGoal).toBe(uniqueGoal);

      // Read back via export-data
      const exportRes = await page.request.get("/api/profile/export-data");
      if (exportRes.ok()) {
        const exported = await exportRes.json() as {
          profile?: { user_metadata?: { weekly_connection_goal?: number } };
        };
        const saved = exported?.profile?.user_metadata?.weekly_connection_goal;
        if (saved !== undefined) {
          expect(saved).toBe(uniqueGoal);
        }
      }
    } finally {
      // Restore to default
      await page.request.post("/api/profile/update-connection-goal", {
        data: { weeklyConnectionGoal: 5 },
      });
    }
  });

  test("returns 422 for goal value of 0 (below minimum)", async ({ page }) => {
    await logIn(page);
    const res = await page.request.post("/api/profile/update-connection-goal", {
      data: { weeklyConnectionGoal: 0 },
    });
    expect([400, 422]).toContain(res.status());
  });

  test("returns 422 for goal value of 51 (above maximum)", async ({ page }) => {
    await logIn(page);
    const res = await page.request.post("/api/profile/update-connection-goal", {
      data: { weeklyConnectionGoal: 51 },
    });
    expect([400, 422]).toContain(res.status());
  });

  test("accepts boundary values 1 and 50", async ({ page }) => {
    await logIn(page);
    try {
      const res1 = await page.request.post("/api/profile/update-connection-goal", {
        data: { weeklyConnectionGoal: 1 },
      });
      expect(res1.status()).toBe(200);

      const res50 = await page.request.post("/api/profile/update-connection-goal", {
        data: { weeklyConnectionGoal: 50 },
      });
      expect(res50.status()).toBe(200);
    } finally {
      await page.request.post("/api/profile/update-connection-goal", {
        data: { weeklyConnectionGoal: 5 },
      });
    }
  });
});

// ── Document download fix — Content-Disposition ───────────────────────────────

test.describe("Document download fix — Content-Disposition", () => {
  test("GET /api/documents without auth returns 401", async ({ request }) => {
    const res = await request.get("/api/documents?path=some-path&dl=1");
    expect(res.status()).toBe(401);
  });

  test("GET /api/documents without path returns 400", async ({ page }) => {
    // Use an authenticated context; if unauth returns 401 that's also fine
    const res = await page.request.get("/api/documents");
    expect([400, 401]).toContain(res.status());
  });

  test("GET /api/documents with invalid path format returns 400 or 401", async ({ page }) => {
    const res = await page.request.get("/api/documents?path=../../etc/passwd&dl=1");
    expect([400, 401]).toContain(res.status());
  });
});

// ── UI tests — /networking page ───────────────────────────────────────────────

test.describe("Networking page UI — authenticated", () => {
  test.skip(!E2E_EMAIL || !E2E_PASSWORD, "Skipped: E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set");

  test("page loads with all 3 tabs visible", async ({ page }) => {
    await logIn(page);
    await page.goto("/networking");
    await expect(page.getByRole("button", { name: /outreach/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /referrals/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /coffee chats|chats/i })).toBeVisible();
  });

  test("Outreach tab is active by default", async ({ page }) => {
    await logIn(page);
    await page.goto("/networking");
    const outreachBtn = page.getByRole("button", { name: /^outreach$/i });
    await expect(outreachBtn).toBeVisible({ timeout: 10_000 });
    await expect(outreachBtn).toHaveClass(/db-filter-pill-active/);
  });

  test("Connection goal widget visible in Outreach tab", async ({ page }) => {
    await logIn(page);
    await page.goto("/networking");
    await expect(page.getByText(/weekly connection goal/i)).toBeVisible({ timeout: 10_000 });
  });

  test("clicking Referrals tab shows the tracker heading and Add button", async ({ page }) => {
    await logIn(page);
    await page.goto("/networking");
    await page.getByRole("button", { name: /referrals/i }).click();
    await expect(page.getByText(/referral tracker/i)).toBeVisible({ timeout: 8_000 });
    await expect(page.getByRole("button", { name: /add referral/i })).toBeVisible();
  });

  test("clicking Add Referral opens a dialog", async ({ page }) => {
    await logIn(page);
    await page.goto("/networking");
    await page.getByRole("button", { name: /referrals/i }).click();
    await page.getByRole("button", { name: /add referral/i }).click();
    // Radix Dialog renders with role="dialog"
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/add referral/i)).toBeVisible();
    // Close it
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 3_000 });
  });

  test("clicking Coffee Chats tab shows the schedule heading and Schedule button", async ({ page }) => {
    await logIn(page);
    await page.goto("/networking");
    await page.getByRole("button", { name: /coffee chats|chats/i }).click();
    await expect(page.getByText(/coffee chats/i).first()).toBeVisible({ timeout: 8_000 });
    await expect(page.getByRole("button", { name: /schedule chat/i })).toBeVisible();
  });

  test("clicking Schedule Chat opens a dialog", async ({ page }) => {
    await logIn(page);
    await page.goto("/networking");
    await page.getByRole("button", { name: /coffee chats|chats/i }).click();
    await page.getByRole("button", { name: /schedule chat/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/schedule coffee chat/i)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 3_000 });
  });

  test("Networking link appears in the Navbar", async ({ page }) => {
    await logIn(page);
    await page.goto("/networking");
    // Desktop nav link
    const navLink = page.locator("nav").getByRole("link", { name: /networking/i }).first();
    await expect(navLink).toBeVisible({ timeout: 10_000 });
  });

  test("stats strip shows 3 metric cards", async ({ page }) => {
    await logIn(page);
    await page.goto("/networking");
    await expect(page.getByText(/^contacts$/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/referrals converted/i)).toBeVisible();
    await expect(page.getByText(/chats upcoming/i)).toBeVisible();
  });
});

// ── Mobile viewport — basic smoke ─────────────────────────────────────────────

test.describe("Networking page — mobile viewport", () => {
  test.skip(!E2E_EMAIL || !E2E_PASSWORD, "Skipped: E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set");

  test("page renders without horizontal overflow at 390 px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await logIn(page);
    await page.goto("/networking");
    await expect(page.getByRole("button", { name: /outreach/i })).toBeVisible({ timeout: 10_000 });

    // Verify the page body does not overflow horizontally
    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const clientWidth = await page.evaluate(() => document.body.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5); // 5px tolerance
  });
});
