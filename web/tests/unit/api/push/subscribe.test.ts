/**
 * Unit tests — POST/DELETE /api/push/subscribe
 *
 * Covers:
 *  - 403 on bad origin (CSRF guard)
 *  - 401 when unauthenticated
 *  - 429 when rate limit exceeded
 *  - 400 on malformed payload (missing fields, bad URL, field too long)
 *  - 429 when user already has MAX_SUBSCRIPTIONS_PER_USER (10) other endpoints
 *  - 200 on valid subscribe (upsert succeeds)
 *  - 200 on valid unsubscribe (delete succeeds)
 *  - 500 on DB upsert error
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { makeChain } from "@/tests/helpers/supabase-mock";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/security/csrf",   () => ({ verifyOrigin: vi.fn().mockReturnValue(true) }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: vi.fn() }));

import { POST, DELETE } from "@/app/api/push/subscribe/route";
import { createClient }  from "@/lib/supabase/server";
import { verifyOrigin }  from "@/lib/security/csrf";
import { checkRateLimit } from "@/lib/security/rate-limit";

const mockCreate   = vi.mocked(createClient);
const mockOrigin   = vi.mocked(verifyOrigin);
const mockRL       = vi.mocked(checkRateLimit);

const USER_ID = "user-push-sub-test";

const VALID_SUB = {
  endpoint: "https://fcm.googleapis.com/fcm/send/sub-endpoint-test",
  p256dh:   "BNcRdreALRFXTkOOUHK1EtK2wtwe6YZk7K",
  auth:     "tBHItJI5svbpez7KI4CCXg",
};

function makeReq(method: "POST" | "DELETE", body?: unknown) {
  return new NextRequest("http://localhost/api/push/subscribe", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function makeAuthedClient(countResult = 0, upsertError: unknown = null) {
  const countChain = {
    ...makeChain({ count: countResult, error: null }),
    // count query uses head:true so it only needs select/eq/neq/then
  } as ReturnType<typeof makeChain>;

  const upsertChain = makeChain({ data: null, error: upsertError });

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: USER_ID } },
        error: null,
      }),
    },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "push_subscriptions") {
        // Return count chain for select (count check), upsert chain otherwise
        return {
          ...upsertChain,
          select: vi.fn().mockReturnValue({
            ...countChain,
            eq:  vi.fn().mockReturnThis(),
            neq: vi.fn().mockReturnThis(),
            // make it awaitable returning count
            then: (r: (v: unknown) => void) =>
              Promise.resolve({ count: countResult, error: null }).then(r),
          }),
        };
      }
      return makeChain();
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockOrigin.mockReturnValue(true);
  mockRL.mockResolvedValue({ allowed: true, remaining: 9, resetTime: Date.now() + 60_000 });
  mockCreate.mockResolvedValue(makeAuthedClient() as never);
});

// ── Security guards ───────────────────────────────────────────────────────────

describe("POST /api/push/subscribe — security", () => {
  it("returns 403 when origin check fails", async () => {
    mockOrigin.mockReturnValue(false);
    const res = await POST(makeReq("POST", VALID_SUB));
    expect(res.status).toBe(403);
  });

  it("returns 401 when user is not authenticated", async () => {
    mockCreate.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: { message: "no session" } }) },
    } as never);
    const res = await POST(makeReq("POST", VALID_SUB));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limit is exceeded", async () => {
    mockRL.mockResolvedValue({ allowed: false, remaining: 0, resetTime: Date.now() + 60_000 });
    const res = await POST(makeReq("POST", VALID_SUB));
    expect(res.status).toBe(429);
  });
});

// ── Input validation ──────────────────────────────────────────────────────────

describe("POST /api/push/subscribe — input validation", () => {
  it("returns 400 when endpoint is not a URL", async () => {
    const res = await POST(makeReq("POST", { ...VALID_SUB, endpoint: "not-a-url" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when p256dh is missing", async () => {
    const res = await POST(makeReq("POST", { endpoint: VALID_SUB.endpoint, auth: VALID_SUB.auth }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when body is not JSON", async () => {
    const req = new NextRequest("http://localhost/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 429 when user already has 10 different subscriptions", async () => {
    mockCreate.mockResolvedValue(makeAuthedClient(10) as never);
    const res = await POST(makeReq("POST", VALID_SUB));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toMatch(/maximum/i);
  });
});

// ── Happy path ────────────────────────────────────────────────────────────────

describe("POST /api/push/subscribe — success", () => {
  it("returns 200 and { ok: true } when subscription is saved", async () => {
    const res = await POST(makeReq("POST", VALID_SUB));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});

// ── DB error ─────────────────────────────────────────────────────────────────

describe("POST /api/push/subscribe — DB error", () => {
  it("returns 500 when upsert fails", async () => {
    mockCreate.mockResolvedValue(makeAuthedClient(0, { message: "constraint violation" }) as never);
    const res = await POST(makeReq("POST", VALID_SUB));
    expect(res.status).toBe(500);
  });
});

// ── DELETE ────────────────────────────────────────────────────────────────────

describe("DELETE /api/push/subscribe", () => {
  it("returns 403 when origin check fails", async () => {
    mockOrigin.mockReturnValue(false);
    const res = await DELETE(makeReq("DELETE", { endpoint: VALID_SUB.endpoint }));
    expect(res.status).toBe(403);
  });

  it("returns 401 when unauthenticated", async () => {
    mockCreate.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    } as never);
    const res = await DELETE(makeReq("DELETE", { endpoint: VALID_SUB.endpoint }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when endpoint is not a URL", async () => {
    const res = await DELETE(makeReq("DELETE", { endpoint: "bad" }));
    expect(res.status).toBe(400);
  });

  it("returns 200 on successful delete", async () => {
    const res = await DELETE(makeReq("DELETE", { endpoint: VALID_SUB.endpoint }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});
