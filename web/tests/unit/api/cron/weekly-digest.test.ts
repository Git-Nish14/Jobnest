/**
 * Unit tests — GET /api/cron/weekly-digest
 *
 * Schedule: "0 * * * 6,0" (every hour on Saturday and Sunday UTC).
 * The cron fires hourly but the route gates each user to exactly Saturday 21:xx
 * in their stored IANA timezone (isSaturday9pmInTz), then deduplicates on an
 * ISO-week key so each user receives at most one email per calendar week.
 *
 * Covers:
 *  - 401 when Authorization header is missing or wrong
 *  - Skips user with no email
 *  - Skips user not opted in (weekly_digest falsy)
 *  - Skips user when isSaturday9pmInTz returns false (wrong hour or day)
 *  - Sends to user whose local time is Saturday 21:xx (UTC timezone at 21:00 UTC)
 *  - Sends to user in UTC+3 when clock is at 18:00 UTC Saturday
 *  - Skips user already stamped with this week's digest_sent_week
 *  - Skips user already stamped with attempted:this-week (SMTP failure last hour)
 *  - Does NOT skip user stamped with a previous week
 *  - Stamps digest_sent_week with ISO-week key on successful send
 *  - Stamps digest_sent_week with "attempted:WEEK" on send failure (no retry spam)
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

// Saturday September 19, 2026 21:00:00 UTC — a valid Saturday 21:xx in UTC.
// getISOWeek(this date) = "2026-W38".
const SAT_2100_UTC = Date.UTC(2026, 8, 19, 21, 0, 0);

// Saturday September 19, 2026 18:00:00 UTC — 21:00 Moscow time (UTC+3).
const SAT_1800_UTC = Date.UTC(2026, 8, 19, 18, 0, 0);

// Sunday September 20, 2026 21:00:00 UTC — NOT Saturday for UTC users.
const SUN_2100_UTC = Date.UTC(2026, 8, 20, 21, 0, 0);

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
  chain.select  = self();
  chain.eq      = self();
  chain.gte     = self();
  chain.lte     = self();
  chain.lt      = self();
  chain.not     = self();
  chain.order   = self();
  chain.limit   = self();
  chain.is      = self();
  chain.then    = (resolve: (v: unknown) => unknown) =>
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
 * `from` is called 6 times per eligible user (in parallel via Promise.all):
 *   0 appsThisWeek (count),  1 totalActive (count),
 *   2 upcomingInterviews (count), 3 overdueReminders (count),
 *   4 recentApps (array),    5 interviews (array)
 */
function makeAdminClient(users: unknown[], emailResult = { success: true }) {
  const updateUserById = vi.fn().mockResolvedValue({ data: {}, error: null });
  let idx = 0;
  const fromResults = [
    countResult(3),  // appsThisWeek
    countResult(5),  // totalActive
    countResult(1),  // upcomingInterviews
    countResult(0),  // overdueReminders
    arrayResult([]), // recentApps
    arrayResult([]), // interviews
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

  it("skips user when their local time is not Saturday 21:xx (Sunday 21:00 UTC for UTC user)", async () => {
    vi.setSystemTime(SUN_2100_UTC);
    const user = makeUser({ timezone: "UTC" });
    mockAdmin.mockReturnValue(makeAdminClient([user]) as never);
    await GET(validReq());
    expect(mockEmail).not.toHaveBeenCalled();
  });

  it("skips UTC user when clock is 18:00 UTC Saturday (not 21:xx for UTC)", async () => {
    vi.setSystemTime(SAT_1800_UTC);
    const user = makeUser({ timezone: "UTC" });
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

  it("skips user stamped with attempted:WEEK (SMTP failure — no hourly retry spam)", async () => {
    const user = makeUser({ digest_sent_week: `attempted:${WEEK_38}` });
    mockAdmin.mockReturnValue(makeAdminClient([user]) as never);
    await GET(validReq());
    expect(mockEmail).not.toHaveBeenCalled();
  });
});

// ── Timezone gate ────────────────────────────────────────────────────────────

describe("GET /api/cron/weekly-digest — timezone gate", () => {
  it("sends to UTC user when clock is Saturday 21:00 UTC", async () => {
    // Clock already set to SAT_2100_UTC in beforeEach
    const user = makeUser({ timezone: "UTC" });
    mockAdmin.mockReturnValue(makeAdminClient([user]) as never);
    const res = await GET(validReq());
    const body = await res.json();
    expect(body.sent).toBe(1);
    expect(mockEmail).toHaveBeenCalledOnce();
  });

  it("sends to UTC+3 user (Europe/Moscow) when clock is Saturday 18:00 UTC", async () => {
    vi.setSystemTime(SAT_1800_UTC); // 18:00 UTC = 21:00 Moscow
    const user = makeUser({ timezone: "Europe/Moscow" });
    mockAdmin.mockReturnValue(makeAdminClient([user]) as never);
    const res = await GET(validReq());
    const body = await res.json();
    expect(body.sent).toBe(1);
    expect(mockEmail).toHaveBeenCalledOnce();
  });

  it("skips UTC+3 user when clock is Saturday 21:00 UTC (it's already Sunday 00:00 for them)", async () => {
    // SAT_2100_UTC is already set — 21:00 UTC = 00:00 Sunday Moscow time (UTC+3)
    const user = makeUser({ timezone: "Europe/Moscow" });
    mockAdmin.mockReturnValue(makeAdminClient([user]) as never);
    await GET(validReq());
    expect(mockEmail).not.toHaveBeenCalled();
  });

  it("falls back to UTC for users with no stored timezone", async () => {
    // No timezone in metadata → defaults to "UTC" → sends at 21:00 UTC Saturday
    const user = makeUser({ timezone: undefined });
    mockAdmin.mockReturnValue(makeAdminClient([user]) as never);
    const res = await GET(validReq());
    const body = await res.json();
    expect(body.sent).toBe(1);
  });

  it("skips gracefully when stored timezone is an invalid IANA string", async () => {
    const user = makeUser({ timezone: "Not/A/Real/Timezone" });
    mockAdmin.mockReturnValue(makeAdminClient([user]) as never);
    // isSaturday9pmInTz catches the RangeError and returns false — no crash
    await expect(GET(validReq())).resolves.not.toThrow();
    expect(mockEmail).not.toHaveBeenCalled();
  });
});

// ── Happy path ────────────────────────────────────────────────────────────────

describe("GET /api/cron/weekly-digest — happy path", () => {
  it("sends email to eligible user and returns sent:1", async () => {
    const user = makeUser();
    mockAdmin.mockReturnValue(makeAdminClient([user]) as never);
    const res = await GET(validReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sent).toBe(1);
    expect(body.skipped).toBe(0);
    expect(mockEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "user@example.com",
        appUrl:  expect.any(String),
        stats:   expect.objectContaining({ applicationsThisWeek: expect.any(Number) }),
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
    const user = makeUser({ digest_sent_week: "2026-W37" }); // previous week
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

    // Use the shared factory so from() returns proper count vs. array results
    // alternating on each call (avoids .map() crash on a count object).
    const client = makeAdminClient([eligible, noOptIn, alreadySent]);
    // Override listUsers to return all three users in one page
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
  it("stamps attempted:WEEK on SMTP failure so cron does not retry this hour", async () => {
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
