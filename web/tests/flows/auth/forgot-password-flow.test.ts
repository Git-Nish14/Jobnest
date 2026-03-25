/**
 * E2E flow: Forgot Password
 *
 * Journey: send OTP → verify OTP (get reset_token) → reset password.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "crypto";
import { makeRequest, makeChain } from "@/tests/helpers/supabase-mock";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/email/nodemailer", () => ({ sendOTPEmail: vi.fn() }));
vi.mock("@/lib/security/otp", () => ({
  generateOTP: vi.fn(() => ({ code: "778899", expiresAt: new Date(Date.now() + 600_000) })),
}));

import { POST as sendOtp } from "@/app/api/auth/send-otp/route";
import { POST as verifyOtp } from "@/app/api/auth/verify-otp/route";
import { POST as resetPassword } from "@/app/api/auth/reset-password/route";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { sendOTPEmail } from "@/lib/email/nodemailer";

const mockCheckRL = vi.mocked(checkRateLimit);
const mockAdminClient = vi.mocked(createAdminClient);
const mockCreateClient = vi.mocked(createClient);
const mockSendEmail = vi.mocked(sendOTPEmail);

const OTP_CODE = "778899";
const OTP_HASH = createHash("sha256").update(OTP_CODE).digest("hex");
const OTP_ID = "otp-reset-id";
const FUTURE = new Date(Date.now() + 600_000).toISOString();
const RECENT = new Date(Date.now() - 2 * 60 * 1000).toISOString();

const storedOtp = {
  id: OTP_ID, code_hash: OTP_HASH, attempts: 0, max_attempts: 5, expires_at: FUTURE, used: false,
};
const usedOtp = {
  id: OTP_ID, email: "user@test.com", purpose: "password_reset", used: true, created_at: RECENT,
};

/** Admin for verify-otp: single() returns storedOtp (matching the hash) */
function makeAdminForVerify(otpRecord: unknown = storedOtp) {
  const chain = makeChain({ data: otpRecord, error: otpRecord ? null : { message: "not found" } });
  return {
    from: vi.fn().mockReturnValue({
      ...chain,
      update: vi.fn().mockReturnValue(makeChain({ data: null, error: null })),
      insert: vi.fn().mockReturnValue({
        then: (r: (v: unknown) => void) => Promise.resolve({ error: null }).then(r),
      }),
    }),
  };
}

/** Admin for reset-password: single() returns usedRecord (already-verified, used=true) */
function makeAdminForReset(usedRecord: unknown, users: unknown[] = [], updateErr: unknown = null) {
  const otpChain = makeChain({ data: usedRecord, error: usedRecord ? null : { message: "not found" } });
  return {
    from: vi.fn((table: string) => {
      if (table === "otp_codes") {
        return {
          ...otpChain,
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              then: (r: (v: unknown) => void) => Promise.resolve({ error: null }).then(r),
            }),
          }),
        };
      }
      return makeChain();
    }),
    auth: {
      admin: {
        listUsers: vi.fn().mockResolvedValue({ data: { users }, error: null }),
        updateUserById: vi.fn().mockResolvedValue({ data: {}, error: updateErr }),
      },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRL.mockReturnValue({ allowed: true, remaining: 4, resetTime: Date.now() + 60_000 });
  mockSendEmail.mockResolvedValue({ success: true });
  mockCreateClient.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      updateUser: vi.fn().mockResolvedValue({ data: {}, error: null }),
    },
  } as never);
});

describe("Forgot password — Step 1: send OTP", () => {
  it("sends reset OTP to the given email", async () => {
    mockAdminClient.mockReturnValue(makeAdminForVerify(null) as never);
    const res = await sendOtp(makeRequest("/api/auth/send-otp", { email: "user@test.com", purpose: "password_reset" }) as never);
    expect(res.status).toBe(200);
    expect(mockSendEmail).toHaveBeenCalledWith("user@test.com", OTP_CODE, "password_reset");
  });

  it("returns 503 when email delivery fails", async () => {
    mockSendEmail.mockResolvedValue({ success: false, error: "SMTP error" });
    mockAdminClient.mockReturnValue(makeAdminForVerify(null) as never);
    const res = await sendOtp(makeRequest("/api/auth/send-otp", { email: "user@test.com", purpose: "password_reset" }) as never);
    expect(res.status).toBe(503);
  });
});

