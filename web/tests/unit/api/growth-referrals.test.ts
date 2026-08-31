import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeChain } from "@/tests/helpers/supabase-mock";

// ── Mocks (hoisted) ───────────────────────────────────────────────────────────
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin",  () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/security/csrf",       () => ({ verifyOrigin:  vi.fn().mockReturnValue(true) }));

import { GET, POST } from "@/app/api/referrals/route";
import { createClient }      from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit }    from "@/lib/security/rate-limit";
import { verifyOrigin }      from "@/lib/security/csrf";

const mockCreate       = vi.mocked(createClient);
const mockAdminCreate  = vi.mocked(createAdminClient);
const mockCheckRL      = vi.mocked(checkRateLimit);
const mockVerifyOrigin = vi.mocked(verifyOrigin);

const USER_ID = "user-bbbb-2222-0000-0000-000000000000";

const CODE_ROW = {
  code: "a1b2c3d4",
  click_count: 5,
  signup_count: 2,
  converted_count: 1,
  created_at: "2026-01-01T00:00:00Z",
};

const EVENT_ROW = {
  status: "signed_up",
  reward_granted: false,
  created_at: "2026-06-01T00:00:00Z",
};

// ── Helper: build the auth (server) client ────────────────────────────────────

function makeAuthClient(user: unknown) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    from: vi.fn().mockReturnValue(makeChain({ data: null, error: null })),
  };
}

// ── Helper: build a self-referential chain ────────────────────────────────────
// makeChain's internal chain methods return its OWN `self` — so spreading it
// and overriding single/maybeSingle breaks chains that start with .insert().
// We build a proper self-referential chain from scratch so every method
// returns the same outer object, ensuring .insert().select().single() works.

function makeSelfChain(opts: {
  maybeSingleResult?: unknown;
  singleResult?: unknown;
  thenResult?: unknown;
} = {}): Record<string, unknown> {
  const {
    maybeSingleResult = { data: null, error: null },
    singleResult      = { data: null, error: null },
    thenResult        = { data: null, error: null },
  } = opts;

  const self: Record<string, unknown> = {};
  const ret = () => vi.fn().mockReturnValue(self);

  self.select     = ret();
  self.insert     = ret();
  self.update     = ret();
  self.delete     = ret();
  self.upsert     = ret();
  self.eq         = ret();
  self.neq        = ret();
  self.order      = ret();
  self.limit      = ret();
  self.offset     = ret();
  self.maybeSingle = vi.fn().mockResolvedValue(maybeSingleResult);
  self.single      = vi.fn().mockResolvedValue(singleResult);
  // Make the chain itself awaitable (for .insert/.update that use await chain)
  self.then = (resolve: (v: unknown) => void, reject: (r: unknown) => void) =>
    Promise.resolve(thenResult).then(resolve, reject);

  return self;
}

// ── Helper: build the admin client with per-table dispatch ────────────────────

function makeAdmin(opts: {
  codeRow?: unknown;
  insertedRow?: unknown;
  insertErr?: unknown;
  events?: unknown[];
  rpcErr?: unknown;
} = {}) {
  const {
    codeRow     = CODE_ROW,
    insertedRow = CODE_ROW,
    insertErr   = null,
    events      = [EVENT_ROW],
    rpcErr      = null,
  } = opts;

  // One chain for all user_referral_codes access:
  // maybeSingleResult = existing code row (or null if lazy-create test)
  // singleResult      = inserted row (used by .insert().select().single())
  const codeChain = makeSelfChain({
    maybeSingleResult: { data: codeRow,     error: null      },
    singleResult:      { data: insertedRow, error: insertErr },
  });

  const eventsChain = makeSelfChain({
    thenResult: { data: events, error: null },
  });

  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "user_referral_codes")  return codeChain;
      if (table === "user_referral_events") return eventsChain;
      return makeSelfChain();
    }),
    rpc: vi.fn().mockResolvedValue({ data: null, error: rpcErr }),
  };
}

function getReq() {
  return new Request("http://localhost/api/referrals", { method: "GET" });
}

function postReq(body: unknown) {
  return new Request("http://localhost/api/referrals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRL.mockReturnValue({ allowed: true, remaining: 19, resetTime: Date.now() + 60_000 });
  mockVerifyOrigin.mockReturnValue(true);
  mockCreate.mockResolvedValue(makeAuthClient({ id: USER_ID }) as never);
  mockAdminCreate.mockReturnValue(makeAdmin() as never);
});

// ── GET /api/referrals — auth ─────────────────────────────────────────────────

describe("GET /api/referrals — auth guard", () => {
  it("returns 401 when unauthenticated", async () => {
    mockCreate.mockResolvedValue(makeAuthClient(null) as never);
    const res = await GET(getReq() as never);
    expect(res.status).toBe(401);
  });
});

// ── GET /api/referrals — rate limit ──────────────────────────────────────────

describe("GET /api/referrals — rate limit", () => {
  it("returns 429 when rate limited", async () => {
    mockCheckRL.mockReturnValue({ allowed: false, remaining: 0, resetTime: Date.now() + 60_000 });
    const res = await GET(getReq() as never);
    expect(res.status).toBe(429);
  });
});

