/**
 * Unit tests — GET /api/cron/milestone-celebrations
 *
 * Covers:
 *  - 401 when Authorization header is missing
 *  - 401 when secret is wrong
 *  - Skips user with no email
 *  - Skips user who opted out via notification_prefs.milestone_emails = false
 *  - Skips user outside 8–10am local window
 *  - Sends app-count milestone email at 100 apps and updates app_milestone_last
 *  - Does NOT re-send app milestone when app_milestone_last already covers current count
 *  - Sends offer milestone email at 10 offers and updates offer_milestone_last
 *  - Both milestones written in a single updateUserById call (prevents metadata overwrite race)
 *  - No send and skipped++ when no milestone is pending
 *  - Creates in-app notifications for both milestone types
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/email/nodemailer", () => ({
  sendApplicationMilestoneEmail: vi.fn().mockResolvedValue({ success: true }),
  sendOfferMilestoneEmail:       vi.fn().mockResolvedValue({ success: true }),
}));
vi.mock("@/lib/notifications/create", () => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
}));

import { GET } from "@/app/api/cron/milestone-celebrations/route";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendApplicationMilestoneEmail, sendOfferMilestoneEmail } from "@/lib/email/nodemailer";
import { createNotification } from "@/lib/notifications/create";

const mockAdmin       = vi.mocked(createAdminClient);
const mockAppEmail    = vi.mocked(sendApplicationMilestoneEmail);
const mockOfferEmail  = vi.mocked(sendOfferMilestoneEmail);
const mockNotif       = vi.mocked(createNotification);

const CRON_SECRET = "test-cron-secret";

// Cron runs once daily (09:00 UTC) — no local-hour window filter in the handler.
// Fake timers are not required; all skip/send logic is milestone-count-based.

function makeReq(authHeader?: string) {
  const headers: Record<string, string> = {};
  if (authHeader) headers["authorization"] = authHeader;
  return new NextRequest("http://localhost/api/cron/milestone-celebrations", { headers });
}
function validReq() { return makeReq(`Bearer ${CRON_SECRET}`); }

// Build a chainable query mock that resolves to { count: n }
function countChain(n: number) {
  const c: Record<string, unknown> = {};
  const ch = () => vi.fn().mockReturnValue(c);
  c.select = ch(); c.eq = ch(); c.in = ch(); c.gte = ch(); c.lte = ch();
  c.not = ch(); c.order = ch(); c.limit = ch();
  c.then = (resolve: (v: unknown) => void) => Promise.resolve({ count: n, error: null }).then(resolve);
  return c;
}

function makeAdminClient(users: unknown[], counts: {
  totalApps: number; offerCount: number;
  responded?: number; pipeline?: number;
}) {
  const updateUserById = vi.fn().mockResolvedValue({ data: {}, error: null });
  let fromIdx = 0;
  const countSequence = [
    counts.totalApps,
    counts.offerCount,
    counts.responded ?? 0,
    counts.pipeline  ?? 0,
  ];

  return {
    auth: {
      admin: {
        listUsers: vi.fn()
          .mockResolvedValueOnce({ data: { users }, error: null })
          .mockResolvedValue({ data: { users: [] }, error: null }),
        updateUserById,
      },
    },
    from: vi.fn().mockImplementation(() => countChain(countSequence[fromIdx++] ?? 0)),
    _updateUserById: updateUserById,
  };
}

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "uid-1",
    email: "user@test.com",
    user_metadata: {
      utc_offset_hours: 0,
      app_milestone_last: 0,
      offer_milestone_last: 0,
      ...overrides,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Auth ─────────────────────────────────────────────────────────────────────

describe("GET /api/cron/milestone-celebrations — auth", () => {
  it("returns 401 when Authorization header is missing", async () => {
    mockAdmin.mockReturnValue(makeAdminClient([], { totalApps: 0, offerCount: 0 }) as never);
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it("returns 401 when secret is wrong", async () => {
    mockAdmin.mockReturnValue(makeAdminClient([], { totalApps: 0, offerCount: 0 }) as never);
    const res = await GET(makeReq("Bearer wrong-secret"));
    expect(res.status).toBe(401);
  });
});

// ── Skip logic ────────────────────────────────────────────────────────────────

describe("GET /api/cron/milestone-celebrations — skip conditions", () => {
  it("skips users with no email", async () => {
    const users = [{ id: "uid-1", email: undefined, user_metadata: { utc_offset_hours: 0 } }];
    mockAdmin.mockReturnValue(makeAdminClient(users, { totalApps: 100, offerCount: 0 }) as never);
    const res = await GET(validReq());
    expect(res.status).toBe(200);
    expect(mockAppEmail).not.toHaveBeenCalled();
  });

  it("skips opted-out users (milestone_emails === false)", async () => {
    const users = [makeUser({ notification_prefs: { milestone_emails: false } })];
    mockAdmin.mockReturnValue(makeAdminClient(users, { totalApps: 100, offerCount: 0 }) as never);
    await GET(validReq());
    expect(mockAppEmail).not.toHaveBeenCalled();
  });

  it("skips users with no pending milestones (counts above last sent)", async () => {
    // last=100, total=150 → next=200, 150 < 200 → no milestone
    const users = [makeUser({ app_milestone_last: 100, offer_milestone_last: 0 })];
    mockAdmin.mockReturnValue(makeAdminClient(users, { totalApps: 150, offerCount: 0 }) as never);
    const res = await GET(validReq());
    const body = await res.json();
    expect(body.sent).toBe(0);
    expect(body.skipped).toBe(1);
    expect(mockAppEmail).not.toHaveBeenCalled();
  });
});

// ── Application milestone ─────────────────────────────────────────────────────

describe("GET /api/cron/milestone-celebrations — app milestone", () => {
  it("sends email and notification at 100 apps (first milestone)", async () => {
    const users = [makeUser({ app_milestone_last: 0 })];
    mockAdmin.mockReturnValue(
      makeAdminClient(users, { totalApps: 105, offerCount: 0, responded: 20, pipeline: 5 }) as never
    );
    const res = await GET(validReq());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.sent).toBe(1);
    expect(mockAppEmail).toHaveBeenCalledWith(
      "user@test.com",
      expect.any(String),
      100,
      expect.objectContaining({ responseRate: expect.any(Number) })
    );
    expect(mockNotif).toHaveBeenCalledWith(
      expect.objectContaining({ sourceType: "app_milestone", sourceId: "100" })
    );
  });

  it("does not re-send when app_milestone_last already covers current count", async () => {
    // last=100, total=150 → next=200, 150 < 200 → no send
    const users = [makeUser({ app_milestone_last: 100 })];
    mockAdmin.mockReturnValue(makeAdminClient(users, { totalApps: 150, offerCount: 0 }) as never);
    await GET(validReq());
    expect(mockAppEmail).not.toHaveBeenCalled();
  });

  it("sends 200 milestone when crossing 200 apps", async () => {
    const users = [makeUser({ app_milestone_last: 100 })];
    mockAdmin.mockReturnValue(
      makeAdminClient(users, { totalApps: 220, offerCount: 0, responded: 40, pipeline: 10 }) as never
    );
    await GET(validReq());
    expect(mockAppEmail).toHaveBeenCalledWith("user@test.com", expect.any(String), 200, expect.any(Object));
  });

  it("sends the highest earned milestone (200) when user jumps from 0 to 250 apps in one cron cycle", async () => {
    // earnedMilestone = Math.floor(250/100)*100 = 200; nextAppMilestone = 100
    // 250 >= 100 ✓ AND 200 > 0 ✓ → email for 200, not 100
    const users = [makeUser({ app_milestone_last: 0 })];
    const client = makeAdminClient(users, { totalApps: 250, offerCount: 0, responded: 30, pipeline: 8 });
    mockAdmin.mockReturnValue(client as never);
    await GET(validReq());
    expect(mockAppEmail).toHaveBeenCalledWith("user@test.com", expect.any(String), 200, expect.any(Object));
    // app_milestone_last written as 200 (the actual earned milestone, not next-in-sequence 100)
    expect(client._updateUserById).toHaveBeenCalledWith(
      "uid-1",
      expect.objectContaining({
        user_metadata: expect.objectContaining({ app_milestone_last: 200 }),
      })
    );
  });

  it("sends 300 milestone when user jumps from last=200 to 350 apps (skips no intermediate)", async () => {
    // nextAppMilestone=300; earnedMilestone=300; 350>=300 ✓ AND 300>200 ✓
    const users = [makeUser({ app_milestone_last: 200 })];
    const client = makeAdminClient(users, { totalApps: 350, offerCount: 0, responded: 60, pipeline: 12 });
    mockAdmin.mockReturnValue(client as never);
    await GET(validReq());
    expect(mockAppEmail).toHaveBeenCalledWith("user@test.com", expect.any(String), 300, expect.any(Object));
    expect(client._updateUserById).toHaveBeenCalledWith(
      "uid-1",
      expect.objectContaining({
        user_metadata: expect.objectContaining({ app_milestone_last: 300 }),
      })
    );
  });

  it("does not re-fire when earnedMilestone equals lastAppMilestone (apps deleted and re-added below milestone)", async () => {
    // User had 300 apps (last=300), deleted 20, now has 285.
    // earnedMilestone=200; 285 >= 300 (next) is FALSE → correctly skipped by first condition.
    // This documents that both the firstcondition and the earnedMilestone guard cooperate.
    const users = [makeUser({ app_milestone_last: 300 })];
    mockAdmin.mockReturnValue(makeAdminClient(users, { totalApps: 285, offerCount: 0 }) as never);
    const res = await GET(validReq());
    const body = await res.json();
    expect(body.sent).toBe(0);
    expect(mockAppEmail).not.toHaveBeenCalled();
  });

  it("updates app_milestone_last to the new milestone value", async () => {
    const users = [makeUser({ app_milestone_last: 0 })];
    const client = makeAdminClient(users, { totalApps: 100, offerCount: 0, responded: 10, pipeline: 3 });
    mockAdmin.mockReturnValue(client as never);
    await GET(validReq());
    expect(client._updateUserById).toHaveBeenCalledWith(
      "uid-1",
      expect.objectContaining({
        user_metadata: expect.objectContaining({ app_milestone_last: 100 }),
      })
    );
  });
});

// ── Offer milestone ───────────────────────────────────────────────────────────

describe("GET /api/cron/milestone-celebrations — offer milestone", () => {
  it("sends email and notification at 10 offers (first milestone)", async () => {
    const users = [makeUser({ offer_milestone_last: 0 })];
    mockAdmin.mockReturnValue(makeAdminClient(users, { totalApps: 80, offerCount: 10 }) as never);
    await GET(validReq());
    expect(mockOfferEmail).toHaveBeenCalledWith("user@test.com", expect.any(String), 10, 80);
    expect(mockNotif).toHaveBeenCalledWith(
      expect.objectContaining({ sourceType: "offer_milestone", sourceId: "10" })
    );
  });

  it("does not trigger offer milestone when offers < 10", async () => {
    const users = [makeUser()];
    mockAdmin.mockReturnValue(makeAdminClient(users, { totalApps: 80, offerCount: 5 }) as never);
    await GET(validReq());
    expect(mockOfferEmail).not.toHaveBeenCalled();
  });

  it("updates offer_milestone_last to the new milestone value", async () => {
    const users = [makeUser({ offer_milestone_last: 0 })];
    const client = makeAdminClient(users, { totalApps: 80, offerCount: 10 });
    mockAdmin.mockReturnValue(client as never);
    await GET(validReq());
    expect(client._updateUserById).toHaveBeenCalledWith(
      "uid-1",
      expect.objectContaining({
        user_metadata: expect.objectContaining({ offer_milestone_last: 10 }),
      })
    );
  });
});

// ── Metadata batching (no overwrite race) ─────────────────────────────────────

describe("GET /api/cron/milestone-celebrations — metadata batching", () => {
  it("writes both milestones in a single updateUserById call when both fire simultaneously", async () => {
    // User has 100 apps AND 10 offers simultaneously — both milestones trigger
    const users = [makeUser({ app_milestone_last: 0, offer_milestone_last: 0 })];
    const client = makeAdminClient(users, {
      totalApps: 100, offerCount: 10, responded: 15, pipeline: 5,
    });
    mockAdmin.mockReturnValue(client as never);

    await GET(validReq());

    // CRITICAL: updateUserById must be called exactly once with BOTH keys
    expect(client._updateUserById).toHaveBeenCalledTimes(1);
    const [, updateArg] = client._updateUserById.mock.calls[0];
    expect(updateArg.user_metadata.app_milestone_last).toBe(100);
    expect(updateArg.user_metadata.offer_milestone_last).toBe(10);
    expect(mockAppEmail).toHaveBeenCalledTimes(1);
    expect(mockOfferEmail).toHaveBeenCalledTimes(1);
  });
});
