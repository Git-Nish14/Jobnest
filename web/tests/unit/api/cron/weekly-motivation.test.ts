/**
 * Unit tests — GET /api/cron/weekly-motivation
 *
 * Schedule: "0 9 * * 3" (Wednesday 09:00 UTC, once-per-week, Hobby-plan compatible).
 * The cron expression itself ensures Wednesday delivery — the handler does NOT
 * filter by day-of-week or local hour. It only checks:
 *  - CRON_SECRET auth
 *  - user has an email
 *  - user has not opted out (notification_prefs.motivation_emails !== false)
 *  - user is active (last_sign_in_at within 30 days)
 *  - ISO week dedup (motivation_sent_week !== current week key)
 *  - user has at least 1 application
 *
 * Covers:
 *  - 401 when Authorization header is missing
 *  - 401 when secret is wrong
 *  - Skips user with no email
 *  - Skips opted-out user (notification_prefs.motivation_emails === false)
 *  - Skips inactive users (last_sign_in_at > 30 days ago)
 *  - Skips user who already received email this ISO week (motivation_sent_week matches)
 *  - Skips user with 0 total applications
 *  - Sends email to eligible user and updates motivation_sent_week
 *  - Returns correct sent/skipped counts for mixed user set
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

// Fix the system clock to Wednesday Jan 7 2026 09:00 UTC (matches the cron schedule).
// getIsoWeek(Jan 7 2026) = 2, so weekKey = "2026-W2".
const WEDNESDAY_MS = Date.UTC(2026, 0, 7, 9, 0, 0);

// Reference point for computing relative signin dates
const WEDNESDAY_DATE = new Date(WEDNESDAY_MS);
const INACTIVE_SIGNIN = new Date(WEDNESDAY_DATE.getTime() - 31 * 86_400_000).toISOString();
const ACTIVE_SIGNIN   = new Date(WEDNESDAY_DATE.getTime() - 5  * 86_400_000).toISOString();

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
  vi.setSystemTime(WEDNESDAY_MS);
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
    const users = [{ id: "uid-1", email: undefined, last_sign_in_at: ACTIVE_SIGNIN, user_metadata: {} }];
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
    const u = makeUser();
    u.last_sign_in_at = INACTIVE_SIGNIN;
    mockAdmin.mockReturnValue(makeAdminClient([u]) as never);
    await GET(validReq());
    expect(mockEmail).not.toHaveBeenCalled();
  });

  it("skips user who already received motivation email this ISO week", async () => {
    const users = [makeUser({ motivation_sent_week: "2026-W2" })];
    mockAdmin.mockReturnValue(makeAdminClient(users) as never);
    await GET(validReq());
    expect(mockEmail).not.toHaveBeenCalled();
  });

  it("skips user with 0 total applications", async () => {
    const users = [makeUser()];
    mockAdmin.mockReturnValue(
      makeAdminClient(users, { total: 0, week: 0, responded: 0, pipeline: 0, offers: 0 }) as never
    );
    await GET(validReq());
    expect(mockEmail).not.toHaveBeenCalled();
  });
});

// ── Happy path ────────────────────────────────────────────────────────────────

describe("GET /api/cron/weekly-motivation — happy path", () => {
  it("sends email to eligible user and returns sent:1", async () => {
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

  it("updates motivation_sent_week to current ISO week key after send", async () => {
    const users = [makeUser()];
    const client = makeAdminClient(users);
    mockAdmin.mockReturnValue(client as never);

    await GET(validReq());

    expect(client._updateUserById).toHaveBeenCalledWith(
      "uid-1",
      expect.objectContaining({
        user_metadata: expect.objectContaining({
          motivation_sent_week: "2026-W2",
        }),
      })
    );
  });

  it("does not re-send when motivation_sent_week already matches this week", async () => {
    // Simulate a second cron fire in the same week
    const users = [makeUser({ motivation_sent_week: "2026-W2" })];
    mockAdmin.mockReturnValue(makeAdminClient(users) as never);
    await GET(validReq());
    expect(mockEmail).not.toHaveBeenCalled();
  });

  it("does send the following week when motivation_sent_week is from last week", async () => {
    // "2026-W1" is a previous week — should not block sending in week 2
    const users = [makeUser({ motivation_sent_week: "2026-W1" })];
    mockAdmin.mockReturnValue(makeAdminClient(users) as never);
    await GET(validReq());
    expect(mockEmail).toHaveBeenCalledTimes(1);
  });

  it("returns correct sent and skipped counts for mixed user set", async () => {
    const eligible = makeUser();
    const optedOut = { ...makeUser({ notification_prefs: { motivation_emails: false } }), id: "uid-2", email: "opt@test.com" };

    mockAdmin.mockReturnValue({
      auth: {
        admin: {
          listUsers: vi.fn()
            .mockResolvedValueOnce({ data: { users: [eligible, optedOut] }, error: null })
            .mockResolvedValue({ data: { users: [] }, error: null }),
          updateUserById: vi.fn().mockResolvedValue({ data: {}, error: null }),
        },
      },
      from: vi.fn().mockImplementation(() => countChain(50)),
    } as never);

    const res = await GET(validReq());
    const body = await res.json();
    expect(body.sent).toBe(1);
    expect(body.skipped).toBeGreaterThanOrEqual(1);
  });
});
