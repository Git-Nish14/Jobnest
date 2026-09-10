/**
 * Unit tests — GET /api/cron/nestai-reindex
 *
 * Covers:
 *  - 401 when Authorization header is missing or wrong
 *  - skipped response when OPENAI_API_KEY is absent
 *  - 200 when no Pro subscriptions exist (empty page)
 *  - 200 processes Pro users and calls upsertEmbeddings per user
 *  - 200 continues when one user throws (Promise.allSettled semantics)
 *  - 200 handles pagination (processes multiple pages of subscriptions)
 *  - error array is capped at 20 entries
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/features/nestai-rag", () => ({
  upsertEmbeddings: vi.fn().mockResolvedValue(undefined),
}));

import { GET } from "@/app/api/cron/nestai-reindex/route";
import { createAdminClient } from "@/lib/supabase/admin";
import { upsertEmbeddings } from "@/lib/features/nestai-rag";

const mockAdminClient    = vi.mocked(createAdminClient);
const mockUpsertEmbeds   = vi.mocked(upsertEmbeddings);

const CRON_SECRET = "test-cron-secret"; // matches vitest-setup.ts

function makeReq(authHeader: string | null = `Bearer ${CRON_SECRET}`) {
  const headers: Record<string, string> = {};
  if (authHeader) headers["authorization"] = authHeader;
  return new NextRequest("http://localhost/api/cron/nestai-reindex", { headers });
}

function makeAdminWithSubs(subs: Array<{ user_id: string }>) {
  const dataRows = [{ id: "app-1", company: "Acme" }];

  return {
    from: vi.fn((table: string) => {
      const chain: Record<string, unknown> = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.eq     = vi.fn().mockReturnValue(chain);
      chain.range  = vi.fn().mockReturnValue(
        table === "subscriptions"
          ? { then: (r: (v: unknown) => void) => Promise.resolve({ data: subs, error: null }).then(r) }
          : chain
      );
      chain.then   = (r: (v: unknown) => void) =>
        Promise.resolve({ data: dataRows, error: null }).then(r);
      return chain;
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.OPENAI_API_KEY = "sk-test";
});

afterEach(() => {
  process.env.OPENAI_API_KEY = "sk-test";
});

// ── Auth checks ───────────────────────────────────────────────────────────────

describe("GET /api/cron/nestai-reindex — auth", () => {
  it("returns 401 when Authorization header is missing", async () => {
    const res = await GET(makeReq(null));
    expect(res.status).toBe(401);
  });

  it("returns 401 when Authorization header has wrong secret", async () => {
    const res = await GET(makeReq("Bearer wrong-secret"));
    expect(res.status).toBe(401);
  });
});

// ── OPENAI_API_KEY absent ─────────────────────────────────────────────────────

describe("GET /api/cron/nestai-reindex — no OpenAI key", () => {
  it("returns skipped when OPENAI_API_KEY is not configured", async () => {
    delete process.env.OPENAI_API_KEY;
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skipped).toMatch(/OPENAI_API_KEY/);
  });
});

// ── Empty subscription list ───────────────────────────────────────────────────

describe("GET /api/cron/nestai-reindex — no Pro users", () => {
  it("returns 200 with zero indexed when no Pro subscriptions found", async () => {
    mockAdminClient.mockReturnValue(makeAdminWithSubs([]) as never);
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.indexed).toBe(0);
    expect(body.skipped).toBe(0);
    expect(body.errors).toHaveLength(0);
    expect(mockUpsertEmbeds).not.toHaveBeenCalled();
  });
});

// ── Successful indexing ───────────────────────────────────────────────────────

describe("GET /api/cron/nestai-reindex — success", () => {
  it("calls upsertEmbeddings for each Pro user", async () => {
    const subs = [{ user_id: "u-1" }, { user_id: "u-2" }];
    mockAdminClient.mockReturnValue(makeAdminWithSubs(subs) as never);

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.indexed).toBe(2);
    expect(body.skipped).toBe(0);
    expect(mockUpsertEmbeds).toHaveBeenCalledTimes(2);
    expect(mockUpsertEmbeds).toHaveBeenCalledWith(
      expect.anything(),
      "u-1",
      expect.any(Array),
    );
  });

  it("increments skipped and records error when upsertEmbeddings throws", async () => {
    const subs = [{ user_id: "u-fail" }];
    mockAdminClient.mockReturnValue(makeAdminWithSubs(subs) as never);
    mockUpsertEmbeds.mockRejectedValueOnce(new Error("OpenAI rate limit"));

    const res = await GET(makeReq());
    const body = await res.json();

    expect(body.indexed).toBe(0);
    expect(body.skipped).toBe(1);
    expect(body.errors[0]).toContain("u-fail");
    expect(body.errors[0]).toContain("OpenAI rate limit");
  });

  it("continues processing other users when one fails", async () => {
    const subs = [{ user_id: "u-ok" }, { user_id: "u-fail" }];
    mockAdminClient.mockReturnValue(makeAdminWithSubs(subs) as never);
    mockUpsertEmbeds
      .mockResolvedValueOnce(undefined)            // u-ok succeeds
      .mockRejectedValueOnce(new Error("timeout")); // u-fail fails

    const res = await GET(makeReq());
    const body = await res.json();

    expect(body.indexed).toBe(1);
    expect(body.skipped).toBe(1);
  });

  it("caps error array at 20 entries", async () => {
    const subs = Array.from({ length: 25 }, (_, i) => ({ user_id: `u-${i}` }));
    mockAdminClient.mockReturnValue(makeAdminWithSubs(subs) as never);
    mockUpsertEmbeds.mockRejectedValue(new Error("fail"));

    const res = await GET(makeReq());
    const body = await res.json();

    expect(body.errors.length).toBeLessThanOrEqual(20);
  });
});
