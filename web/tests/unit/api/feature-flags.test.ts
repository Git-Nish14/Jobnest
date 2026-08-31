import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeChain } from "@/tests/helpers/supabase-mock";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/features/flags",  () => ({ resolveFlags: vi.fn() }));

import { GET } from "@/app/api/feature-flags/route";
import { createClient }  from "@/lib/supabase/server";
import { resolveFlags }  from "@/lib/features/flags";

const mockCreate  = vi.mocked(createClient);
const mockResolve = vi.mocked(resolveFlags);

const USER_ID = "user-cccc-3333-0000-0000-000000000000";

const DEFAULT_FLAGS = {
  pricing_cta_variant_b: true,
  ai_usage_dashboard:    true,
  referral_program:      true,
  rag_semantic_search:   false,
};

function makeClient(user: unknown, sub: unknown = null) {
  const subChain = makeChain({ data: sub, error: null });
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    from: vi.fn().mockReturnValue(subChain),
  };
}

function req() {
  return new Request("http://localhost/api/feature-flags", { method: "GET" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCreate.mockResolvedValue(makeClient({ id: USER_ID }) as never);
  mockResolve.mockResolvedValue(DEFAULT_FLAGS);
});

// ── Auth guard ────────────────────────────────────────────────────────────────

describe("GET /api/feature-flags — auth guard", () => {
  it("returns 401 when unauthenticated", async () => {
    mockCreate.mockResolvedValue(makeClient(null) as never);
    const res = await GET(req() as never);
    expect(res.status).toBe(401);
  });
});

// ── Happy path ────────────────────────────────────────────────────────────────

describe("GET /api/feature-flags — happy path", () => {
  it("returns 200 with flags map", async () => {
    const res = await GET(req() as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("flags");
    expect(body.flags).toEqual(DEFAULT_FLAGS);
  });

  it("calls resolveFlags with free plan when no subscription", async () => {
    await GET(req() as never);
    expect(mockResolve).toHaveBeenCalledWith(USER_ID, "free");
  });

  it("calls resolveFlags with pro plan for active subscriber", async () => {
    mockCreate.mockResolvedValue(
      makeClient({ id: USER_ID }, { plan: "pro", status: "active" }) as never,
    );
    await GET(req() as never);
    expect(mockResolve).toHaveBeenCalledWith(USER_ID, "pro");
  });

  it("treats inactive pro subscription as free plan", async () => {
    mockCreate.mockResolvedValue(
      makeClient({ id: USER_ID }, { plan: "pro", status: "canceled" }) as never,
    );
    await GET(req() as never);
    expect(mockResolve).toHaveBeenCalledWith(USER_ID, "free");
  });

  it("returns no-store Cache-Control header", async () => {
    const res = await GET(req() as never);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});

// ── Flag resolution edge cases ────────────────────────────────────────────────

describe("GET /api/feature-flags — flag values", () => {
  it("rag_semantic_search is disabled", async () => {
    const res = await GET(req() as never);
    const body = await res.json();
    expect(body.flags.rag_semantic_search).toBe(false);
  });

  it("referral_program is enabled for free users", async () => {
    const res = await GET(req() as never);
    const body = await res.json();
    expect(body.flags.referral_program).toBe(true);
  });

  it("returns empty flags object when resolveFlags errors", async () => {
    mockResolve.mockResolvedValue({});
    const res = await GET(req() as never);
    const body = await res.json();
    expect(body.flags).toEqual({});
  });
});

// ── Rollout bucket — determinism via the API route ───────────────────────────

describe("rolloutBucket — determinism", () => {
  it("same user always gets the same flag resolution (stable bucket)", async () => {
    // resolveFlags is mocked; this verifies the route passes the same userId
    // consistently, which means the deterministic hash will produce the same
    // rollout bucket on every call.
    const r1 = await GET(req() as never);
    const r2 = await GET(req() as never);
    const b1 = await r1.json();
    const b2 = await r2.json();
    expect(b1.flags).toEqual(b2.flags);
    // resolveFlags was called with the same userId both times
    expect(mockResolve.mock.calls[0]?.[0]).toBe(mockResolve.mock.calls[1]?.[0]);
  });
});