describe("Forgot password — Step 2: verify OTP → get reset_token", () => {
  it("returns reset_token on correct OTP", async () => {
    mockAdminClient.mockReturnValue(makeAdminForVerify(storedOtp) as never);
    const res = await verifyOtp(makeRequest("/api/auth/verify-otp", {
      email: "user@test.com", code: OTP_CODE, purpose: "password_reset",
    }) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reset_token).toBe(OTP_ID);
  });

  it("returns 400 with remaining attempts on wrong code", async () => {
    mockAdminClient.mockReturnValue(makeAdminForVerify(storedOtp) as never);
    const res = await verifyOtp(makeRequest("/api/auth/verify-otp", {
      email: "user@test.com", code: "000000", purpose: "password_reset",
    }) as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/attempts remaining/i);
  });

  it("returns 400 when no OTP exists (expired or not sent)", async () => {
    mockAdminClient.mockReturnValue(makeAdminForVerify(null) as never);
    const res = await verifyOtp(makeRequest("/api/auth/verify-otp", {
      email: "user@test.com", code: OTP_CODE, purpose: "password_reset",
    }) as never);
    expect(res.status).toBe(400);
  });
});

describe("Forgot password — Step 3: reset password", () => {
  const user = { id: "uid", email: "user@test.com" };

  it("updates password and returns 200 with valid token", async () => {
    mockAdminClient.mockReturnValue(makeAdminForReset(usedOtp, [user]) as never);
    const res = await resetPassword(makeRequest("/api/auth/reset-password", {
      email: "user@test.com", newPassword: "NewPass1!", resetToken: OTP_ID,
    }) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("returns 400 on invalid/missing reset_token (not found in DB)", async () => {
    // usedRecord = null → DB returns not-found → 400
    mockAdminClient.mockReturnValue(makeAdminForReset(null, [user]) as never);
    const res = await resetPassword(makeRequest("/api/auth/reset-password", {
      email: "user@test.com", newPassword: "NewPass1!", resetToken: "bad-token",
    }) as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid or expired/i);
  });

  it("returns 400 for expired reset session (token created >20 min ago)", async () => {
    const oldRecord = { ...usedOtp, created_at: new Date(Date.now() - 25 * 60_000).toISOString() };
    mockAdminClient.mockReturnValue(makeAdminForReset(oldRecord, [user]) as never);
    const res = await resetPassword(makeRequest("/api/auth/reset-password", {
      email: "user@test.com", newPassword: "NewPass1!", resetToken: OTP_ID,
    }) as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/expired/i);
  });

  it("does not expose 'user not found' when email has no account", async () => {
    mockAdminClient.mockReturnValue(makeAdminForReset(usedOtp, []) as never);
    const res = await resetPassword(makeRequest("/api/auth/reset-password", {
      email: "ghost@test.com", newPassword: "NewPass1!", resetToken: OTP_ID,
    }) as never);
    const body = await res.json();
    expect(body.error).not.toMatch(/user not found/i);
  });

  it("returns 422 for weak new password", async () => {
    mockAdminClient.mockReturnValue(makeAdminForReset(usedOtp, [user]) as never);
    const res = await resetPassword(makeRequest("/api/auth/reset-password", {
      email: "user@test.com", newPassword: "weak", resetToken: OTP_ID,
    }) as never);
    expect(res.status).toBe(422);
  });
});

describe("Forgot password — full 3-step happy path", () => {
  it("send OTP → verify → reset — all succeed in sequence", async () => {
    const user = { id: "uid", email: "user@test.com" };

    // Step 1
    mockAdminClient.mockReturnValue(makeAdminForVerify(null) as never);
    const send = await sendOtp(makeRequest("/api/auth/send-otp", { email: "user@test.com", purpose: "password_reset" }) as never);
    expect(send.status).toBe(200);

    // Step 2
    mockAdminClient.mockReturnValue(makeAdminForVerify(storedOtp) as never);
    const verify = await verifyOtp(makeRequest("/api/auth/verify-otp", {
      email: "user@test.com", code: OTP_CODE, purpose: "password_reset",
    }) as never);
    expect(verify.status).toBe(200);
    const { reset_token } = await verify.json() as { reset_token: string };

    // Step 3
    mockAdminClient.mockReturnValue(makeAdminForReset(usedOtp, [user]) as never);
    const reset = await resetPassword(makeRequest("/api/auth/reset-password", {
      email: "user@test.com", newPassword: "NewPass1!", resetToken: reset_token,
    }) as never);
    expect(reset.status).toBe(200);
  });
});
