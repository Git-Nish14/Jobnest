/**
 * Unit tests for NESTAi daily token cap behaviour and pre-stream recording.
 *
 * Tests for two security fixes shipped in the August 2026 sprint:
 *
 *  1. capK formatting — Pro plan cap (2 000 000 tokens) must display as "2M",
 *     not "2,000k" (garbled units). Free plan (100 000) must display as "100k".
 *
 *  2. Pre-stream token reservation — `recordTokenUsage` must be called with
 *     the estimated input token count BEFORE the Groq stream starts, so that:
 *       a. Concurrent requests see an updated balance (narrows the TOCTOU window).
 *       b. A client disconnect (which kills flush()) still records input costs.
 *
 * We test these by hitting the POST /api/nesta-ai route directly, mocking all
 * external dependencies (Supabase, rate-limit, Groq, token-usage helpers).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeChain } from "@/tests/helpers/supabase-mock";

// ── Mocks (hoisted) ───────────────────────────────────────────────────────────
vi.mock("@/lib/supabase/server",        () => ({ createClient: vi.fn() }));
vi.mock("@/lib/security/rate-limit",    () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/security/csrf",          () => ({ verifyOrigin: vi.fn().mockReturnValue(true) }));
vi.mock("@/lib/features/nestai-rag",    () => ({ buildRagContext: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/utils/document-parser",  () => ({ extractAllDocuments: vi.fn().mockResolvedValue([]) }));
vi.mock("@/lib/features/ai-usage", () => ({
  TOKEN_CAPS:              { free: 100_000, pro: 2_000_000 },
  getDailyTokenUsage:      vi.fn(),
  checkAndReserveTokens:   vi.fn().mockResolvedValue({ allowed: true, used: 0, midnightTs: 0 }),
  recordTokenUsage:        vi.fn().mockResolvedValue(undefined),
  recordRedisOutputTokens: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "@/app/api/nesta-ai/route";
import { createClient }       from "@/lib/supabase/server";
import { checkRateLimit }     from "@/lib/security/rate-limit";
import { getDailyTokenUsage, checkAndReserveTokens, recordTokenUsage } from "@/lib/features/ai-usage";

const mockCreate         = vi.mocked(createClient);
const mockCheckRL        = vi.mocked(checkRateLimit);
const mockDailyUsage     = vi.mocked(getDailyTokenUsage);
const mockReserve        = vi.mocked(checkAndReserveTokens);
const mockRecordUsage    = vi.mocked(recordTokenUsage);

const USER_ID = "user-cap-test-000000000000";

function makeClient(userId: string, isPro = false) {
  const subChain = makeChain({
    data: isPro ? { plan: "pro", status: "active" } : null,
    error: null,
  });
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId, user_metadata: {} } }, error: null }) },
    from: vi.fn().mockReturnValue(subChain),
    rpc: vi.fn().mockResolvedValue({ data: 0, error: null }),
  };
}

function makePostRequest(question = "What applications do I have?") {
  return new Request("http://localhost/api/nesta-ai", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:3000",
    },
    body: JSON.stringify({ question, history: [], sessionId: null }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRL.mockReturnValue({ allowed: true, remaining: 29, resetTime: Date.now() + 60_000 });
  mockCreate.mockResolvedValue(makeClient(USER_ID) as never);
  mockDailyUsage.mockResolvedValue(0);
  // Default: atomic reservation succeeds (cap not reached)
  mockReserve.mockResolvedValue({ allowed: true, used: 0, midnightTs: 0 });
});

// ── Cap label formatting ──────────────────────────────────────────────────────

describe("daily cap 429 — capLabel formatting", () => {
  it("free plan (100k cap) formats as '100k tokens'", async () => {
    mockDailyUsage.mockResolvedValue(100_000); // exactly at cap
    const res = await POST(makePostRequest() as never);
    expect(res.status).toBe(429);
    const body = await res.json();
    // Must NOT contain "100,000k" or any comma-number + k garble
    expect(body.error).toMatch(/100k/i);
    expect(body.error).not.toMatch(/,000k/i);
  });

  it("pro plan (2M cap) formats as '2M tokens', never '2,000k'", async () => {
    mockCreate.mockResolvedValue(makeClient(USER_ID, true) as never);
    mockDailyUsage.mockResolvedValue(2_000_000); // exactly at cap
    const res = await POST(makePostRequest() as never);
    expect(res.status).toBe(429);
    const body = await res.json();
    // Must show "2M", not garbled "2,000k"
    expect(body.error).toMatch(/2M/i);
    expect(body.error).not.toMatch(/2,000k/i);
    expect(body.error).not.toMatch(/,000k/i);
  });

  it("cap 429 body includes code, used, and cap fields", async () => {
    mockDailyUsage.mockResolvedValue(100_000);
    const res = await POST(makePostRequest() as never);
    const body = await res.json();
    expect(body).toHaveProperty("code", "DAILY_CAP_REACHED");
    expect(body).toHaveProperty("used", 100_000);
    expect(body).toHaveProperty("cap",  100_000);
  });
});

// ── Atomic pre-stream reservation (Redis INCRBY) ─────────────────────────────

describe("atomic pre-stream reservation", () => {
  function makeGroqStream(content = "Hi") {
    const sseBody =
      `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\ndata: [DONE]\n\n`;
    const stream = new ReadableStream({
      start(c) { c.enqueue(new TextEncoder().encode(sseBody)); c.close(); },
    });
    return { ok: true, status: 200, body: stream, json: vi.fn() } as unknown as Response;
  }

  it("checkAndReserveTokens is called with inputTokens > 0 before streaming", async () => {
    process.env.GROQ_API_KEY = "gsk_test_key";
    global.fetch = vi.fn().mockResolvedValue(makeGroqStream());

    const res = await POST(makePostRequest() as never);
    if (res.body) {
      const reader = res.body.getReader();
      while (!(await reader.read()).done) { /* drain */ }
    }

    // checkAndReserveTokens must be called with (userId, cap, inputTokens > 0)
    expect(mockReserve).toHaveBeenCalledOnce();
    const [uid, cap, tokens] = mockReserve.mock.calls[0];
    expect(uid).toBe(USER_ID);
    expect(cap).toBe(100_000);   // free plan cap
    expect(tokens).toBeGreaterThan(0);

    // DB analytics record should also fire (fire-and-forget)
    const dbInputCall = mockRecordUsage.mock.calls.find(
      ([, , inputTok, outputTok]) => inputTok > 0 && outputTok === 0,
    );
    expect(dbInputCall).toBeDefined();

    delete process.env.GROQ_API_KEY;
    delete (global as Record<string, unknown>).fetch;
  });

  it("returns 429 and skips checkAndReserveTokens when preliminary DB cap is reached", async () => {
    // Preliminary gate (getDailyTokenUsage) triggers before messages are built
    mockDailyUsage.mockResolvedValue(100_000);
    const res = await POST(makePostRequest() as never);
    expect(res.status).toBe(429);
    // Atomic reservation must NOT be called — we already rejected
    expect(mockReserve).not.toHaveBeenCalled();
    expect(mockRecordUsage).not.toHaveBeenCalled();
  });

  it("returns 429 when atomic reservation is denied (concurrent cap-race scenario)", async () => {
    process.env.GROQ_API_KEY = "gsk_test_key";
    global.fetch = vi.fn().mockResolvedValue(makeGroqStream());
    // Preliminary gate passes (0 < 100k) but atomic check finds cap exceeded
    mockDailyUsage.mockResolvedValue(0);
    mockReserve.mockResolvedValue({ allowed: false, used: 99_500, midnightTs: 0 });

    const res = await POST(makePostRequest() as never);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.code).toBe("DAILY_CAP_REACHED");
    expect(body.used).toBe(99_500);
    // No DB record when denied
    expect(mockRecordUsage).not.toHaveBeenCalled();

    delete process.env.GROQ_API_KEY;
    delete (global as Record<string, unknown>).fetch;
  });

  it("returns 503 when both Redis and DB are unavailable (checkAndReserveTokens returns null)", async () => {
    process.env.GROQ_API_KEY = "gsk_test_key";
    global.fetch = vi.fn().mockResolvedValue(makeGroqStream());
    mockDailyUsage.mockResolvedValue(0);
    mockReserve.mockResolvedValue(null);   // null = complete outage

    const res = await POST(makePostRequest() as never);
    expect(res.status).toBe(503);

    delete process.env.GROQ_API_KEY;
    delete (global as Record<string, unknown>).fetch;
  });

  it("recordTokenUsage is NOT called when Groq API key is missing", async () => {
    const savedKey = process.env.GROQ_API_KEY;
    delete process.env.GROQ_API_KEY;
    await POST(makePostRequest() as never);
    expect(mockRecordUsage).not.toHaveBeenCalled();
    process.env.GROQ_API_KEY = savedKey;
  });
});
