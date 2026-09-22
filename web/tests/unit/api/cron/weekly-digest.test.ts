/**
 * Unit tests — GET /api/cron/weekly-digest
 *
 * Schedule: "0 21 * * 6" (Saturday 21:00 UTC, once per week).
 * The route sends to all opted-in users each Saturday. A per-user IANA timezone
 * gate (isSaturday9pmInTz) is implemented but commented out — it requires an
 * hourly cron schedule ("0 * * * 6,0") and a Vercel plan that supports it.
 *
 * Covers:
 *  - 401 when Authorization header is missing or wrong
 *  - Skips user with no email
 *  - Skips user not opted in (weekly_digest falsy / notification_prefs absent)
 *  - Skips user already stamped with this week's digest_sent_week
 *  - Skips user already stamped with attempted:this-week (SMTP failure last run)
 *  - Sends to opted-in user and returns sent:1
 *  - Stamps digest_sent_week with ISO-week key on successful send
 *  - Sends again the following week (previous week's stamp does not block)
 *  - Stamps digest_sent_week with "attempted:WEEK" on send failure
 *  - Returns correct sent/skipped counts for a mixed user set
 *  - Handles listUsers error gracefully
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/email/nodemailer", () => ({
  sendWeeklyDigestEmail: vi.fn().mockResolvedValue({ success: true }),
}));

import { GET } from "@/app/api/cron/weekly-digest/route";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWeeklyDigestEmail } from "@/lib/email/nodemailer";

const mockAdmin = vi.mocked(createAdminClient);
const mockEmail = vi.mocked(sendWeeklyDigestEmail);

const CRON_SECRET = "test-cron-secret";

// Saturday September 19, 2026 21:00:00 UTC — matches the cron schedule.
// getISOWeek(this date) = "2026-W38".
const SAT_2100_UTC = Date.UTC(2026, 8, 19, 21, 0, 0);
const WEEK_38 = "2026-W38";

function makeReq(authHeader?: string) {
  const headers: Record<string, string> = {};
  if (authHeader) headers["authorization"] = authHeader;
  return new NextRequest("http://localhost/api/cron/weekly-digest", { headers });
}
function validReq() { return makeReq(`Bearer ${CRON_SECRET}`); }

// Chainable fluent builder for Supabase query calls.
// Resolves with `result` when awaited (via .then).
function makeChainWith(result: unknown) {
  const chain: Record<string, unknown> = {};
  const self = () => vi.fn().mockReturnValue(chain);
  chain.select = self(); chain.eq  = self(); chain.gte = self();
  chain.lte    = self(); chain.lt  = self(); chain.not = self();
  chain.order  = self(); chain.limit = self(); chain.is = self();
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(result).then(resolve);
  return chain;
}

function countResult(n: number) {
  return makeChainWith({ data: { count: n } as unknown, error: null });
}
function arrayResult(rows: unknown[] = []) {
  return makeChainWith({ data: rows, error: null });
}

/**
 * Build a mock admin client.
 * `from` is called 6 times per eligible user (via Promise.all):
 *   0 appsThisWeek (count),  1 totalActive (count),
 *   2 upcomingInterviews (count), 3 overdueReminders (count),
 *   4 recentApps (array),    5 interviews (array)
 */
function makeAdminClient(users: unknown[], emailResult = { success: true }) {
  const updateUserById = vi.fn().mockResolvedValue({ data: {}, error: null });
  let idx = 0;
  const fromResults = [
    countResult(3), countResult(5), countResult(1), countResult(0),
    arrayResult([]), arrayResult([]),
  ];

  mockEmail.mockResolvedValue(emailResult as never);

  return {
    auth: {
      admin: {
        listUsers: vi.fn()
          .mockResolvedValueOnce({ data: { users }, error: null })
          .mockResolvedValue({ data: { users: [] }, error: null }),
        updateUserById,
      },
    },
    from: vi.fn().mockImplementation(() => fromResults[idx++ % fromResults.length]),
    _updateUserById: updateUserById,
  };
}

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "uid-1",
    email: "user@example.com",
    user_metadata: {
      notification_prefs: { weekly_digest: true },
      timezone: "UTC",
      digest_sent_week: null,
      display_name: "Test User",
      ...overrides,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = CRON_SECRET;
  vi.useFakeTimers();
  vi.setSystemTime(SAT_2100_UTC);
});
afterEach(() => {
  vi.useRealTimers();
  delete process.env.CRON_SECRET;
});

// ── Auth ──────────────────────────────────────────────────────────────────────

