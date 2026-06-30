/**
 * Unit tests — POST /api/profile/update-weekly-goal
 *
 * Covers:
 *  - 403 when verifyOrigin fails (CSRF guard)
 *  - 401 when user is not authenticated
 *  - 400 when weeklyGoal is missing
 *  - 400 when weeklyGoal < 1 (below minimum)
 *  - 400 when weeklyGoal > 100 (above maximum)
 *  - 400 when weeklyGoal is a non-integer (e.g. 1.5)
 *  - 400 when weeklyGoal is a string
 *  - 200 happy path — persists weekly_goal to user_metadata
 *  - 200 boundary value 1 (minimum)
 *  - 200 boundary value 100 (maximum)
 *  - 429 when rate limit is exhausted
 *  - 500 when Supabase updateUser fails
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/security/csrf",       () => ({ verifyOrigin: vi.fn().mockReturnValue(true) }));
vi.mock("@/lib/supabase/server",     () => ({ createClient: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }) }));

import { POST } from "@/app/api/profile/update-weekly-goal/route";
import { verifyOrigin }   from "@/lib/security/csrf";
import { createClient }   from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";

const mockVerifyOrigin   = vi.mocked(verifyOrigin);
const mockCreateClient   = vi.mocked(createClient);
const mockCheckRateLimit = vi.mocked(checkRateLimit);

const AUTHED_USER = { id: "uid-goal-1", email: "user@goal.test" };

function makeSupabase(
  user: unknown = AUTHED_USER,
  updateError: { message: string } | null = null,
) {
  const updateUser = vi.fn().mockResolvedValue(
    updateError
      ? { data: null, error: updateError }
      : { data: {}, error: null }
  );
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue(
        user
          ? { data: { user }, error: null }
          : { data: { user: null }, error: { message: "Unauthorized" } }
      ),
      updateUser,
    },
    _updateUser: updateUser, // expose for assertions
  };
}

function makeReq(body: unknown, origin = "http://localhost:3000") {
  return new NextRequest("http://localhost/api/profile/update-weekly-goal", {
    method: "POST",
    headers: { "Content-Type": "application/json", origin },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyOrigin.mockReturnValue(true);
  mockCheckRateLimit.mockResolvedValue({ allowed: true } as never);
  mockCreateClient.mockResolvedValue(makeSupabase() as never);
});

// ── CSRF ─────────────────────────────────────────────────────────────────────

describe("POST /api/profile/update-weekly-goal — CSRF", () => {
  it("returns 403 when verifyOrigin fails", async () => {
    mockVerifyOrigin.mockReturnValue(false);
    const res = await POST(makeReq({ weeklyGoal: 5 }));
    expect(res.status).toBe(403);
  });
});

// ── Auth ─────────────────────────────────────────────────────────────────────

describe("POST /api/profile/update-weekly-goal — auth", () => {
  it("returns 401 when user is not authenticated", async () => {
    mockCreateClient.mockResolvedValue(makeSupabase(null) as never);
    const res = await POST(makeReq({ weeklyGoal: 5 }));
    expect(res.status).toBe(401);
  });
});

// ── Validation ────────────────────────────────────────────────────────────────

describe("POST /api/profile/update-weekly-goal — validation", () => {
  it("returns 400 when weeklyGoal is missing", async () => {
    const res = await POST(makeReq({}));
    expect([400, 422]).toContain(res.status);
  });

  it("returns 400 when weeklyGoal is 0 (below minimum of 1)", async () => {
    const res = await POST(makeReq({ weeklyGoal: 0 }));
    expect([400, 422]).toContain(res.status);
  });

  it("returns 400 when weeklyGoal is negative", async () => {
    const res = await POST(makeReq({ weeklyGoal: -5 }));
    expect([400, 422]).toContain(res.status);
  });

  it("returns 400 when weeklyGoal is 101 (above maximum of 100)", async () => {
    const res = await POST(makeReq({ weeklyGoal: 101 }));
    expect([400, 422]).toContain(res.status);
  });

  it("returns 400 when weeklyGoal is a float (not an integer)", async () => {
    const res = await POST(makeReq({ weeklyGoal: 7.5 }));
    expect([400, 422]).toContain(res.status);
  });

  it("returns 400 when weeklyGoal is a string", async () => {
    const res = await POST(makeReq({ weeklyGoal: "ten" }));
    expect([400, 422]).toContain(res.status);
  });

  it("returns 400 when weeklyGoal is null", async () => {
    const res = await POST(makeReq({ weeklyGoal: null }));
    expect([400, 422]).toContain(res.status);
  });
});

// ── Happy path ────────────────────────────────────────────────────────────────

describe("POST /api/profile/update-weekly-goal — happy path", () => {
  it("returns 200 and saves weeklyGoal to user_metadata", async () => {
    const supabase = makeSupabase();
    mockCreateClient.mockResolvedValue(supabase as never);

    const res  = await POST(makeReq({ weeklyGoal: 10 }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.weeklyGoal).toBe(10);

    // Verify the Supabase updateUser call contains the correct data
    expect(supabase._updateUser).toHaveBeenCalledWith({
      data: { weekly_goal: 10 },
    });
  });

  it("accepts boundary value 1 (minimum)", async () => {
    const res = await POST(makeReq({ weeklyGoal: 1 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.weeklyGoal).toBe(1);
  });

  it("accepts boundary value 100 (maximum)", async () => {
    const res = await POST(makeReq({ weeklyGoal: 100 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.weeklyGoal).toBe(100);
  });

  it("echoes back the saved value in the response body", async () => {
    const res  = await POST(makeReq({ weeklyGoal: 42 }));
    const body = await res.json();
    expect(body.weeklyGoal).toBe(42);
  });
});

// ── Rate limit ────────────────────────────────────────────────────────────────

describe("POST /api/profile/update-weekly-goal — rate limit", () => {
  it("returns 429 when rate limit is exhausted", async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false, retryAfter: 60 } as never);
    const res = await POST(makeReq({ weeklyGoal: 5 }));
    expect(res.status).toBe(429);
  });
});

// ── Supabase error ────────────────────────────────────────────────────────────

describe("POST /api/profile/update-weekly-goal — Supabase errors", () => {
  it("returns 500 when Supabase updateUser fails", async () => {
    const supabase = makeSupabase(AUTHED_USER, { message: "Connection reset" });
    mockCreateClient.mockResolvedValue(supabase as never);

    const res = await POST(makeReq({ weeklyGoal: 7 }));
    expect(res.status).toBe(500);
  });
});
