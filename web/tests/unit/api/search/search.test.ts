/**
 * Unit tests — GET /api/search
 *
 * Covers:
 *   - 401 when unauthenticated
 *   - 429 when rate-limited
 *   - Empty results for queries shorter than 2 chars
 *   - Full-text search happy path (returns FT results, passes user_id filter)
 *   - Fallback to ilike when FT errors (migration not yet applied)
 *   - Fallback to ilike when FT returns zero results (prefix-match pass)
 *   - Query clamping to MAX_QUERY_LENGTH (100 chars)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: vi.fn() }));

import { GET } from "@/app/api/search/route";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";

const mockCreate = vi.mocked(createClient);
const mockRL     = vi.mocked(checkRateLimit);

const USER = { id: "uid-1", email: "u@test.com" };
const RESULTS = [
  { id: "app-1", company: "Acme Corp", position: "Engineer", status: "Applied", applied_date: "2024-03-01" },
];

/**
 * Build a chainable query mock that can simulate both the FT search call
 * and any ilike fallback call with independent results.
 */
function makeQueryChain(result: unknown) {
  const chain: Record<string, unknown> = {};
  const m = () => vi.fn().mockReturnValue(chain);
  chain.select     = m();
  chain.textSearch = m();
  chain.eq         = m();
  chain.or         = m();
  chain.order      = m();
  chain.limit      = m();
  chain.ilike      = m();
  chain.then = (resolve: (v: unknown) => void) =>
    Promise.resolve(result).then(resolve);
  return chain;
}

function makeClient(user: unknown, ftResult: unknown, iLikeResult?: unknown) {
  const ft      = makeQueryChain(ftResult);
  const ilike   = makeQueryChain(iLikeResult ?? { data: [], error: null });
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    from: vi.fn()
      .mockReturnValueOnce(ft)     // first from() → FT search
      .mockReturnValue(ilike),      // subsequent from() → ilike fallback
  };
}

function req(q: string) {
  return new NextRequest(`http://localhost/api/search?q=${encodeURIComponent(q)}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRL.mockReturnValue({ allowed: true, remaining: 29, resetTime: Date.now() + 60_000 });
});

describe("GET /api/search — auth & rate limit", () => {
  it("returns 401 when not authenticated", async () => {
    mockCreate.mockResolvedValue(makeClient(null, { data: null, error: null }) as never);
    const res = await GET(req("acme"));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate-limited", async () => {
    mockRL.mockReturnValue({ allowed: false, remaining: 0, resetTime: Date.now() + 60_000 });
    mockCreate.mockResolvedValue(makeClient(USER, { data: [], error: null }) as never);
    const res = await GET(req("acme"));
    expect(res.status).toBe(429);
  });
});

describe("GET /api/search — query length guard", () => {
  it("returns empty results for query shorter than 2 chars", async () => {
    mockCreate.mockResolvedValue(makeClient(USER, { data: RESULTS, error: null }) as never);
    const res = await GET(req("a"));
    expect(res.status).toBe(200);
    expect((await res.json()).results).toEqual([]);
  });

  it("returns empty results for empty query string", async () => {
    mockCreate.mockResolvedValue(makeClient(USER, { data: RESULTS, error: null }) as never);
    const res = await GET(req(""));
    expect(res.status).toBe(200);
    expect((await res.json()).results).toEqual([]);
  });

  it("clamps query to 100 chars and still succeeds", async () => {
    mockCreate.mockResolvedValue(makeClient(USER, { data: [], error: null }) as never);
    const res = await GET(req("a".repeat(200)));
    expect(res.status).toBe(200);
  });
});

describe("GET /api/search — full-text search path", () => {
  it("returns FT results on success", async () => {
    mockCreate.mockResolvedValue(
      makeClient(USER, { data: RESULTS, error: null }) as never
    );
    const res = await GET(req("acme corp"));
    expect(res.status).toBe(200);
    expect((await res.json()).results).toEqual(RESULTS);
  });

  it("passes user_id filter on the FT query (eq called on chain)", async () => {
    const client = makeClient(USER, { data: RESULTS, error: null });
    mockCreate.mockResolvedValue(client as never);
    await GET(req("engineer"));
    // The FT chain's .eq() must have been called with "user_id" at some point
    const ftChain = (client.from as ReturnType<typeof vi.fn>).mock.results[0]?.value as Record<string, ReturnType<typeof vi.fn>>;
    expect((ftChain.eq as ReturnType<typeof vi.fn>).mock.calls.some((c) => c[0] === "user_id")).toBe(true);
  });
});

describe("GET /api/search — ilike fallback paths", () => {
  it("falls back to ilike when FT errors (migration not applied)", async () => {
    mockCreate.mockResolvedValue(
      makeClient(
        USER,
        { data: null, error: { message: "column search_vector does not exist" } },
        { data: RESULTS, error: null }
      ) as never
    );
    const res = await GET(req("acme"));
    expect(res.status).toBe(200);
    expect((await res.json()).results).toEqual(RESULTS);
  });

  it("falls back to ilike when FT returns zero results", async () => {
    mockCreate.mockResolvedValue(
      makeClient(
        USER,
        { data: [], error: null },
        { data: RESULTS, error: null }
      ) as never
    );
    const res = await GET(req("acme"));
    expect(res.status).toBe(200);
    expect((await res.json()).results).toEqual(RESULTS);
  });

  it("passes user_id filter on the ilike fallback query", async () => {
    // FT errors → ilike fallback fires
    const client = makeClient(
      USER,
      { data: null, error: { message: "fts error" } },
      { data: [], error: null }
    );
    mockCreate.mockResolvedValue(client as never);
    await GET(req("engineer"));

    const iLikeChain = (client.from as ReturnType<typeof vi.fn>).mock.results[1]?.value as Record<string, ReturnType<typeof vi.fn>>;
    expect((iLikeChain?.eq as ReturnType<typeof vi.fn>)?.mock.calls.some((c) => c[0] === "user_id")).toBe(true);
  });

  it("returns empty array when both FT and ilike produce no results", async () => {
    mockCreate.mockResolvedValue(
      makeClient(USER, { data: [], error: null }, { data: [], error: null }) as never
    );
    const res = await GET(req("xyzzy"));
    expect(res.status).toBe(200);
    expect((await res.json()).results).toEqual([]);
  });
});