describe("GET /api/cron/weekly-digest — auth", () => {
  it("returns 401 when Authorization header is missing", async () => {
    mockAdmin.mockReturnValue(makeAdminClient([]) as never);
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it("returns 401 when Authorization header contains wrong secret", async () => {
    mockAdmin.mockReturnValue(makeAdminClient([]) as never);
    const res = await GET(makeReq("Bearer wrong-secret"));
    expect(res.status).toBe(401);
  });
});

// ── Skip conditions ──────────────────────────────────────────────────────────

describe("GET /api/cron/weekly-digest — skip conditions", () => {
  it("skips users with no email", async () => {
    const user = { ...makeUser(), email: undefined };
    mockAdmin.mockReturnValue(makeAdminClient([user]) as never);
    const res = await GET(validReq());
    const body = await res.json();
    expect(body.skipped).toBe(1);
    expect(mockEmail).not.toHaveBeenCalled();
  });

  it("skips users not opted in to weekly_digest", async () => {
    const user = makeUser({ notification_prefs: { weekly_digest: false } });
    mockAdmin.mockReturnValue(makeAdminClient([user]) as never);
    await GET(validReq());
    expect(mockEmail).not.toHaveBeenCalled();
  });

  it("skips users with no notification_prefs set", async () => {
    const user = makeUser({ notification_prefs: undefined });
    mockAdmin.mockReturnValue(makeAdminClient([user]) as never);
    await GET(validReq());
    expect(mockEmail).not.toHaveBeenCalled();
  });

  it("skips user already stamped with current week (successful send)", async () => {
    const user = makeUser({ digest_sent_week: WEEK_38 });
    mockAdmin.mockReturnValue(makeAdminClient([user]) as never);
    await GET(validReq());
    expect(mockEmail).not.toHaveBeenCalled();
  });

  it("skips user stamped with attempted:WEEK (prevents double-send on edge-case double-fire)", async () => {
    const user = makeUser({ digest_sent_week: `attempted:${WEEK_38}` });
    mockAdmin.mockReturnValue(makeAdminClient([user]) as never);
    await GET(validReq());
    expect(mockEmail).not.toHaveBeenCalled();
  });
});

// ── Happy path ────────────────────────────────────────────────────────────────

describe("GET /api/cron/weekly-digest — happy path", () => {
  it("sends email to eligible opted-in user and returns sent:1", async () => {
    const user = makeUser();
    mockAdmin.mockReturnValue(makeAdminClient([user]) as never);
    const res = await GET(validReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sent).toBe(1);
    expect(body.skipped).toBe(0);
    expect(mockEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        email:  "user@example.com",
        appUrl: expect.any(String),
        stats:  expect.objectContaining({ applicationsThisWeek: expect.any(Number) }),
      })
    );
  });

  it("stamps digest_sent_week with ISO week key on successful send", async () => {
    const user = makeUser();
    const client = makeAdminClient([user]);
    mockAdmin.mockReturnValue(client as never);
    await GET(validReq());
    expect(client._updateUserById).toHaveBeenCalledWith(
      "uid-1",
      expect.objectContaining({
        user_metadata: expect.objectContaining({ digest_sent_week: WEEK_38 }),
      })
    );
  });

  it("sends again the following week when previous stamp is from last week", async () => {
    const user = makeUser({ digest_sent_week: "2026-W37" });
    mockAdmin.mockReturnValue(makeAdminClient([user]) as never);
    const res = await GET(validReq());
    const body = await res.json();
    expect(body.sent).toBe(1);
    expect(mockEmail).toHaveBeenCalledOnce();
  });

  it("returns correct sent/skipped counts for a mixed user set", async () => {
    const eligible    = makeUser();
    const noOptIn     = { ...makeUser(), id: "uid-2", email: "b@test.com",
                          user_metadata: { ...makeUser().user_metadata, notification_prefs: { weekly_digest: false } } };
    const alreadySent = { ...makeUser(), id: "uid-3", email: "c@test.com",
                          user_metadata: { ...makeUser().user_metadata, digest_sent_week: WEEK_38 } };

    const client = makeAdminClient([eligible, noOptIn, alreadySent]);
    client.auth.admin.listUsers
      .mockResolvedValueOnce({ data: { users: [eligible, noOptIn, alreadySent] }, error: null })
      .mockResolvedValue({ data: { users: [] }, error: null });
    mockAdmin.mockReturnValue(client as never);

    const res = await GET(validReq());
    const body = await res.json();
    expect(body.sent).toBe(1);
    expect(body.skipped).toBeGreaterThanOrEqual(2);
  });
});

// ── Send failure — dedup stamp ────────────────────────────────────────────────

describe("GET /api/cron/weekly-digest — send failure handling", () => {
  it("stamps attempted:WEEK on SMTP failure so a double-fire does not retry the address", async () => {
    const user = makeUser();
    const client = makeAdminClient([user], { success: false, error: "SMTP timeout" });
    mockAdmin.mockReturnValue(client as never);

    const res = await GET(validReq());
    const body = await res.json();
    expect(body.sent).toBe(0);
    expect(body.errors).toHaveLength(1);

    expect(client._updateUserById).toHaveBeenCalledWith(
      "uid-1",
      expect.objectContaining({
        user_metadata: expect.objectContaining({
          digest_sent_week: `attempted:${WEEK_38}`,
        }),
      })
    );
  });
});

// ── Error resilience ─────────────────────────────────────────────────────────

describe("GET /api/cron/weekly-digest — resilience", () => {
  it("handles listUsers error gracefully and returns 200 with error logged", async () => {
    mockAdmin.mockReturnValue({
      auth: {
        admin: {
          listUsers: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "DB connection error" },
          }),
          updateUserById: vi.fn(),
        },
      },
      from: vi.fn(),
    } as never);

    const res = await GET(validReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0]).toContain("listUsers");
  });
});
