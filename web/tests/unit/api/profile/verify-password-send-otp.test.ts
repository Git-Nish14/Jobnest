import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeRequest, makeChain } from "@/tests/helpers/supabase-mock";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/security/otp", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/security/otp")>();
  return { ...actual, generateOTP: vi.fn(() => ({ code: "654321", expiresAt: new Date(Date.now() + 600_000) })) };
});
vi.mock("@/lib/email/nodemailer", () => ({ sendOTPEmail: vi.fn() }));

import { POST } from "@/app/api/profile/verify-password-send-otp/route";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { sendOTPEmail } from "@/lib/email/nodemailer";

const mockCheckRL = vi.mocked(checkRateLimit);
const mockCreateClient = vi.mocked(createClient);
const mockAdminClient = vi.mocked(createAdminClient);
const mockSendEmail = vi.mocked(sendOTPEmail);

function makeServerClient(
  user: unknown = { id: "uid", email: "a@b.com" },
  signInErr: unknown = null
) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: signInErr }),
    },
  };
}

function makeAdmin() {
  return { from: vi.fn().mockReturnValue(makeChain()) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRL.mockReturnValue({ allowed: true, remaining: 2, resetTime: Date.now() + 60_000 });
  mockCreateClient.mockResolvedValue(makeServerClient() as never);
  mockAdminClient.mockReturnValue(makeAdmin() as never);
  mockSendEmail.mockResolvedValue({ success: true });
});

describe("POST /api/profile/verify-password-send-otp", () => {
  it("returns 401 when not authenticated", async () => {
    mockCreateClient.mockResolvedValue(makeServerClient(null) as never);
    const req = makeRequest("/api/profile/verify-password-send-otp", { currentPassword: "Pass1" });
    const res = await POST(req as never);
    expect(res.status).toBe(401);
  });

  it("returns 422 for missing currentPassword", async () => {
    const req = makeRequest("/api/profile/verify-password-send-otp", {});
    const res = await POST(req as never);
    expect(res.status).toBe(422);
  });

  it("returns 429 with wait time when rate limited", async () => {
    mockCheckRL.mockReturnValue({ allowed: false, remaining: 0, resetTime: Date.now() + 60_000 });
    const req = makeRequest("/api/profile/verify-password-send-otp", { currentPassword: "Pass1" });
    const res = await POST(req as never);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toMatch(/seconds/i);
  });

  it("returns 401 when current password is wrong", async () => {
    mockCreateClient.mockResolvedValue(
      makeServerClient({ id: "uid", email: "a@b.com" }, { message: "Invalid credentials" }) as never
    );
    const req = makeRequest("/api/profile/verify-password-send-otp", { currentPassword: "WrongPass1" });
    const res = await POST(req as never);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/current password is incorrect/i);
  });

  it("returns 200 and sends OTP when password is correct", async () => {
    const req = makeRequest("/api/profile/verify-password-send-otp", { currentPassword: "CorrectPass1" });
    const res = await POST(req as never);
    expect(res.status).toBe(200);
    expect(mockSendEmail).toHaveBeenCalledWith("a@b.com", "654321", "change_password");
  });

  it("returns 503 when email fails to send", async () => {
    mockSendEmail.mockResolvedValue({ success: false, error: "SMTP down" });
    const req = makeRequest("/api/profile/verify-password-send-otp", { currentPassword: "CorrectPass1" });
    const res = await POST(req as never);
    expect(res.status).toBe(503);
  });
});
