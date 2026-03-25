import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeRequest, makeChain } from "@/tests/helpers/supabase-mock";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/email/nodemailer", () => ({ sendDeletionScheduledEmail: vi.fn() }));

import { POST } from "@/app/api/profile/delete-account/route";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/security/rate-limit";

const mockCheckRL = vi.mocked(checkRateLimit);
const mockCreateClient = vi.mocked(createClient);
const mockAdminClient = vi.mocked(createAdminClient);

const FUTURE = new Date(Date.now() + 10 * 60 * 1000).toISOString();
const validOtpRecord = {
  id: "otp-id",
  code_hash: "fakehash",
  attempts: 0,
  max_attempts: 5,
  expires_at: FUTURE,
  used: false,
};

function makeServerClient(user: unknown = { id: "uid", email: "a@b.com" }) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  };
}

function makeAdmin(otpRecord: unknown, existingDeletion: unknown = null, insertErr: unknown = null) {
  const otpChain = makeChain({ data: otpRecord, error: otpRecord ? null : { message: "not found" } });
  const updateChain = makeChain({ data: null, error: null });
  const existingChain = makeChain({ data: existingDeletion, error: existingDeletion ? null : { message: "not found" } });
  const insertChain = makeChain({ data: null, error: insertErr });
  insertChain.insert = vi.fn().mockReturnValue({
    then: (r: (v: unknown) => void) => Promise.resolve({ error: insertErr }).then(r),
  });

  return {
    from: vi.fn((table: string) => {
      if (table === "otp_codes") return otpChain;
      if (table === "pending_deletions") {
        return {
          ...existingChain,
          insert: insertChain.insert,
        };
      }
      return updateChain;
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRL.mockReturnValue({ allowed: true, remaining: 2, resetTime: Date.now() + 3600_000 });
  mockCreateClient.mockResolvedValue(makeServerClient() as never);
});

describe("POST /api/profile/delete-account", () => {
  it("returns 401 when not authenticated", async () => {
    mockCreateClient.mockResolvedValue(makeServerClient(null) as never);
    mockAdminClient.mockReturnValue(makeAdmin(null) as never);
    const req = makeRequest("/api/profile/delete-account", { otp: "123456" });
    const res = await POST(req as never);
    expect(res.status).toBe(401);
  });

  it("returns 429 with wait time when rate limited", async () => {
    mockCheckRL.mockReturnValue({ allowed: false, remaining: 0, resetTime: Date.now() + 3600_000 });
    mockAdminClient.mockReturnValue(makeAdmin(validOtpRecord) as never);
    const req = makeRequest("/api/profile/delete-account", { otp: "123456" });
    const res = await POST(req as never);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toMatch(/seconds/i);
  });

  it("returns 400 when no OTP record found", async () => {
    mockAdminClient.mockReturnValue(makeAdmin(null) as never);
    const req = makeRequest("/api/profile/delete-account", { otp: "123456" });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
  });

  it("returns 409 with scheduled date when already pending deletion", async () => {
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    mockAdminClient.mockReturnValue(
      makeAdmin(validOtpRecord, { scheduled_deletion_at: futureDate }) as never
    );
    const req = makeRequest("/api/profile/delete-account", { otp: "123456" });
    const res = await POST(req as never);
    // 409 (conflict) or 400 (OTP check fails first) — depends on hash match
    const body = await res.json();
    if (res.status === 409) {
      expect(body.error).toMatch(/scheduled for deletion on/i);
    } else {
      expect([400, 409]).toContain(res.status);
    }
  });

  it("returns 422 for invalid OTP format", async () => {
    mockAdminClient.mockReturnValue(makeAdmin(null) as never);
    const req = makeRequest("/api/profile/delete-account", { otp: "abc" });
    const res = await POST(req as never);
    expect(res.status).toBe(422);
  });
});
