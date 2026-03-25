import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeRequest, makeChain } from "@/tests/helpers/supabase-mock";

// ── Mocks ────────────────────────────────────────────────────────────────────
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/security/otp", () => ({
  generateOTP: vi.fn(() => ({
    code: "123456",
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  })),
}));
vi.mock("@/lib/email/nodemailer", () => ({ sendOTPEmail: vi.fn() }));

import { POST } from "@/app/api/auth/send-otp/route";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { sendOTPEmail } from "@/lib/email/nodemailer";

const mockCheckRL = vi.mocked(checkRateLimit);
const mockSendEmail = vi.mocked(sendOTPEmail);
const mockAdminClient = vi.mocked(createAdminClient);

function makeAdminWithChain(insertResult = { error: null }) {
  const chain = makeChain({ data: null, error: null });
  // Override insert to return insertResult when awaited
  chain.insert = vi.fn().mockReturnValue({
    ...chain,
    then: (resolve: (v: unknown) => void) => Promise.resolve(insertResult).then(resolve),
  });
  return { from: vi.fn().mockReturnValue(chain) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRL.mockReturnValue({ allowed: true, remaining: 2, resetTime: Date.now() + 60_000 });
  mockSendEmail.mockResolvedValue({ success: true });
});

describe("POST /api/auth/send-otp", () => {
  it("returns 400 for invalid email", async () => {
    mockAdminClient.mockReturnValue(makeAdminWithChain() as never);
    const req = makeRequest("/api/auth/send-otp", { email: "notanemail", purpose: "login" });
    const res = await POST(req as never);
    expect(res.status).toBe(422);
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRL.mockReturnValue({ allowed: false, remaining: 0, resetTime: Date.now() + 45_000 });
    mockAdminClient.mockReturnValue(makeAdminWithChain() as never);
    const req = makeRequest("/api/auth/send-otp", { email: "a@b.com", purpose: "login" });
    const res = await POST(req as never);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toMatch(/seconds/i);
  });

  it("returns 200 and sends email on success", async () => {
    mockAdminClient.mockReturnValue(makeAdminWithChain() as never);
    const req = makeRequest("/api/auth/send-otp", { email: "a@b.com", purpose: "login" });
    const res = await POST(req as never);
    expect(res.status).toBe(200);
    expect(mockSendEmail).toHaveBeenCalledWith("a@b.com", "123456", "login");
  });

  it("returns 503 if email sending fails", async () => {
    mockSendEmail.mockResolvedValue({ success: false, error: "SMTP error" });
    mockAdminClient.mockReturnValue(makeAdminWithChain() as never);
    const req = makeRequest("/api/auth/send-otp", { email: "a@b.com", purpose: "login" });
    const res = await POST(req as never);
    expect(res.status).toBe(503);
  });

  it("returns 500 if OTP insert fails", async () => {
    mockAdminClient.mockReturnValue(makeAdminWithChain({ error: { message: "db error" } }) as never);
    const req = makeRequest("/api/auth/send-otp", { email: "a@b.com", purpose: "login" });
    const res = await POST(req as never);
    expect(res.status).toBe(500);
  });

  it("accepts all valid purposes", async () => {
    for (const purpose of ["login", "signup", "password_reset", "change_password", "delete_account"]) {
      mockAdminClient.mockReturnValue(makeAdminWithChain() as never);
      const req = makeRequest("/api/auth/send-otp", { email: "a@b.com", purpose });
      const res = await POST(req as never);
      expect(res.status).toBe(200);
    }
  });
});
