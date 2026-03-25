import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeRequest, makeChain } from "@/tests/helpers/supabase-mock";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: vi.fn() }));

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

function makeAdminWithReset(otpRecord: unknown, users: unknown[] = [], updatePwErr: unknown = null) {
  const chain = makeChain({ data: otpRecord, error: otpRecord ? null : { message: "not found" } });
  const deleteChain = makeChain({ data: null, error: null });

  return {
    from: vi.fn((table: string) => {
      if (table === "otp_codes") return chain;
      return deleteChain;
    }),
    auth: {
      admin: {
        listUsers: vi.fn().mockResolvedValue({ data: { users }, error: null }),
        updateUserById: vi.fn().mockResolvedValue({ data: {}, error: updatePwErr }),
      },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRL.mockReturnValue({ allowed: true, remaining: 2, resetTime: Date.now() + 60_000 });
});

describe("POST /api/auth/reset-password", () => {
  it("returns 422 for invalid body", async () => {
    const req = makeRequest("/api/auth/reset-password", { email: "bad" });
    mockAdminClient.mockReturnValue(makeAdminWithReset(null) as never);
    const res = await POST(req as never);
    expect(res.status).toBe(422);
  });

  it("returns 429 when rate limited with wait time", async () => {
    mockCheckRL.mockReturnValue({ allowed: false, remaining: 0, resetTime: Date.now() + 3600_000 });
    mockAdminClient.mockReturnValue(makeAdminWithReset(null) as never);
    const req = makeRequest("/api/auth/reset-password", {
      email: "a@b.com", newPassword: "NewPass1", resetToken: "some-token",
    });
    const res = await POST(req as never);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toMatch(/seconds/i);
  });

  it("returns 400 when reset token is invalid or not found", async () => {
    mockAdminClient.mockReturnValue(makeAdminWithReset(null) as never);
    const req = makeRequest("/api/auth/reset-password", {
      email: "a@b.com", newPassword: "NewPass1", resetToken: "bad-token",
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid or expired/i);
  });

  it("returns 400 for expired reset session (token too old)", async () => {
    const oldRecord = {
      ...validOtpRecord,
      created_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(), // 25 min ago
    };
    mockAdminClient.mockReturnValue(makeAdminWithReset(oldRecord, [{ id: "uid", email: "a@b.com" }]) as never);
    const req = makeRequest("/api/auth/reset-password", {
      email: "a@b.com", newPassword: "NewPass1", resetToken: "reset-token-id",
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/expired/i);
  });

  it("returns generic error (not 'user not found') when user missing", async () => {
    mockAdminClient.mockReturnValue(makeAdminWithReset(validOtpRecord, []) as never);
    const req = makeRequest("/api/auth/reset-password", {
      email: "a@b.com", newPassword: "NewPass1", resetToken: "reset-token-id",
    });
    const res = await POST(req as never);
    // Should not leak "user not found" — should be a generic error
    const body = await res.json();
    expect(body.error).not.toMatch(/user not found/i);
    expect([400, 500]).toContain(res.status);
  });

  it("returns 500 when password update fails", async () => {
    const user = { id: "uid", email: "a@b.com" };
    mockAdminClient.mockReturnValue(
      makeAdminWithReset(validOtpRecord, [user], { message: "db error" }) as never
    );
    const req = makeRequest("/api/auth/reset-password", {
      email: "a@b.com", newPassword: "NewPass1", resetToken: "reset-token-id",
    });
    const res = await POST(req as never);
    expect(res.status).toBe(500);
  });
});
