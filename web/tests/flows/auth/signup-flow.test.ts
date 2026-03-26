/**
 * E2E flow: Signup
 *
 * Journey: send OTP (signup) → verify OTP → account marked as email-verified.
 *
 * Pre-conditions (enforced client-side before API calls are made):
 *   - User must confirm they are 18+ (ageConfirmed checkbox)
 *   - User must accept Terms of Service & Privacy Policy (termsAccepted checkbox)
 *   - OAuth buttons (Google/GitHub) are blocked until both checkboxes are checked
 *
 * These pre-conditions are validated by signupFormSchema (Zod) and tested in
 * tests/unit/lib/validations/auth.test.ts — "signupFormSchema — age and terms requirements".
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "crypto";
import { makeRequest, makeChain } from "@/tests/helpers/supabase-mock";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/email/nodemailer", () => ({ sendOTPEmail: vi.fn() }));
vi.mock("@/lib/security/otp", () => ({
  generateOTP: vi.fn(() => ({ code: "556677", expiresAt: new Date(Date.now() + 600_000) })),
}));

import { POST as sendOtp } from "@/app/api/auth/send-otp/route";
import { POST as verifyOtp } from "@/app/api/auth/verify-otp/route";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { sendOTPEmail } from "@/lib/email/nodemailer";

const mockCheckRL = vi.mocked(checkRateLimit);
const mockAdminClient = vi.mocked(createAdminClient);
const mockCreateClient = vi.mocked(createClient);
const mockSendEmail = vi.mocked(sendOTPEmail);

const OTP_CODE = "556677";
const OTP_HASH = createHash("sha256").update(OTP_CODE).digest("hex");
const FUTURE = new Date(Date.now() + 600_000).toISOString();

function makeAdmin(otpRecord: unknown = null) {
  const chain = makeChain({ data: otpRecord, error: otpRecord ? null : { message: "not found" } });
  const insertResult = { error: null };
  return {
    from: vi.fn().mockReturnValue({
      ...chain,
      update: vi.fn().mockReturnValue(makeChain({ data: null, error: null })),
      insert: vi.fn().mockReturnValue({
        then: (r: (v: unknown) => void) => Promise.resolve(insertResult).then(r),
      }),
    }),
  };
}

function makeServerClient(user: unknown = null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
      updateUser: vi.fn().mockResolvedValue({ data: {}, error: null }),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRL.mockReturnValue({ allowed: true, remaining: 4, resetTime: Date.now() + 60_000 });
  mockSendEmail.mockResolvedValue({ success: true });
  mockCreateClient.mockResolvedValue(makeServerClient() as never);
});

describe("Signup flow — Step 1: send OTP", () => {
  it("sends verification code to the provided email", async () => {
    mockAdminClient.mockReturnValue(makeAdmin() as never);
    const res = await sendOtp(makeRequest("/api/auth/send-otp", { email: "new@test.com", purpose: "signup" }) as never);
    expect(res.status).toBe(200);
    expect(mockSendEmail).toHaveBeenCalledWith("new@test.com", OTP_CODE, "signup");
  });

  it("rejects already-existing invalid email formats", async () => {
    mockAdminClient.mockReturnValue(makeAdmin() as never);
    const res = await sendOtp(makeRequest("/api/auth/send-otp", { email: "notvalid@@", purpose: "signup" }) as never);
    expect(res.status).toBe(422);
  });

  it("returns 503 when email delivery fails", async () => {
    mockSendEmail.mockResolvedValue({ success: false, error: "SMTP error" });
    mockAdminClient.mockReturnValue(makeAdmin() as never);
    const res = await sendOtp(makeRequest("/api/auth/send-otp", { email: "new@test.com", purpose: "signup" }) as never);
    expect(res.status).toBe(503);
  });
});

describe("Signup flow — Step 2: verify OTP", () => {
  const storedOtp = { id: "otp-s", code_hash: OTP_HASH, attempts: 0, max_attempts: 5, expires_at: FUTURE, used: false };

  it("returns 200 on correct OTP", async () => {
    mockAdminClient.mockReturnValue(makeAdmin(storedOtp) as never);
    const res = await verifyOtp(makeRequest("/api/auth/verify-otp", {
      email: "new@test.com", code: OTP_CODE, purpose: "signup",
    }) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("marks email as verified via updateUser when session exists", async () => {
    const updateUser = vi.fn().mockResolvedValue({ data: {}, error: null });
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "uid" } }, error: null }),
        updateUser,
      },
    } as never);
    mockAdminClient.mockReturnValue(makeAdmin(storedOtp) as never);

    await verifyOtp(makeRequest("/api/auth/verify-otp", {
      email: "new@test.com", code: OTP_CODE, purpose: "signup",
    }) as never);

    expect(updateUser).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ email_verified: true }) })
    );
  });

  it("returns 400 on expired OTP (not found because gt filter excludes it)", async () => {
    // expired → gt("expires_at") filter removes it → single() returns null
    mockAdminClient.mockReturnValue(makeAdmin(null) as never);
    const res = await verifyOtp(makeRequest("/api/auth/verify-otp", {
      email: "new@test.com", code: OTP_CODE, purpose: "signup",
    }) as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid or expired/i);
  });

  it("returns 400 with remaining count on wrong code", async () => {
    mockAdminClient.mockReturnValue(makeAdmin(storedOtp) as never);
    const res = await verifyOtp(makeRequest("/api/auth/verify-otp", {
      email: "new@test.com", code: "000000", purpose: "signup",
    }) as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/4 attempts remaining/i);
  });
});

describe("Signup flow — full happy path", () => {
  it("sends OTP then verifies successfully end-to-end", async () => {
    // Step 1
    mockAdminClient.mockReturnValue(makeAdmin() as never);
    const send = await sendOtp(makeRequest("/api/auth/send-otp", { email: "new@test.com", purpose: "signup" }) as never);
    expect(send.status).toBe(200);

    // Step 2 — use the same code the mock OTP generator returns
    const stored = { id: "o", code_hash: OTP_HASH, attempts: 0, max_attempts: 5, expires_at: FUTURE, used: false };
    mockAdminClient.mockReturnValue(makeAdmin(stored) as never);
    const verify = await verifyOtp(makeRequest("/api/auth/verify-otp", {
      email: "new@test.com", code: OTP_CODE, purpose: "signup",
    }) as never);
    expect(verify.status).toBe(200);
  });
});