// ── GET /api/referrals — happy path ──────────────────────────────────────────

describe("GET /api/referrals — happy path", () => {
  it("returns 200 with code, referralUrl, stats, events", async () => {
    const res = await GET(getReq() as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.code).toBe("a1b2c3d4");
    expect(body.referralUrl).toMatch(/\/signup\?ref=a1b2c3d4$/);
    expect(body.stats).toEqual({ clicks: 5, signups: 2, converted: 1 });
    expect(body.events).toHaveLength(1);
    expect(body.events[0].status).toBe("signed_up");
  });

  it("referralUrl always contains the code", async () => {
    const res = await GET(getReq() as never);
    const body = await res.json();
    expect(body.referralUrl).toContain(body.code);
  });

  it("lazily creates code when none exists and returns 200", async () => {
    mockAdminCreate.mockReturnValue(
      makeAdmin({ codeRow: null, insertedRow: CODE_ROW }) as never,
    );
    const res = await GET(getReq() as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.code).toBe("a1b2c3d4");
  });

  it("returns 500 when lazy code creation fails", async () => {
    mockAdminCreate.mockReturnValue(
      makeAdmin({ codeRow: null, insertedRow: null, insertErr: { message: "db error" } }) as never,
    );
    const res = await GET(getReq() as never);
    expect(res.status).toBe(500);
  });

  it("events are capped at 100 (limit chain method called on events table)", async () => {
    const admin = makeAdmin();
    mockAdminCreate.mockReturnValue(admin as never);
    await GET(getReq() as never);
    // Verify that the events chain's .limit() was called (any argument)
    const calls = admin.from.mock.calls.map((c: unknown[]) => c[0]);
    const eventsIdx = calls.findLastIndex((t: unknown) => t === "user_referral_events");
    expect(eventsIdx).toBeGreaterThanOrEqual(0);
    const eventsChain = admin.from.mock.results[eventsIdx]?.value as Record<string, unknown>;
    expect(vi.isMockFunction(eventsChain?.limit)).toBe(true);
    expect((eventsChain.limit as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0);
  });
});

// ── POST /api/referrals — CSRF ────────────────────────────────────────────────

describe("POST /api/referrals — CSRF", () => {
  it("returns 403 when origin is invalid", async () => {
    mockVerifyOrigin.mockReturnValue(false);
    const res = await POST(postReq({ code: "a1b2c3d4" }) as never);
    expect(res.status).toBe(403);
  });
});

// ── POST /api/referrals — rate limit ─────────────────────────────────────────

describe("POST /api/referrals — rate limit", () => {
  it("returns 429 when rate limited", async () => {
    mockCheckRL.mockReturnValue({ allowed: false, remaining: 0, resetTime: Date.now() + 60_000 });
    const res = await POST(postReq({ code: "a1b2c3d4" }) as never);
    expect(res.status).toBe(429);
  });
});

// ── POST /api/referrals — validation ─────────────────────────────────────────

describe("POST /api/referrals — code validation", () => {
  it("returns 400 for missing code", async () => {
    const res = await POST(postReq({}) as never);
    expect(res.status).toBe(400);
  });

  it("returns 400 for code shorter than 8 hex chars", async () => {
    const res = await POST(postReq({ code: "abc123" }) as never);
    expect(res.status).toBe(400);
  });

  it("returns 400 for code with non-hex characters", async () => {
    const res = await POST(postReq({ code: "zzzzzzzz" }) as never);
    expect(res.status).toBe(400);
  });

  it("returns 400 for code longer than 8 hex chars", async () => {
    const res = await POST(postReq({ code: "a1b2c3d4e5" }) as never);
    expect(res.status).toBe(400);
  });

  it("accepts uppercase hex by lowercasing", async () => {
    // The route does .trim().toLowerCase() before validation
    const res = await POST(postReq({ code: "A1B2C3D4" }) as never);
    expect(res.status).toBe(200);
  });
});

// ── POST /api/referrals — happy path ─────────────────────────────────────────

describe("POST /api/referrals — happy path", () => {
  it("returns 200 with { ok: true } for a valid 8-char hex code", async () => {
    const res = await POST(postReq({ code: "a1b2c3d4" }) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("calls rpc increment_referral_clicks", async () => {
    const admin = makeAdmin();
    mockAdminCreate.mockReturnValue(admin as never);
    await POST(postReq({ code: "a1b2c3d4" }) as never);
    expect(admin.rpc).toHaveBeenCalledWith(
      "increment_referral_clicks",
      { p_code: "a1b2c3d4" },
    );
  });

  it("returns 200 even if rpc call fails (fire-and-forget, unknown code = no-op)", async () => {
    mockAdminCreate.mockReturnValue(
      makeAdmin({ rpcErr: { message: "not found" } }) as never,
    );
    const res = await POST(postReq({ code: "deadbeef" }) as never);
    expect(res.status).toBe(200);
  });
});
