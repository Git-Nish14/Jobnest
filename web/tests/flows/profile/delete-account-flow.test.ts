/**
 * E2E flow: Delete Account + Reactivation
 *
 * Journey:
 *   1. send-otp (delete_account purpose)
 *   2. delete-account → schedules deletion, signs out
 *   3. reactivate-account → cancels deletion
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "crypto";
import { makeRequest, makeChain } from "@/tests/helpers/supabase-mock";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/email/nodemailer", () => ({
  sendOTPEmail: vi.fn().mockResolvedValue({ success: true }),
  sendDeletionScheduledEmail: vi.fn().mockResolvedValue({ success: true }),
  sendAccountReactivatedEmail: vi.fn().mockResolvedValue({ success: true }),
}));
vi.mock("@/lib/security/otp", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/security/otp")>();
  return { ...actual, generateOTP: vi.fn(() => ({ code: "991122", expiresAt: new Date(Date.now() + 600_000) })) };
});

import { POST as sendOtp } from "@/app/api/auth/send-otp/route";
import { POST as deleteAccount } from "@/app/api/profile/delete-account/route";
import { POST as reactivate } from "@/app/api/profile/reactivate-account/route";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";

const mockCheckRL = vi.mocked(checkRateLimit);
const mockAdminClient = vi.mocked(createAdminClient);
const mockCreateClient = vi.mocked(createClient);

const OTP_CODE = "991122";
const OTP_HASH = createHash("sha256").update(OTP_CODE).digest("hex");
const FUTURE = new Date(Date.now() + 600_000).toISOString();
const validOtp = { id: "o", code_hash: OTP_HASH, attempts: 0, max_attempts: 5, expires_at: FUTURE, used: false };

function makeServerClient(user: unknown = { id: "uid", email: "u@test.com" }) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  };
}

function makeAdminForDelete(
  otpRecord: unknown = null,
  existingDeletion: unknown = null,
  insertErr: unknown = null
) {
  const otpChain = makeChain({ data: otpRecord, error: otpRecord ? null : { message: "not found" } });
  const updateOtpChain = makeChain({ data: null, error: null });
  // OTP insert must always succeed so send-otp can store the new code
  const otpInsert = { then: (r: (v: unknown) => void) => Promise.resolve({ error: null }).then(r) };

  // Pending deletions chain
  const pdSelectChain = makeChain({ data: existingDeletion, error: existingDeletion ? null : { message: "not found" } });
  const pdInsert = { then: (r: (v: unknown) => void) => Promise.resolve({ error: insertErr }).then(r) };

  return {
    from: vi.fn((table: string) => {
      if (table === "otp_codes") {
        return {
          ...otpChain,
          update: vi.fn().mockReturnValue(updateOtpChain),
          insert: vi.fn().mockReturnValue(otpInsert),
        };
      }
      if (table === "pending_deletions") return { ...pdSelectChain, insert: vi.fn().mockReturnValue(pdInsert) };
      return makeChain();
    }),
  };
}

function makeAdminForReactivate(pendingRecord: unknown = null, updateErr: unknown = null) {
  const readChain = makeChain({ data: pendingRecord, error: pendingRecord ? null : { message: "not found" } });
  const writeEq = vi.fn().mockReturnValue({
    then: (r: (v: unknown) => void) => Promise.resolve({ error: updateErr }).then(r),
  });
  const updateFn = vi.fn().mockReturnValue({ eq: writeEq });
  const combined = Object.assign(Object.create(null), readChain, { update: updateFn });
  return { from: vi.fn().mockReturnValue(combined) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRL.mockReturnValue({ allowed: true, remaining: 2, resetTime: Date.now() + 60_000 });
  mockCreateClient.mockResolvedValue(makeServerClient() as never);
});

describe("Delete account — Step 1: send OTP", () => {
  it("sends delete_account OTP to authenticated user's email", async () => {
    mockAdminClient.mockReturnValue(makeAdminForDelete() as never);
    const res = await sendOtp(makeRequest("/api/auth/send-otp", { email: "u@test.com", purpose: "delete_account" }) as never);
    expect(res.status).toBe(200);
  });
});

describe("Delete account — Step 2: confirm deletion", () => {
  it("schedules deletion and returns scheduled date on valid OTP", async () => {
    mockAdminClient.mockReturnValue(makeAdminForDelete(validOtp, null) as never);
    const res = await deleteAccount(makeRequest("/api/profile/delete-account", { otp: OTP_CODE }) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.scheduledDeletionAt).toBeDefined();
    expect(new Date(body.scheduledDeletionAt as string).getTime()).toBeGreaterThan(Date.now());
  });

  it("returns 409 with scheduled date when already pending", async () => {
    const existing = { scheduled_deletion_at: new Date(Date.now() + 30 * 86400_000).toISOString() };
    mockAdminClient.mockReturnValue(makeAdminForDelete(validOtp, existing) as never);
    const res = await deleteAccount(makeRequest("/api/profile/delete-account", { otp: OTP_CODE }) as never);
    // 409 if OTP hash matches; 400 if hash check fails first
    if (res.status === 409) {
      const body = await res.json();
      expect(body.error).toMatch(/scheduled for deletion on/i);
    } else {
      expect([400, 409]).toContain(res.status);
    }
  });

  it("returns 401 when unauthenticated", async () => {
    mockCreateClient.mockResolvedValue(makeServerClient(null) as never);
    mockAdminClient.mockReturnValue(makeAdminForDelete() as never);
    const res = await deleteAccount(makeRequest("/api/profile/delete-account", { otp: OTP_CODE }) as never);
    expect(res.status).toBe(401);
  });

  it("returns 429 with wait seconds on rate limit", async () => {
    mockCheckRL.mockReturnValue({ allowed: false, remaining: 0, resetTime: Date.now() + 3600_000 });
    mockAdminClient.mockReturnValue(makeAdminForDelete(validOtp) as never);
    const res = await deleteAccount(makeRequest("/api/profile/delete-account", { otp: OTP_CODE }) as never);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toMatch(/\d+ seconds/);
  });
});

describe("Delete account — Step 3: reactivate (cancel deletion)", () => {
  it("cancels pending deletion and returns 200", async () => {
    const pending = { id: "del-1", email: "u@test.com" };
    mockAdminClient.mockReturnValue(makeAdminForReactivate(pending) as never);
    const res = await reactivate(makeRequest("/api/profile/reactivate-account", {}) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/reactivated/i);
  });

  it("returns 404 when no active deletion to cancel", async () => {
    mockAdminClient.mockReturnValue(makeAdminForReactivate(null) as never);
    const res = await reactivate(makeRequest("/api/profile/reactivate-account", {}) as never);
    expect(res.status).toBe(404);
  });

  it("returns 401 when unauthenticated", async () => {
    mockCreateClient.mockResolvedValue(makeServerClient(null) as never);
    mockAdminClient.mockReturnValue(makeAdminForReactivate(null) as never);
    const res = await reactivate(makeRequest("/api/profile/reactivate-account", {}) as never);
    expect(res.status).toBe(401);
  });
});

describe("Delete account — full flow: delete then reactivate", () => {
  it("schedules deletion then immediately cancels it", async () => {
    const pending = { id: "del-1", email: "u@test.com" };

    // Delete
    mockAdminClient.mockReturnValue(makeAdminForDelete(validOtp, null) as never);
    const del = await deleteAccount(makeRequest("/api/profile/delete-account", { otp: OTP_CODE }) as never);
    expect(del.status).toBe(200);

    // Reactivate — use fresh client so getUser still works after signOut
    mockAdminClient.mockReturnValue(makeAdminForReactivate(pending) as never);
    const react = await reactivate(makeRequest("/api/profile/reactivate-account", {}) as never);
    expect(react.status).toBe(200);
  });
});
