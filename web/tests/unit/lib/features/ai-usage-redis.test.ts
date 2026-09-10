/**
 * Unit tests — checkAndReserveTokens & recordRedisOutputTokens
 *
 * Covers the Redis INCRBY atomic token cap logic introduced in the Sep 2026
 * sprint. External fetch (Upstash REST API) and the Supabase DB fallback are
 * both mocked so no live infrastructure is required.
 *
 * Test matrix:
 *  - Redis available, cap not reached → allowed
 *  - Redis available, cap exceeded → denied + DECRBY undo
 *  - DECRBY fails silently (inflated counter logged)
 *  - Redis unavailable → DB fallback, allowed
 *  - Redis unavailable → DB fallback, denied
 *  - Redis unavailable AND DB error → returns null (503 gate)
 *  - recordRedisOutputTokens fires INCRBY + EXPIREAT
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the DB dependency so getDailyTokenUsage works without Supabase
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    rpc: vi.fn().mockResolvedValue({ data: 0, error: null }),
  })),
}));

import { checkAndReserveTokens, recordRedisOutputTokens } from "@/lib/features/ai-usage";
import { createAdminClient } from "@/lib/supabase/admin";

const mockAdmin = vi.mocked(createAdminClient);

// VAPID env stub so the module initialises without errors
const REDIS_URL   = "https://fake.upstash.io";
const REDIS_TOKEN = "fake-token";

function setRedisEnv(enabled = true) {
  if (enabled) {
    process.env.UPSTASH_REDIS_REST_URL   = REDIS_URL;
    process.env.UPSTASH_REDIS_REST_TOKEN = REDIS_TOKEN;
  } else {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  }
}

function mockPipelineResponse(results: unknown[]) {
  global.fetch = vi.fn().mockResolvedValue({
    ok:   true,
    json: () => Promise.resolve(results.map((r) => ({ result: r }))),
  } as unknown as Response);
}

const USER_ID = "user-redis-test-aabbcc";
const CAP     = 100_000;

beforeEach(() => {
  vi.clearAllMocks();
  setRedisEnv(true);
});

afterEach(() => {
  delete (global as Record<string, unknown>).fetch;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

// ── Happy path ────────────────────────────────────────────────────────────────

describe("checkAndReserveTokens — Redis available", () => {
  it("returns allowed:true when INCRBY result is within cap", async () => {
    // Pipeline returns [newTotal=50000, expireResult=1]
    mockPipelineResponse([50_000, 1]);

    const result = await checkAndReserveTokens(USER_ID, CAP, 10_000);

    expect(result).not.toBeNull();
    expect(result!.allowed).toBe(true);
    expect(result!.used).toBe(50_000);
    expect(result!.midnightTs).toBeGreaterThan(0);
  });

  it("returns allowed:false and fires DECRBY when INCRBY exceeds cap", async () => {
    // First pipeline (INCRBY + EXPIREAT): over cap
    // Second pipeline (DECRBY): success
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ result: 110_000 }, { result: 1 }]),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ result: 100_000 }]),
      } as unknown as Response);

    const result = await checkAndReserveTokens(USER_ID, CAP, 10_000);

    expect(result).not.toBeNull();
    expect(result!.allowed).toBe(false);
    // used = newTotal - tokens = 110_000 - 10_000 = 100_000
    expect(result!.used).toBe(100_000);

    // Two fetch calls: one for INCRBY, one for DECRBY
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("logs error and still returns denied when DECRBY pipeline fails", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ result: 110_000 }, { result: 1 }]),
      } as unknown as Response)
      // DECRBY pipeline fails
      .mockRejectedValueOnce(new Error("Redis timeout"));

    const result = await checkAndReserveTokens(USER_ID, CAP, 10_000);

    expect(result!.allowed).toBe(false);
    expect(errSpy).toHaveBeenCalledWith(
      expect.stringContaining("DECRBY failed"),
      expect.stringContaining(USER_ID)
    );
    errSpy.mockRestore();
  });
});

// ── DB fallback ───────────────────────────────────────────────────────────────

describe("checkAndReserveTokens — Redis unavailable (DB fallback)", () => {
  beforeEach(() => setRedisEnv(false));

  it("returns allowed:true via DB when usage + tokens ≤ cap", async () => {
    mockAdmin.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: 50_000, error: null }),
    } as never);

    const result = await checkAndReserveTokens(USER_ID, CAP, 10_000);

    expect(result).not.toBeNull();
    expect(result!.allowed).toBe(true);
    expect(result!.used).toBe(60_000);
  });

  it("returns allowed:false via DB when usage + tokens > cap", async () => {
    mockAdmin.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: 95_000, error: null }),
    } as never);

    const result = await checkAndReserveTokens(USER_ID, CAP, 10_000);

    expect(result!.allowed).toBe(false);
    expect(result!.used).toBe(95_000);
  });

  it("returns null when DB also errors (fail-closed for 503 gate)", async () => {
    mockAdmin.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "DB down" } }),
    } as never);

    const result = await checkAndReserveTokens(USER_ID, CAP, 10_000);
    expect(result).toBeNull();
  });
});

// ── Output token recording ────────────────────────────────────────────────────

describe("recordRedisOutputTokens", () => {
  it("fires INCRBY + EXPIREAT pipeline with the provided midnightTs", async () => {
    mockPipelineResponse([1234, 1]);

    await recordRedisOutputTokens(USER_ID, 500, 9_999_999);

    expect(global.fetch).toHaveBeenCalledOnce();
    const body = JSON.parse(
      (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string
    ) as unknown[][];
    // Should include INCRBY and EXPIREAT commands
    expect(body.some((cmd) => cmd[0] === "INCRBY" && cmd[2] === 500)).toBe(true);
    expect(body.some((cmd) => cmd[0] === "EXPIREAT" && cmd[2] === 9_999_999)).toBe(true);
  });

  it("silently succeeds when Redis is not configured", async () => {
    setRedisEnv(false);
    global.fetch = vi.fn();
    await recordRedisOutputTokens(USER_ID, 200, 0);
    // No fetch call — no Redis env vars
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
