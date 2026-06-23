/**
 * Unit tests — POST /api/profile/timezone
 *
 * Covers:
 *  - 403 when verifyOrigin fails (CSRF)
 *  - 401 when user is not authenticated
 *  - 400 when utcOffsetHours is not a number
 *  - 400 when utcOffsetHours is out of range (< -14 or > 14)
 *  - 400 when timezone string is missing or too long
 *  - 200 happy path — merges utc_offset_hours + timezone into user_metadata
 *  - 200 preserves existing metadata keys when updating timezone
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/security/csrf", () => ({ verifyOrigin: vi.fn().mockReturnValue(true) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { POST } from "@/app/api/profile/timezone/route";
import { verifyOrigin } from "@/lib/security/csrf";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const mockVerifyOrigin = vi.mocked(verifyOrigin);
const mockCreateClient = vi.mocked(createClient);
const mockAdminClient  = vi.mocked(createAdminClient);

const AUTHED_USER = { id: "uid-1", email: "user@test.com", user_metadata: { display_name: "Test" } };

function makeSupabase(user: unknown | null = AUTHED_USER) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue(
        user
          ? { data: { user }, error: null }
          : { data: { user: null }, error: { message: "Not authenticated" } }
      ),
    },
  };
}

function makeAdmin(existingMeta: Record<string, unknown> = { display_name: "Test" }) {
  return {
    auth: {
      admin: {
        getUserById: vi.fn().mockResolvedValue({
          data: { user: { id: "uid-1", user_metadata: existingMeta } },
          error: null,
        }),
        updateUserById: vi.fn().mockResolvedValue({ data: {}, error: null }),
      },
    },
  };
}

function makeReq(body: unknown, origin = "http://localhost:3000") {
  return new NextRequest("http://localhost/api/profile/timezone", {
    method: "POST",
    headers: { "Content-Type": "application/json", origin },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyOrigin.mockReturnValue(true);
  mockCreateClient.mockResolvedValue(makeSupabase() as never);
  mockAdminClient.mockReturnValue(makeAdmin() as never);
});

// ── CSRF ─────────────────────────────────────────────────────────────────────

describe("POST /api/profile/timezone — CSRF", () => {
  it("returns 403 when verifyOrigin fails", async () => {
    mockVerifyOrigin.mockReturnValue(false);
    const res = await POST(makeReq({ timezone: "America/New_York", utcOffsetHours: -5 }));
    expect(res.status).toBe(403);
  });
});

// ── Auth ─────────────────────────────────────────────────────────────────────

describe("POST /api/profile/timezone — auth", () => {
  it("returns 401 when user is not authenticated", async () => {
    mockCreateClient.mockResolvedValue(makeSupabase(null) as never);
    const res = await POST(makeReq({ timezone: "America/New_York", utcOffsetHours: -5 }));
    expect(res.status).toBe(401);
  });
});

// ── Validation ────────────────────────────────────────────────────────────────

describe("POST /api/profile/timezone — validation", () => {
  it("returns 400 when utcOffsetHours is not a number", async () => {
    const res = await POST(makeReq({ timezone: "America/New_York", utcOffsetHours: "bad" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when utcOffsetHours exceeds +14", async () => {
    const res = await POST(makeReq({ timezone: "Pacific/Fakezone", utcOffsetHours: 15 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when utcOffsetHours is below -14", async () => {
    const res = await POST(makeReq({ timezone: "Etc/GMT+15", utcOffsetHours: -15 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when timezone is not a string", async () => {
    const res = await POST(makeReq({ timezone: 123, utcOffsetHours: 0 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when timezone string exceeds 64 chars", async () => {
    const res = await POST(makeReq({ timezone: "A".repeat(65), utcOffsetHours: 0 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when body is missing utcOffsetHours entirely", async () => {
    const res = await POST(makeReq({ timezone: "Europe/London" }));
    expect(res.status).toBe(400);
  });
});

// ── Happy path ────────────────────────────────────────────────────────────────

describe("POST /api/profile/timezone — happy path", () => {
  it("returns 200 and updates user_metadata with timezone fields", async () => {
    const admin = makeAdmin({ display_name: "Test" });
    mockAdminClient.mockReturnValue(admin as never);

    const res = await POST(makeReq({ timezone: "America/New_York", utcOffsetHours: -5 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    expect(admin.auth.admin.updateUserById).toHaveBeenCalledWith(
      AUTHED_USER.id,
      expect.objectContaining({
        user_metadata: expect.objectContaining({
          utc_offset_hours: -5,
          timezone: "America/New_York",
        }),
      })
    );
  });

  it("preserves existing user_metadata keys when updating timezone", async () => {
    const existingMeta = { display_name: "Test", app_milestone_last: 100 };
    const admin = makeAdmin(existingMeta);
    mockAdminClient.mockReturnValue(admin as never);

    await POST(makeReq({ timezone: "Asia/Kolkata", utcOffsetHours: 5.5 }));

    const updateCall = vi.mocked(admin.auth.admin.updateUserById).mock.calls[0]?.[1];
    expect(updateCall?.user_metadata).toMatchObject({
      display_name: "Test",
      app_milestone_last: 100,
      utc_offset_hours: 5.5,
      timezone: "Asia/Kolkata",
    });
  });

  it("accepts boundary value +14 (UTC+14 Kiribati)", async () => {
    const res = await POST(makeReq({ timezone: "Pacific/Kiribati", utcOffsetHours: 14 }));
    expect(res.status).toBe(200);
  });

  it("accepts boundary value -14 (UTC-14)", async () => {
    const res = await POST(makeReq({ timezone: "Etc/GMT+14", utcOffsetHours: -14 }));
    expect(res.status).toBe(200);
  });

  it("accepts fractional offset (UTC+5:30 India)", async () => {
    const res = await POST(makeReq({ timezone: "Asia/Kolkata", utcOffsetHours: 5.5 }));
    expect(res.status).toBe(200);
  });
});
