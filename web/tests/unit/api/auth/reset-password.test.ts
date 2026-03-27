import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeRequest, makeChain } from "@/tests/helpers/supabase-mock";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: vi.fn() }));

// Set env vars required by the new user-lookup code
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key-test";

import { POST } from "@/app/api/auth/reset-password/route";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/security/rate-limit";

const mockCheckRL = vi.mocked(checkRateLimit);
const mockAdminClient = vi.mocked(createAdminClient);

const validOtpRecord = {
  id: "reset-token-id",
  email: "a@b.com",
  purpose: "password_reset",
  used: true,
  created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 min ago
};

/** Build a mock admin client; no longer needs listUsers */
function makeAdmin(otpRecord: unknown, updatePwErr: unknown = null) {
  const chain = makeChain({ data: otpRecord, error: otpRecord ? null : { message: "not found" } });
  const deleteChain = makeChain({ data: null, error: null });

  return {
    from: vi.fn((table: string) => {
      if (table === "otp_codes") return { ...chain, delete: vi.fn().mockReturnValue(deleteChain) };
      return deleteChain;
    }),
    auth: {
      admin: {
        updateUserById: vi.fn().mockResolvedValue({ data: {}, error: updatePwErr }),
      },
    },
  };
}

/** Mock the global fetch used for the email-filtered user lookup */
function mockUserFetch(users: Array<{ id: string; email: string }>) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ users }),
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  mockCheckRL.mockReturnValue({ allowed: true, remaining: 2, resetTime: Date.now() + 60_000 });
});

describe("POST /api/auth/reset-password", () => {
  it("returns 422 for invalid body", async () => {
    mockAdminClient.mockReturnValue(makeAdmin(null) as never);
    const res = await POST(makeRequest("/api/auth/reset-password", { email: "bad" }) as never);
    expect(res.status).toBe(422);
  });

  it("returns 429 when rate limited with wait time in message", async () => {
    mockCheckRL.mockReturnValue({ allowed: false, remaining: 0, resetTime: Date.now() + 3600_000 });
    mockAdminClient.mockReturnValue(makeAdmin(null) as never);
    const res = await POST(makeRequest("/api/auth/reset-password", {
      email: "a@b.com", newPassword: "NewPass1", resetToken: "some-token",
    }) as never);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toMatch(/seconds/i);
  });

  it("returns 400 when reset token not found in DB", async () => {
    mockAdminClient.mockReturnValue(makeAdmin(null) as never);
    const res = await POST(makeRequest("/api/auth/reset-password", {
      email: "a@b.com", newPassword: "NewPass1", resetToken: "bad-token",
    }) as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid or expired/i);
  });

  it("returns 400 for expired reset session (token created > 20 min ago)", async () => {
    const oldRecord = {
      ...validOtpRecord,
      created_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    };
    mockAdminClient.mockReturnValue(makeAdmin(oldRecord) as never);
    mockUserFetch([{ id: "uid", email: "a@b.com" }]);

    const res = await POST(makeRequest("/api/auth/reset-password", {
      email: "a@b.com", newPassword: "NewPass1", resetToken: "reset-token-id",
    }) as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/expired/i);
  });

  it("does NOT leak 'user not found' when user missing — returns generic message", async () => {
    mockAdminClient.mockReturnValue(makeAdmin(validOtpRecord) as never);
    // Fetch returns empty users list (email doesn't exist)
    mockUserFetch([]);

    const res = await POST(makeRequest("/api/auth/reset-password", {
      email: "a@b.com", newPassword: "NewPass1", resetToken: "reset-token-id",
    }) as never);
    const body = await res.json();
    expect(body.error).not.toMatch(/user not found/i);
    expect([400, 500]).toContain(res.status);
  });

  it("uses fetch-based user lookup (not listUsers) — no listUsers mock needed", async () => {
    mockAdminClient.mockReturnValue(makeAdmin(validOtpRecord) as never);
    const fetchSpy = mockUserFetch([{ id: "uid", email: "a@b.com" }]);

    await POST(makeRequest("/api/auth/reset-password", {
      email: "a@b.com", newPassword: "NewPass1", resetToken: "reset-token-id",
    }) as never);

    // Verify the targeted fetch was made (not a full table scan)
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("filter="),
      expect.objectContaining({ headers: expect.anything() })
    );
    void fetchSpy;
  });

  it("returns 500 when password update fails", async () => {
    mockAdminClient.mockReturnValue(
      makeAdmin(validOtpRecord, { message: "db error" }) as never
    );
    mockUserFetch([{ id: "uid", email: "a@b.com" }]);

    const res = await POST(makeRequest("/api/auth/reset-password", {
      email: "a@b.com", newPassword: "NewPass1", resetToken: "reset-token-id",
    }) as never);
    expect(res.status).toBe(500);
  });

  it("returns 200 on successful reset", async () => {
    mockAdminClient.mockReturnValue(makeAdmin(validOtpRecord) as never);
    mockUserFetch([{ id: "uid", email: "a@b.com" }]);

    const res = await POST(makeRequest("/api/auth/reset-password", {
      email: "a@b.com", newPassword: "NewPass1", resetToken: "reset-token-id",
    }) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
