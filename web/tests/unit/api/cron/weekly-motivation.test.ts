/**
 * Unit tests — GET /api/cron/weekly-motivation
 *
 * Covers:
 *  - 401 when Authorization header is missing
 *  - 401 when secret is wrong
 *  - Skips user with no email
 *  - Skips opted-out user (notification_prefs.motivation_emails === false)
 *  - Skips inactive users (last_sign_in_at > 30 days ago)
 *  - Skips user outside 8–10am local window
 *  - Skips user on wrong day (not Wednesday in local time)
 *  - Skips user who already received email this week (motivation_sent_week matches)
 *  - Skips user with 0 total applications
 *  - Sends email to eligible user and updates motivation_sent_week
 *  - Returns correct sent/skipped counts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/email/nodemailer", () => ({
  sendWeeklyMotivationEmail: vi.fn().mockResolvedValue({ success: true }),
}));

import { GET } from "@/app/api/cron/weekly-motivation/route";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWeeklyMotivationEmail } from "@/lib/email/nodemailer";

const mockAdmin = vi.mocked(createAdminClient);
const mockEmail = vi.mocked(sendWeeklyMotivationEmail);

const CRON_SECRET = "test-cron-secret";

// Jan 7 2026 09:00 UTC = Wednesday, localHour=9 for UTC+0 (in [8,10))
// ISO week: Jan 7 2026 is in week 2 of 2026 (first Thursday of year = Jan 1; Mon Jan 5 starts W2)
// Use Date.UTC() numbers everywhere for vi.setSystemTime() to avoid new Date() fake-timer ambiguity.
const WEDNESDAY_9AM_MS = Date.UTC(2026, 0, 7, 9, 0, 0);  // Wed Jan 7 2026 09:00 UTC
const MONDAY_9AM_MS    = Date.UTC(2026, 0, 5, 9, 0, 0);  // Mon Jan 5 2026 09:00 UTC
const INDIA_03_30_MS   = Date.UTC(2026, 0, 7, 3, 30, 0); // Wed Jan 7 2026 03:30 UTC (+5.5 → 9am IST)

// Reference Date object only for computing relative dates (not passed to setSystemTime)
const WEDNESDAY_REF = new Date(WEDNESDAY_9AM_MS);
const INACTIVE_SIGNIN = new Date(WEDNESDAY_REF.getTime() - 31 * 86_400_000).toISOString();
const ACTIVE_SIGNIN   = new Date(WEDNESDAY_REF.getTime() - 5  * 86_400_000).toISOString();

function makeReq(authHeader?: string) {
  const headers: Record<string, string> = {};
  if (authHeader) headers["authorization"] = authHeader;
  return new NextRequest("http://localhost/api/cron/weekly-motivation", { headers });
}
function validReq() { return makeReq(`Bearer ${CRON_SECRET}`); }

function countChain(n: number) {
  const c: Record<string, unknown> = {};
  const ch = () => vi.fn().mockReturnValue(c);
  c.select = ch(); c.eq = ch(); c.in = ch(); c.gte = ch(); c.lte = ch();
  c.not = ch(); c.order = ch(); c.limit = ch();
  c.then = (resolve: (v: unknown) => void) => Promise.resolve({ count: n, error: null }).then(resolve);
  return c;
}

function makeAdminClient(
  users: unknown[],
  counts = { total: 50, week: 5, responded: 10, pipeline: 3, offers: 1 }
) {
  const updateUserById = vi.fn().mockResolvedValue({ data: {}, error: null });
  const countSeq = [counts.total, counts.week, counts.responded, counts.pipeline, counts.offers];
  let idx = 0;

  return {
    auth: {
      admin: {
        listUsers: vi.fn()
          .mockResolvedValueOnce({ data: { users }, error: null })
          .mockResolvedValue({ data: { users: [] }, error: null }),
        updateUserById,
      },
    },
    from: vi.fn().mockImplementation(() => countChain(countSeq[idx++] ?? 0)),
    _updateUserById: updateUserById,
  };
}

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "uid-1",
    email: "user@test.com",
    last_sign_in_at: ACTIVE_SIGNIN,
    user_metadata: {
      utc_offset_hours: 0,
      motivation_sent_week: null,
      ...overrides,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(WEDNESDAY_9AM_MS); // numeric ms timestamp — no fake-timer ambiguity
});
afterEach(() => vi.useRealTimers());

// ── Auth ─────────────────────────────────────────────────────────────────────

describe("GET /api/cron/weekly-motivation — auth", () => {
  it("returns 401 when Authorization header is missing", async () => {
    mockAdmin.mockReturnValue(makeAdminClient([]) as never);
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it("returns 401 when secret is wrong", async () => {
    mockAdmin.mockReturnValue(makeAdminClient([]) as never);
    const res = await GET(makeReq("Bearer wrong-secret"));
    expect(res.status).toBe(401);
  });
});

// ── Skip conditions ───────────────────────────────────────────────────────────

describe("GET /api/cron/weekly-motivation — skip conditions", () => {
  it("skips users with no email", async () => {
    const users = [{ id: "uid-1", email: undefined, last_sign_in_at: ACTIVE_SIGNIN, user_metadata: { utc_offset_hours: 0 } }];
    mockAdmin.mockReturnValue(makeAdminClient(users) as never);
    const res = await GET(validReq());
    const body = await res.json();
    expect(body.skipped).toBe(1);
    expect(mockEmail).not.toHaveBeenCalled();
  });

  it("skips opted-out users (motivation_emails === false)", async () => {
    const users = [makeUser({ notification_prefs: { motivation_emails: false } })];
    mockAdmin.mockReturnValue(makeAdminClient(users) as never);
    await GET(validReq());
    expect(mockEmail).not.toHaveBeenCalled();
  });

  it("skips users inactive for > 30 days", async () => {
    const users = [makeUser({ utc_offset_hours: 0 })];
    users[0].last_sign_in_at = INACTIVE_SIGNIN;
    mockAdmin.mockReturnValue(makeAdminClient(users) as never);
    await GET(validReq());
    expect(mockEmail).not.toHaveBeenCalled();
  });

  it("skips users outside 8–10am local window", async () => {
    // offset=5 → localHour=14, not in [8,10)
    const users = [makeUser({ utc_offset_hours: 5 })];
    mockAdmin.mockReturnValue(makeAdminClient(users) as never);
    await GET(validReq());
    expect(mockEmail).not.toHaveBeenCalled();
  });

  it("skips when local day is not Wednesday (Monday UTC+0 at 9am)", async () => {
    // Numeric timestamp avoids any new Date() fake-timer ambiguity
    vi.setSystemTime(MONDAY_9AM_MS); // Mon Jan 5 2026 09:00 UTC, getUTCDay()=1
    const users = [makeUser()];
    mockAdmin.mockReturnValue(makeAdminClient(users) as never);
    await GET(validReq());
    expect(mockEmail).not.toHaveBeenCalled();
  });

  it("skips user who already received motivation email this ISO week", async () => {
    // Week 2026-W2 already sent
    const users = [makeUser({ motivation_sent_week: "2026-W2" })];
    mockAdmin.mockReturnValue(makeAdminClient(users) as never);
    await GET(validReq());
    expect(mockEmail).not.toHaveBeenCalled();
  });

  it("skips user with 0 total applications", async () => {
    const users = [makeUser()];
    // totalApps count = 0
    mockAdmin.mockReturnValue(makeAdminClient(users, { total: 0, week: 0, responded: 0, pipeline: 0, offers: 0 }) as never);
    await GET(validReq());
    expect(mockEmail).not.toHaveBeenCalled();
  });
});

// ── Happy path ────────────────────────────────────────────────────────────────

describe("GET /api/cron/weekly-motivation — happy path", () => {
  it("sends email to eligible user on Wednesday in 8–10am window", async () => {
    const users = [makeUser()];
    mockAdmin.mockReturnValue(makeAdminClient(users) as never);

    const res = await GET(validReq());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.sent).toBe(1);
    expect(mockEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "user@test.com",
        totalApps: expect.any(Number),
        appsThisWeek: expect.any(Number),
        responseRate: expect.any(Number),
        activePipeline: expect.any(Number),
        totalOffers: expect.any(Number),
      })
    );
  });

  it("updates motivation_sent_week after successful send", async () => {
    const users = [makeUser()];
    const client = makeAdminClient(users);
    mockAdmin.mockReturnValue(client as never);

    await GET(validReq());

    expect(client._updateUserById).toHaveBeenCalledWith(
      "uid-1",
      expect.objectContaining({
        user_metadata: expect.objectContaining({
          motivation_sent_week: expect.stringMatching(/^\d{4}-W\d+$/),
        }),
      })
    );
  });

  it("does not re-send in the same ISO week — dedup is durable", async () => {
    // First send
    const users = [makeUser()];
    const client1 = makeAdminClient(users);
    mockAdmin.mockReturnValue(client1 as never);
    await GET(validReq());
    expect(mockEmail).toHaveBeenCalledTimes(1);

    // Second run same week — user now has motivation_sent_week set to "2026-W2"
    vi.clearAllMocks();
    const users2 = [makeUser({ motivation_sent_week: "2026-W2" })];
    mockAdmin.mockReturnValue(makeAdminClient(users2) as never);
    await GET(validReq());
    expect(mockEmail).not.toHaveBeenCalled();
  });

  it("accepts fractional UTC offset (UTC+5:30 India at 09:00 local → 03:30 UTC)", async () => {
    // Run at 03:30 UTC → local hour for UTC+5.5 = 8.5 (8:30am), in [8,10)
    vi.setSystemTime(INDIA_03_30_MS); // numeric ms — Jan 7 2026 03:30 UTC (Wednesday)
    const users = [makeUser({ utc_offset_hours: 5.5 })];
    mockAdmin.mockReturnValue(makeAdminClient(users) as never);
    await GET(validReq());
    expect(mockEmail).toHaveBeenCalledTimes(1);
  });

  it("returns correct sent and skipped counts for mixed user set", async () => {
    const eligible  = makeUser();
    const optedOut  = makeUser({ notification_prefs: { motivation_emails: false } });
    optedOut.id = "uid-2"; optedOut.email = "opt-out@test.com";
    mockAdmin.mockReturnValue(
      // Return two pages, second = eligible + opted-out, then empty to end loop
      {
        auth: {
          admin: {
            listUsers: vi.fn()
              .mockResolvedValueOnce({ data: { users: [eligible, optedOut] }, error: null })
              .mockResolvedValue({ data: { users: [] }, error: null }),
            updateUserById: vi.fn().mockResolvedValue({ data: {}, error: null }),
          },
        },
        from: vi.fn().mockImplementation(() => countChain(50)),
      } as never
    );
    const res = await GET(validReq());
    const body = await res.json();
    expect(body.sent).toBe(1);
    expect(body.skipped).toBeGreaterThanOrEqual(1);
  });
});
