/**
 * Unit tests — POST /api/feedback
 *
 * Covers:
 *  - Origin check              → 403
 *  - Auth check                → 401
 *  - Rate limit                → 429
 *  - Invalid score (out of range, non-integer, missing) → 400
 *  - Comment too long          → 400
 *  - Insert failure            → 500
 *  - Happy path (score 0–10)   → 200
 *  - Comment is optional       → 200 without comment
 *  - Boundary scores (0 and 10) → 200
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeChain } from "@/tests/helpers/supabase-mock";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/security/csrf",       () => ({ verifyOrigin: vi.fn() }));

import { POST } from "@/app/api/feedback/route";
import { createClient }  from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyOrigin }  from "@/lib/security/csrf";

const mockCreate  = vi.mocked(createClient);
const mockRL      = vi.mocked(checkRateLimit);
const mockOrigin  = vi.mocked(verifyOrigin);

const USER_ID = "user-uuid-feedback";

function makeClient(user: unknown = { id: USER_ID }, insertError: unknown = null) {
  const chain = makeChain({ data: null, error: insertError });
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    from: vi.fn().mockReturnValue(chain),
  };
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockOrigin.mockReturnValue(true);
  mockRL.mockReturnValue({ allowed: true, remaining: 2, resetTime: Date.now() + 86400_000 });
  mockCreate.mockResolvedValue(makeClient() as never);
});

// ── Gates ─────────────────────────────────────────────────────────────────────

describe("POST /api/feedback — gates", () => {
  it("returns 403 when origin check fails", async () => {
    mockOrigin.mockReturnValue(false);
    const res = await POST(makeRequest({ score: 8 }));
    expect(res.status).toBe(403);
  });

  it("returns 401 when unauthenticated", async () => {
    mockCreate.mockResolvedValue(makeClient(null) as never);
    const res = await POST(makeRequest({ score: 8 }));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockRL.mockReturnValue({ allowed: false, remaining: 0, resetTime: Date.now() + 86400_000 });
    const res = await POST(makeRequest({ score: 8 }));
    expect(res.status).toBe(429);
  });
});

// ── Score validation ──────────────────────────────────────────────────────────

describe("POST /api/feedback — score validation", () => {
  it.each([0, 1, 5, 9, 10])("accepts score=%i (valid boundary or midpoint)", async (score) => {
    const res = await POST(makeRequest({ score }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("rejects score -1 (below minimum)", async () => {
    const res = await POST(makeRequest({ score: -1 }));
    expect(res.status).toBe(400);
  });

  it("rejects score 11 (above maximum)", async () => {
    const res = await POST(makeRequest({ score: 11 }));
    expect(res.status).toBe(400);
  });

  it("rejects non-integer score (float)", async () => {
    const res = await POST(makeRequest({ score: 4.5 }));
    expect(res.status).toBe(400);
  });

  it("rejects string score", async () => {
    const res = await POST(makeRequest({ score: "great" }));
    expect(res.status).toBe(400);
  });

  it("rejects missing score field", async () => {
    const res = await POST(makeRequest({ comment: "no score here" }));
    expect(res.status).toBe(400);
  });
});

// ── Comment validation ────────────────────────────────────────────────────────

describe("POST /api/feedback — comment validation", () => {
  it("accepts a request with no comment", async () => {
    const res = await POST(makeRequest({ score: 7 }));
    expect(res.status).toBe(200);
  });

  it("accepts a comment within the 1000-char limit", async () => {
    const res = await POST(makeRequest({ score: 7, comment: "a".repeat(1000) }));
    expect(res.status).toBe(200);
  });

  it("rejects a comment exceeding 1000 characters", async () => {
    const res = await POST(makeRequest({ score: 7, comment: "a".repeat(1001) }));
    expect(res.status).toBe(400);
  });
});

// ── DB failure ────────────────────────────────────────────────────────────────

describe("POST /api/feedback — DB failure", () => {
  it("returns 500 when insert fails", async () => {
    mockCreate.mockResolvedValue(
      makeClient({ id: USER_ID }, { message: "RLS violation" }) as never
    );
    const res = await POST(makeRequest({ score: 5 }));
    expect(res.status).toBe(500);
  });
});
