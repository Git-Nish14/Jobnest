/**
 * E2E flow: Change Password (profile)
 *
 * Journey:
 *   1. verify-password-send-otp  — validate current password → send OTP
 *   2. verify-change-otp         — pre-verify OTP (gates new-password fields)
 *   3. change-password           — OTP + new password → password updated
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "crypto";
import { makeRequest, makeChain } from "@/tests/helpers/supabase-mock";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/email/nodemailer", () => ({ sendOTPEmail: vi.fn() }));
vi.mock("@/lib/security/otp", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/security/otp")>();
  return { ...actual, generateOTP: vi.fn(() => ({ code: "334455", expiresAt: new Date(Date.now() + 600_000) })) };
});

import { POST as sendOtpForPw } from "@/app/api/profile/verify-password-send-otp/route";
import { POST as preVerify } from "@/app/api/profile/verify-change-otp/route";
import { POST as changePw } from "@/app/api/profile/change-password/route";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { sendOTPEmail } from "@/lib/email/nodemailer";

const mockCheckRL = vi.mocked(checkRateLimit);
const mockAdminClient = vi.mocked(createAdminClient);
const mockCreateClient = vi.mocked(createClient);
const mockSendEmail = vi.mocked(sendOTPEmail);

const OTP_CODE = "334455";
const OTP_HASH = createHash("sha256").update(OTP_CODE).digest("hex");
const FUTURE = new Date(Date.now() + 600_000).toISOString();
const validOtp = { id: "o", code_hash: OTP_HASH, attempts: 0, max_attempts: 5, expires_at: FUTURE, used: false };

function makeServerClient(signInErr: unknown = null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "uid", email: "u@test.com" } }, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: signInErr }),
    },
  };
}

function makeAdmin(otpRecord: unknown = null) {
  const chain = makeChain({ data: otpRecord, error: otpRecord ? null : { message: "not found" } });
  return {
    from: vi.fn().mockReturnValue({
      ...chain,
      update: vi.fn().mockReturnValue(makeChain({ data: null, error: null })),
      insert: vi.fn().mockReturnValue({ then: (r: (v: unknown) => void) => Promise.resolve({ error: null }).then(r) }),
    }),
    auth: { admin: { updateUserById: vi.fn().mockResolvedValue({ data: {}, error: null }) } },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRL.mockReturnValue({ allowed: true, remaining: 4, resetTime: Date.now() + 60_000 });
  mockSendEmail.mockResolvedValue({ success: true });
  mockCreateClient.mockResolvedValue(makeServerClient() as never);
});

describe("Change password — Step 1: verify current password → send OTP", () => {
  it("sends OTP when current password is correct", async () => {
    mockAdminClient.mockReturnValue(makeAdmin() as never);
    const res = await sendOtpForPw(makeRequest("/api/profile/verify-password-send-otp", { currentPassword: "OldPass1!" }) as never);
    expect(res.status).toBe(200);
    expect(mockSendEmail).toHaveBeenCalledWith("u@test.com", OTP_CODE, "change_password");
  });

  it("returns 401 when current password is wrong", async () => {
    mockCreateClient.mockResolvedValue(makeServerClient({ message: "Invalid credentials" }) as never);
    mockAdminClient.mockReturnValue(makeAdmin() as never);
    const res = await sendOtpForPw(makeRequest("/api/profile/verify-password-send-otp", { currentPassword: "Wrong1!" }) as never);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/current password is incorrect/i);
  });

  it("returns 429 with wait time when rate limited", async () => {
    mockCheckRL.mockReturnValue({ allowed: false, remaining: 0, resetTime: Date.now() + 60_000 });
    mockAdminClient.mockReturnValue(makeAdmin() as never);
    const res = await sendOtpForPw(makeRequest("/api/profile/verify-password-send-otp", { currentPassword: "OldPass1!" }) as never);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toMatch(/\d+ seconds/);
  });
});

describe("Change password — Step 2: pre-verify OTP (gates new password fields)", () => {
  it("returns { valid: true } without consuming OTP", async () => {
    mockAdminClient.mockReturnValue(makeAdmin(validOtp) as never);
    const res = await preVerify(makeRequest("/api/profile/verify-change-otp", { otp: OTP_CODE }) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.valid).toBe(true);
  });

  it("returns 400 with remaining attempts on wrong code", async () => {
    mockAdminClient.mockReturnValue(makeAdmin(validOtp) as never);
    const res = await preVerify(makeRequest("/api/profile/verify-change-otp", { otp: "000000" }) as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/attempt/i);
  });
});

describe("Change password — Step 3: change password", () => {
  it("updates password and returns success", async () => {
    mockAdminClient.mockReturnValue(makeAdmin(validOtp) as never);
    const res = await changePw(makeRequest("/api/profile/change-password", { otp: OTP_CODE, newPassword: "NewPass2!" }) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toMatch(/changed/i);
  });

  it("returns 422 for weak new password — schema rejects before OTP check", async () => {
    mockAdminClient.mockReturnValue(makeAdmin(null) as never);
    const res = await changePw(makeRequest("/api/profile/change-password", { otp: OTP_CODE, newPassword: "weak" }) as never);
    expect(res.status).toBe(422);
  });

  it("returns 400 when OTP is expired or already used", async () => {
    mockAdminClient.mockReturnValue(makeAdmin(null) as never);
    const res = await changePw(makeRequest("/api/profile/change-password", { otp: OTP_CODE, newPassword: "NewPass2!" }) as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid or expired/i);
  });
});

describe("Change password — full 3-step happy path", () => {
  it("send OTP → pre-verify → change password all succeed", async () => {
    // Step 1: verify current password + send OTP
    mockAdminClient.mockReturnValue(makeAdmin() as never);
    const step1 = await sendOtpForPw(makeRequest("/api/profile/verify-password-send-otp", { currentPassword: "OldPass1!" }) as never);
    expect(step1.status).toBe(200);

    // Step 2: pre-verify (gates new password fields)
    mockAdminClient.mockReturnValue(makeAdmin(validOtp) as never);
    const step2 = await preVerify(makeRequest("/api/profile/verify-change-otp", { otp: OTP_CODE }) as never);
    expect(step2.status).toBe(200);
    expect((await step2.json()).valid).toBe(true);

    // Step 3: change password (consumes the OTP)
    mockAdminClient.mockReturnValue(makeAdmin(validOtp) as never);
    const step3 = await changePw(makeRequest("/api/profile/change-password", { otp: OTP_CODE, newPassword: "NewPass2!" }) as never);
    expect(step3.status).toBe(200);
  });
});
