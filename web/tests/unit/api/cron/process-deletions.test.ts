import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeChain } from "@/tests/helpers/supabase-mock";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/email/nodemailer", () => ({
  sendDeletionReminderEmail: vi.fn().mockResolvedValue({ success: true }),
  sendDeletionFinalWarningEmail: vi.fn().mockResolvedValue({ success: true }),
}));

import { GET } from "@/app/api/cron/process-deletions/route";
import { createAdminClient } from "@/lib/supabase/admin";

const mockAdminClient = vi.mocked(createAdminClient);

const CRON_SECRET = "test-cron-secret"; // set in vitest-setup.ts

function makeGetRequest(authHeader: string | null) {
  const headers: Record<string, string> = {};
  if (authHeader) headers["authorization"] = authHeader;
  return new NextRequest("http://localhost/api/cron/process-deletions", { headers });
}

function makeAdmin(dueRecords: unknown[] = [], activeRecords: unknown[] = []) {
  let callCount = 0;
  return {
    from: vi.fn(() => {
      const chain = makeChain({ data: callCount === 0 ? dueRecords : activeRecords, error: null });
      callCount++;
      // Override lte/gt to return chain with the right data
      chain.lte = vi.fn().mockReturnValue({
        ...chain,
        then: (r: (v: unknown) => void) =>
          Promise.resolve({ data: dueRecords, error: null }).then(r),
      });
      chain.gt = vi.fn().mockReturnValue({
        ...chain,
        then: (r: (v: unknown) => void) =>
          Promise.resolve({ data: activeRecords, error: null }).then(r),
      });
      return chain;
    }),
    auth: { admin: { deleteUser: vi.fn().mockResolvedValue({ error: null }) } },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/cron/process-deletions — auth", () => {
  it("returns 401 when Authorization header is missing", async () => {
    mockAdminClient.mockReturnValue(makeAdmin() as never);
    const req = makeGetRequest(null);
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when secret is wrong", async () => {
    mockAdminClient.mockReturnValue(makeAdmin() as never);
    const req = makeGetRequest("Bearer wrong-secret");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 for malformed header (no Bearer prefix)", async () => {
    mockAdminClient.mockReturnValue(makeAdmin() as never);
    const req = makeGetRequest(CRON_SECRET); // no "Bearer "
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 200 with correct secret", async () => {
    mockAdminClient.mockReturnValue(makeAdmin() as never);
    const req = makeGetRequest(`Bearer ${CRON_SECRET}`);
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("result includes deletion counters", async () => {
    mockAdminClient.mockReturnValue(makeAdmin() as never);
    const req = makeGetRequest(`Bearer ${CRON_SECRET}`);
    const res = await GET(req);
    const body = await res.json();
    expect(typeof body.permanentlyDeleted).toBe("number");
    expect(typeof body.remindersSent).toBe("number");
    expect(typeof body.finalWarningsSent).toBe("number");
    expect(Array.isArray(body.errors)).toBe(true);
  });

  it("is fail-closed: 401 when CRON_SECRET env var is empty string", async () => {
    const original = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "";
    mockAdminClient.mockReturnValue(makeAdmin() as never);
    const req = makeGetRequest("Bearer ");
    const res = await GET(req);
    expect(res.status).toBe(401);
    process.env.CRON_SECRET = original;
  });
});

describe("GET /api/cron/process-deletions — erasure verification", () => {
  it("reports no errors when all orphan checks return 0 rows", async () => {
    // One due-for-deletion record → deleteUser succeeds → all table checks return count=0
    const dueRecord = { id: "del-1", user_id: "uid-1", email: "user@test.com" };
    const admin = makeAdmin([dueRecord], []);

    // Override from() to return count: 0 for erasure table queries
    const originalFrom = admin.from;
    let callIdx = 0;
    admin.from = vi.fn((table: string) => {
      callIdx++;
      // First call = pending_deletions lte query, second = pending_deletions delete
      if (callIdx <= 2) return originalFrom(table);
      // Subsequent calls are erasure checks — return count: 0
      const chain = makeChain({ count: 0, data: null, error: null });
      return chain;
    });

    mockAdminClient.mockReturnValue(admin as never);
    const req = makeGetRequest(`Bearer ${CRON_SECRET}`);
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.permanentlyDeleted).toBe(1);
    // No erasure-check errors
    const erasureErrors = body.errors.filter((e: string) => e.includes("erasure-check"));
    expect(erasureErrors).toHaveLength(0);
  });

  it("adds to errors when orphaned rows remain after deletion", async () => {
    const dueRecord = { id: "del-1", user_id: "uid-1", email: "orphan@test.com" };
    const admin = makeAdmin([dueRecord], []);

    // Simulate orphaned rows in job_applications (count: 3)
    let callIdx = 0;
    admin.from = vi.fn((table: string) => {
      callIdx++;
      if (callIdx <= 2) return makeChain({ data: [dueRecord], error: null });
      // Return count > 0 for job_applications only, 0 for all others
      const orphanCount = table === "job_applications" ? 3 : 0;
      return makeChain({ count: orphanCount, data: null, error: null });
    });
    admin.auth.admin.deleteUser = vi.fn().mockResolvedValue({ error: null });

    mockAdminClient.mockReturnValue(admin as never);
    const req = makeGetRequest(`Bearer ${CRON_SECRET}`);
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    // Still counts as permanently deleted (auth deletion succeeded)
    expect(body.permanentlyDeleted).toBe(1);
    // Erasure warning is recorded
    const erasureErrors = body.errors.filter((e: string) => e.includes("erasure-check"));
    expect(erasureErrors.length).toBeGreaterThan(0);
    expect(erasureErrors[0]).toContain("orphan@test.com");
  });

  it("does not perform erasure check when deleteUser fails", async () => {
    const dueRecord = { id: "del-1", user_id: "uid-1", email: "fail@test.com" };
    const admin = makeAdmin([dueRecord], []);
    admin.auth.admin.deleteUser = vi.fn().mockResolvedValue({
      error: { message: "delete failed" },
    });

    mockAdminClient.mockReturnValue(admin as never);
    const req = makeGetRequest(`Bearer ${CRON_SECRET}`);
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.permanentlyDeleted).toBe(0);
    // Error recorded for deleteUser failure
    expect(body.errors.some((e: string) => e.includes("fail@test.com"))).toBe(true);
  });
});
