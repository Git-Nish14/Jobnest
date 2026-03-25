import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeRequest, makeChain } from "@/tests/helpers/supabase-mock";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: vi.fn() }));

import { POST } from "@/app/api/profile/verify-change-otp/route";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/security/rate-limit";

const mockCheckRL = vi.mocked(checkRateLimit);
const mockCreateClient = vi.mocked(createClient);
const mockAdminClient = vi.mocked(createAdminClient);

const FUTURE = new Date(Date.now() + 10 * 60 * 1000).toISOString();

function makeServerClient(user: unknown = { id: "uid", email: "a@b.com" }) {
  return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) } };
}

function makeAdmin(otpRecord: unknown) {
  const chain = makeChain({ data: otpRecord, error: otpRecord ? null : { message: "not found" } });
  return { from: vi.fn().mockReturnValue(chain) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRL.mockReturnValue({ allowed: true, remaining: 9, resetTime: Date.now() + 60_000 });
  mockCreateClient.mockResolvedValue(makeServerClient() as never);
});

describe("POST /api/profile/verify-change-otp", () => {
  it("returns 401 when not authenticated", async () => {
    mockCreateClient.mockResolvedValue(makeServerClient(null) as never);
    mockAdminClient.mockReturnValue(makeAdmin(null) as never);
    const req = makeRequest("/api/profile/verify-change-otp", { otp: "123456" });
    const res = await POST(req as never);
    expect(res.status).toBe(401);
  });

  it("returns 422 for non-digit OTP", async () => {
    mockAdminClient.mockReturnValue(makeAdmin(null) as never);
    const req = makeRequest("/api/profile/verify-change-otp", { otp: "abcdef" });
    const res = await POST(req as never);
    expect(res.status).toBe(422);
  });

  it("returns 429 with wait time when rate limited", async () => {
    mockCheckRL.mockReturnValue({ allowed: false, remaining: 0, resetTime: Date.now() + 600_000 });
    mockAdminClient.mockReturnValue(makeAdmin({ id: "x", code_hash: "h", attempts: 0, max_attempts: 5, expires_at: FUTURE, used: false }) as never);
    const req = makeRequest("/api/profile/verify-change-otp", { otp: "123456" });
    const res = await POST(req as never);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toMatch(/seconds/i);
  });

  it("returns 400 when no OTP record exists", async () => {
    mockAdminClient.mockReturnValue(makeAdmin(null) as never);
    const req = makeRequest("/api/profile/verify-change-otp", { otp: "123456" });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
  });

  it("returns 400 when attempts exhausted", async () => {
    const exhausted = { id: "o", code_hash: "h", attempts: 5, max_attempts: 5, expires_at: FUTURE, used: false };
    mockAdminClient.mockReturnValue(makeAdmin(exhausted) as never);
    const req = makeRequest("/api/profile/verify-change-otp", { otp: "123456" });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/too many failed/i);
  });

  it("includes remaining attempt count in wrong-code error message", async () => {
    const record = { id: "o", code_hash: "fakehash", attempts: 2, max_attempts: 5, expires_at: FUTURE, used: false };
    mockAdminClient.mockReturnValue(makeAdmin(record) as never);
    const req = makeRequest("/api/profile/verify-change-otp", { otp: "000000" });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/attempt/i);
  });
});
