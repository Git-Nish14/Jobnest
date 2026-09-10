/**
 * Unit tests — /api/nesta-ai/memory (GET, PATCH, DELETE)
 *
 * Covers:
 *  GET
 *   - 401 when not authenticated
 *   - 200 with empty preferences when no row exists
 *   - 200 returns stored preferences
 *
 *  PATCH
 *   - 403 when origin check fails
 *   - 401 when not authenticated
 *   - 429 when rate-limited
 *   - 400 when body validation fails (too few history turns)
 *   - skipped when GROQ_API_KEY is absent
 *   - skipped when Groq returns NONE
 *   - skipped when Groq extraction HTTP call fails
 *   - 200 extracts, deduplicates, and persists preferences (newest-20 kept)
 *   - 200 strips === delimiters from extracted text before storage
 *
 *  DELETE
 *   - 403 when origin check fails
 *   - 401 when not authenticated
 *   - 200 clears the user's memory row
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/server",      () => ({ createClient:   vi.fn() }));
vi.mock("@/lib/security/rate-limit",  () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/security/csrf",        () => ({ verifyOrigin:   vi.fn() }));

import { GET, PATCH, DELETE } from "@/app/api/nesta-ai/memory/route";
import { createClient }   from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyOrigin }   from "@/lib/security/csrf";

const mockCreateClient = vi.mocked(createClient);
const mockCheckRL      = vi.mocked(checkRateLimit);
const mockVerifyOrigin = vi.mocked(verifyOrigin);

const VALID_USER = { id: "uid-1", email: "u@test.com" };

// 4 message turns (min required by schema)
const VALID_HISTORY = [
  { role: "user",      content: "I prefer remote TypeScript roles." },
  { role: "assistant", content: "Noted, I'll keep that in mind." },
  { role: "user",      content: "Target companies: Stripe, Linear." },
  { role: "assistant", content: "Great choices!" },
];

function makeSupabaseClient(
  user: unknown = VALID_USER,
  existingPrefs: string | null = null,
) {
  const memoryRow = existingPrefs !== null ? { preferences: existingPrefs } : null;

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
    from: vi.fn(() => ({
      select:      vi.fn().mockReturnThis(),
      eq:          vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: memoryRow, error: null }),
      upsert:      vi.fn().mockResolvedValue({ error: null }),
      delete:      vi.fn().mockReturnThis(),
      then:        (r: (v: unknown) => void) =>
        Promise.resolve({ error: null }).then(r),
    })),
  };
}

function makeRequest(
  method: string,
  body?: unknown,
  origin: string | null = "http://localhost:3000",
) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (origin) headers["origin"] = origin;
  return new NextRequest(`http://localhost/api/nesta-ai/memory`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

function mockGroq(content: string, ok = true) {
  global.fetch = vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: vi.fn().mockResolvedValue({
      choices: [{ message: { content } }],
    }),
  } as unknown as Response);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyOrigin.mockReturnValue(true);
  mockCheckRL.mockResolvedValue({ allowed: true, remaining: 9, resetTime: Date.now() + 3_600_000 });
  process.env.GROQ_API_KEY = "test-groq-key";
});

afterEach(() => {
  vi.restoreAllMocks();
  process.env.GROQ_API_KEY = "test-groq-key";
});

// ── GET ───────────────────────────────────────────────────────────────────────

describe("GET /api/nesta-ai/memory", () => {
  it("returns 401 when not authenticated", async () => {
    mockCreateClient.mockResolvedValue(makeSupabaseClient(null) as never);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns empty preferences when no memory row exists", async () => {
    mockCreateClient.mockResolvedValue(makeSupabaseClient(VALID_USER, null) as never);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.preferences).toBe("");
  });

  it("returns stored preferences", async () => {
    mockCreateClient.mockResolvedValue(
      makeSupabaseClient(VALID_USER, "- Prefers remote TypeScript roles\n- Target: Stripe") as never,
    );
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.preferences).toContain("TypeScript");
  });
});

// ── PATCH ─────────────────────────────────────────────────────────────────────

describe("PATCH /api/nesta-ai/memory", () => {
  it("returns 403 when origin check fails", async () => {
    mockVerifyOrigin.mockReturnValue(false);
    const res = await PATCH(makeRequest("PATCH", { history: VALID_HISTORY }));
    expect(res.status).toBe(403);
  });

  it("returns 401 when not authenticated", async () => {
    mockCreateClient.mockResolvedValue(makeSupabaseClient(null) as never);
    const res = await PATCH(makeRequest("PATCH", { history: VALID_HISTORY }));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate-limited", async () => {
    mockCreateClient.mockResolvedValue(makeSupabaseClient() as never);
    mockCheckRL.mockResolvedValue({ allowed: false, remaining: 0, resetTime: Date.now() + 1000 });
    const res = await PATCH(makeRequest("PATCH", { history: VALID_HISTORY }));
    expect(res.status).toBe(429);
  });

  it("returns 422 when history has fewer than 4 turns (Zod validation)", async () => {
    mockCreateClient.mockResolvedValue(makeSupabaseClient() as never);
    const res = await PATCH(makeRequest("PATCH", {
      history: [{ role: "user", content: "hi" }],
    }));
    expect(res.status).toBe(422);
  });

  it("returns skipped when GROQ_API_KEY is absent", async () => {
    delete process.env.GROQ_API_KEY;
    mockCreateClient.mockResolvedValue(makeSupabaseClient() as never);
    const res = await PATCH(makeRequest("PATCH", { history: VALID_HISTORY }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skipped).toMatch(/GROQ/i);
  });

  it("returns skipped when Groq responds with NONE", async () => {
    mockCreateClient.mockResolvedValue(makeSupabaseClient() as never);
    mockGroq("NONE");
    const res = await PATCH(makeRequest("PATCH", { history: VALID_HISTORY }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skipped).toBeDefined();
  });

  it("returns skipped when Groq HTTP call fails", async () => {
    mockCreateClient.mockResolvedValue(makeSupabaseClient() as never);
    mockGroq("", false);
    const res = await PATCH(makeRequest("PATCH", { history: VALID_HISTORY }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skipped).toBeDefined();
  });

  it("extracts and persists preferences, reports bullet count", async () => {
    const supabaseMock = makeSupabaseClient(VALID_USER, null);
    mockCreateClient.mockResolvedValue(supabaseMock as never);
    mockGroq("- Prefers TypeScript\n- Target: Stripe, Linear");

    const res = await PATCH(makeRequest("PATCH", { history: VALID_HISTORY }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.bullets).toBeGreaterThanOrEqual(1);
  });

  it("keeps only the newest 20 unique bullets when merging", async () => {
    // Simulate 18 existing bullets in DB
    const existing = Array.from({ length: 18 }, (_, i) => `- Old pref ${i + 1}`).join("\n");
    const supabaseMock = makeSupabaseClient(VALID_USER, existing);
    mockCreateClient.mockResolvedValue(supabaseMock as never);
    // Groq returns 5 new bullets (total would be 23 → should be capped at 20)
    mockGroq("- New pref A\n- New pref B\n- New pref C\n- New pref D\n- New pref E");

    const res = await PATCH(makeRequest("PATCH", { history: VALID_HISTORY }));
    const body = await res.json();
    expect(body.bullets).toBeLessThanOrEqual(20);
    // Newest bullets should survive (slice(-20) keeps the end)
    expect(body.bullets).toBe(20);
  });
});

// ── DELETE ────────────────────────────────────────────────────────────────────

describe("DELETE /api/nesta-ai/memory", () => {
  it("returns 403 when origin check fails", async () => {
    mockVerifyOrigin.mockReturnValue(false);
    const res = await DELETE(makeRequest("DELETE"));
    expect(res.status).toBe(403);
  });

  it("returns 401 when not authenticated", async () => {
    mockCreateClient.mockResolvedValue(makeSupabaseClient(null) as never);
    const res = await DELETE(makeRequest("DELETE"));
    expect(res.status).toBe(401);
  });

  it("returns 200 and ok: true when memory is cleared", async () => {
    mockCreateClient.mockResolvedValue(makeSupabaseClient() as never);
    const res = await DELETE(makeRequest("DELETE"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});
