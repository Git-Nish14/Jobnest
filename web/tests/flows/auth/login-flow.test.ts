/**
 * E2E flow: Login
 *
 * Full journey: credentials submitted → OTP sent → OTP verified → session cookie set.
 * Chains the real route handlers back-to-back with only external services mocked
 * (Supabase, email). Zero browser required.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "crypto";
import { makeRequest, makeChain } from "@/tests/helpers/supabase-mock";

// ── External service mocks ───────────────────────────────────────────────────
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/email/nodemailer", () => ({ sendOTPEmail: vi.fn() }));
vi.mock("@/lib/security/otp", () => ({
  generateOTP: vi.fn(() => ({ code: "112233", expiresAt: new Date(Date.now() + 600_000) })),
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

// Pre-compute hash of the generated OTP code "112233"
const OTP_CODE = "112233";
const OTP_HASH = createHash("sha256").update(OTP_CODE).digest("hex");
const FUTURE = new Date(Date.now() + 600_000).toISOString();

function makeAdminWithOtp(otpRecord: unknown = null, insertErr: unknown = null) {
  const updateChain = makeChain({ data: null, error: null });
  const insertChain = { then: (r: (v: unknown) => void) => Promise.resolve({ error: insertErr }).then(r) };
  const selectChain = makeChain({ data: otpRecord, error: otpRecord ? null : { message: "not found" } });
  const updateAttemptChain = makeChain({ data: null, error: null });

  return {
    from: vi.fn((table: string) => {
      if (table !== "otp_codes") return makeChain();
      return {
        ...selectChain,
        update: vi.fn().mockReturnValue(updateChain),
        insert: vi.fn().mockReturnValue(insertChain),
        // update attempts chain needs eq chain
      };
    }),
  };
}

function makeServerClientWithAuth(user: unknown) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({
        data: { user, session: { access_token: "token" } },
        error: null,
      }),
      updateUser: vi.fn().mockResolvedValue({ data: {}, error: null }),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRL.mockReturnValue({ allowed: true, remaining: 4, resetTime: Date.now() + 60_000 });
  mockSendEmail.mockResolvedValue({ success: true });
});

describe("Login flow — Step 1: submit credentials → OTP sent", () => {
  it("returns 200 and triggers email send", async () => {
    mockAdminClient.mockReturnValue(makeAdminWithOtp() as never);

    const res = await sendOtp(makeRequest("/api/auth/send-otp", { email: "user@test.com", purpose: "login" }) as never);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockSendEmail).toHaveBeenCalledWith("user@test.com", OTP_CODE, "login");
  });

  it("rejects invalid email before any DB call", async () => {
    mockAdminClient.mockReturnValue(makeAdminWithOtp() as never);
    const res = await sendOtp(makeRequest("/api/auth/send-otp", { email: "bad-email", purpose: "login" }) as never);
    expect(res.status).toBe(422);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("returns 429 when OTP send rate limit hit and includes wait time", async () => {
    mockCheckRL.mockReturnValue({ allowed: false, remaining: 0, resetTime: Date.now() + 45_000 });
    mockAdminClient.mockReturnValue(makeAdminWithOtp() as never);
    const res = await sendOtp(makeRequest("/api/auth/send-otp", { email: "user@test.com", purpose: "login" }) as never);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toMatch(/\d+ seconds/);
  });
});

describe("Login flow — Step 2: OTP verified → session created", () => {
  const storedOtp = { id: "otp-1", code_hash: OTP_HASH, attempts: 0, max_attempts: 5, expires_at: FUTURE, used: false };

  it("returns 200 with user on correct OTP + password", async () => {
    const user = { id: "uid", email: "user@test.com" };
    mockAdminClient.mockReturnValue(makeAdminWithOtp(storedOtp) as never);
    mockCreateClient.mockResolvedValue(makeServerClientWithAuth(user) as never);

    const res = await verifyOtp(makeRequest("/api/auth/verify-otp", {
      email: "user@test.com",
      code: OTP_CODE,
      purpose: "login",
      password: "Password1!",
      rememberMe: true,
    }) as never);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.user.email).toBe("user@test.com");
  });

  it("sets sb_rm=1 cookie when rememberMe is true", async () => {
    const user = { id: "uid", email: "user@test.com" };
    mockAdminClient.mockReturnValue(makeAdminWithOtp(storedOtp) as never);
    mockCreateClient.mockResolvedValue(makeServerClientWithAuth(user) as never);

    const res = await verifyOtp(makeRequest("/api/auth/verify-otp", {
      email: "user@test.com", code: OTP_CODE, purpose: "login", password: "Password1!", rememberMe: true,
    }) as never);

    const cookies = res.headers.get("set-cookie") ?? "";
    expect(cookies).toContain("sb_rm=1");
  });

  it("sets sb_rm=0 cookie when rememberMe is false", async () => {
    const user = { id: "uid", email: "user@test.com" };
    mockAdminClient.mockReturnValue(makeAdminWithOtp(storedOtp) as never);
    mockCreateClient.mockResolvedValue(makeServerClientWithAuth(user) as never);

    const res = await verifyOtp(makeRequest("/api/auth/verify-otp", {
      email: "user@test.com", code: OTP_CODE, purpose: "login", password: "Password1!", rememberMe: false,
    }) as never);

    const cookies = res.headers.get("set-cookie") ?? "";
    expect(cookies).toContain("sb_rm=0");
  });

  it("returns 401 on wrong password", async () => {
    mockAdminClient.mockReturnValue(makeAdminWithOtp(storedOtp) as never);
    mockCreateClient.mockResolvedValue({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({ data: null, error: { message: "Invalid credentials" } }),
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        updateUser: vi.fn(),
      },
    } as never);

    const res = await verifyOtp(makeRequest("/api/auth/verify-otp", {
      email: "user@test.com", code: OTP_CODE, purpose: "login", password: "WrongPass1",
    }) as never);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/invalid email or password/i);
  });

  it("returns 400 with remaining attempts on wrong OTP code", async () => {
    mockAdminClient.mockReturnValue(makeAdminWithOtp(storedOtp) as never);
    mockCreateClient.mockResolvedValue(makeServerClientWithAuth(null) as never);

    const res = await verifyOtp(makeRequest("/api/auth/verify-otp", {
      email: "user@test.com", code: "000000", purpose: "login", password: "Password1!",
    }) as never);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/4 attempts remaining/i);
  });

  it("blocks verify when rate limit exceeded and returns wait time", async () => {
    mockCheckRL.mockReturnValue({ allowed: false, remaining: 0, resetTime: Date.now() + 900_000 });
    mockAdminClient.mockReturnValue(makeAdminWithOtp(storedOtp) as never);
    mockCreateClient.mockResolvedValue(makeServerClientWithAuth(null) as never);

    const res = await verifyOtp(makeRequest("/api/auth/verify-otp", {
      email: "user@test.com", code: OTP_CODE, purpose: "login", password: "Password1!",
    }) as never);

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toMatch(/\d+ seconds/);
  });
});

describe("Login flow — full happy path (send → verify)", () => {
  it("OTP code generated in step 1 is verifiable in step 2", async () => {
    const user = { id: "uid", email: "user@test.com" };
    const storedRecord = { id: "otp-1", code_hash: OTP_HASH, attempts: 0, max_attempts: 5, expires_at: FUTURE, used: false };

    // Step 1: send OTP
    mockAdminClient.mockReturnValue(makeAdminWithOtp() as never);
    const step1 = await sendOtp(makeRequest("/api/auth/send-otp", { email: "user@test.com", purpose: "login" }) as never);
    expect(step1.status).toBe(200);

    // Step 2: verify with the code the mock generated
    mockAdminClient.mockReturnValue(makeAdminWithOtp(storedRecord) as never);
    mockCreateClient.mockResolvedValue(makeServerClientWithAuth(user) as never);

    const step2 = await verifyOtp(makeRequest("/api/auth/verify-otp", {
      email: "user@test.com", code: OTP_CODE, purpose: "login", password: "Password1!", rememberMe: true,
    }) as never);

    expect(step2.status).toBe(200);
    const body = await step2.json();
    expect(body.success).toBe(true);
  });
});
