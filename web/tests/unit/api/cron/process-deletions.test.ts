import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeChain } from "@/tests/helpers/supabase-mock";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/email/nodemailer", () => ({
  sendDeletionReminderEmail: vi.fn().mockResolvedValue({ success: true }),
  sendDeletionFinalWarningEmail: vi.fn().mockResolvedValue({ success: true }),
}));
vi.mock("@/lib/stripe", () => ({
  isStripeConfigured: vi.fn().mockReturnValue(false),
  getStripe: vi.fn().mockReturnValue({
    customers: { del: vi.fn().mockResolvedValue({}) },
  }),
}));

import { GET } from "@/app/api/cron/process-deletions/route";
import { createAdminClient } from "@/lib/supabase/admin";
import { isStripeConfigured, getStripe } from "@/lib/stripe";

const mockAdminClient   = vi.mocked(createAdminClient);
const mockIsStripe      = vi.mocked(isStripeConfigured);
const mockGetStripe     = vi.mocked(getStripe);

const CRON_SECRET = "test-cron-secret"; // set in vitest-setup.ts

function makeGetRequest(authHeader: string | null) {
  const headers: Record<string, string> = {};
  if (authHeader) headers["authorization"] = authHeader;
  return new NextRequest("http://localhost/api/cron/process-deletions", { headers });
}

/** Minimal storage mock — list returns empty by default (no files to delete). */
function makeStorageMock(listItems: unknown[] = []) {
  const removeMock = vi.fn().mockResolvedValue({ data: null, error: null });
  const listMock   = vi.fn().mockResolvedValue({ data: listItems, error: null });
  return {
    _removeMock: removeMock,
    _listMock: listMock,
    from: vi.fn().mockReturnValue({ list: listMock, remove: removeMock }),
  };
}

function makeAdmin(dueRecords: unknown[] = [], activeRecords: unknown[] = [], storageMock = makeStorageMock()) {
  let callCount = 0;
  return {
    from: vi.fn(() => {
      const chain = makeChain({ data: callCount === 0 ? dueRecords : activeRecords, error: null });
      callCount++;
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
    storage: storageMock,
    auth: { admin: { deleteUser: vi.fn().mockResolvedValue({ error: null }) } },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Stripe disabled by default — individual tests opt-in
  mockIsStripe.mockReturnValue(false);
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

// ── Storage purge ─────────────────────────────────────────────────────────────

describe("GET /api/cron/process-deletions — storage purge", () => {
  it("calls storage.list then storage.remove for each found file", async () => {
    const dueRecord = { id: "del-1", user_id: "uid-1", email: "user@test.com" };
    const fakeFile  = { id: "file-id-1", name: "resume.pdf" };
    const storage   = makeStorageMock([fakeFile]);
    const admin     = makeAdmin([dueRecord], [], storage);

    mockAdminClient.mockReturnValue(admin as never);
    const req = makeGetRequest(`Bearer ${CRON_SECRET}`);
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.permanentlyDeleted).toBe(1);
    // list was called with the user's id as the prefix
    expect(storage._listMock).toHaveBeenCalledWith("uid-1", expect.objectContaining({ limit: 1000 }));
    // remove was called with the full path
    expect(storage._removeMock).toHaveBeenCalledWith(
      expect.arrayContaining(["uid-1/resume.pdf"])
    );
  });

  it("continues with auth deletion even when storage list returns empty", async () => {
    const dueRecord = { id: "del-1", user_id: "uid-1", email: "user@test.com" };
    const storage   = makeStorageMock([]); // no files
    const admin     = makeAdmin([dueRecord], [], storage);

    mockAdminClient.mockReturnValue(admin as never);
    const res = await GET(makeGetRequest(`Bearer ${CRON_SECRET}`));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.permanentlyDeleted).toBe(1);
    expect(storage._removeMock).not.toHaveBeenCalled();
  });

  it("records a non-fatal error when storage list fails but still deletes the user", async () => {
    const dueRecord = { id: "del-1", user_id: "uid-1", email: "user@test.com" };
    const storage   = makeStorageMock();
    storage._listMock.mockResolvedValue({ data: null, error: { message: "bucket error" } });
    const admin = makeAdmin([dueRecord], [], storage);

    mockAdminClient.mockReturnValue(admin as never);
    const res = await GET(makeGetRequest(`Bearer ${CRON_SECRET}`));
    const body = await res.json();

    expect(res.status).toBe(200);
    // User is still deleted (storage failure is non-fatal)
    expect(body.permanentlyDeleted).toBe(1);
  });
});

// ── Stripe customer purge ─────────────────────────────────────────────────────

describe("GET /api/cron/process-deletions — Stripe purge", () => {
  it("deletes the Stripe customer when isStripeConfigured() returns true", async () => {
    const dueRecord = { id: "del-1", user_id: "uid-1", email: "user@test.com" };
    const admin     = makeAdmin([dueRecord], []);

    // Override from() to return stripe_customer_id on the subscriptions query
    const originalFrom = admin.from;
    let callIdx = 0;
    admin.from = vi.fn((table: string) => {
      callIdx++;
      if (callIdx === 1) return originalFrom(table); // pending_deletions lte
      if (table === "subscriptions") {
        return makeChain({ data: { stripe_customer_id: "cus_test123" }, error: null });
      }
      return originalFrom(table);
    });

    const mockCustomersDel = vi.fn().mockResolvedValue({});
    mockIsStripe.mockReturnValue(true);
    mockGetStripe.mockReturnValue({ customers: { del: mockCustomersDel } } as never);
    mockAdminClient.mockReturnValue(admin as never);

    await GET(makeGetRequest(`Bearer ${CRON_SECRET}`));

    expect(mockCustomersDel).toHaveBeenCalledWith("cus_test123");
  });

  it("skips Stripe deletion when isStripeConfigured() is false", async () => {
    const dueRecord = { id: "del-1", user_id: "uid-1", email: "user@test.com" };
    const admin     = makeAdmin([dueRecord], []);

    const mockCustomersDel = vi.fn().mockResolvedValue({});
    mockIsStripe.mockReturnValue(false);
    mockGetStripe.mockReturnValue({ customers: { del: mockCustomersDel } } as never);
    mockAdminClient.mockReturnValue(admin as never);

    await GET(makeGetRequest(`Bearer ${CRON_SECRET}`));

    expect(mockCustomersDel).not.toHaveBeenCalled();
  });

  it("does not fail the whole deletion when Stripe customer.del throws", async () => {
    const dueRecord = { id: "del-1", user_id: "uid-1", email: "stripe-down@test.com" };
    const storage   = makeStorageMock([]);

    // Build admin with a from() that handles each sequential call correctly
    const admin = {
      storage,
      auth: { admin: { deleteUser: vi.fn().mockResolvedValue({ error: null }) } },
      from: (() => {
        // Call order:
        // 0 → pending_deletions lte (due records)
        // 1 → pending_deletions delete (after deleteUser)
        // 2+ → erasure table checks
        let idx = 0;
        return vi.fn(() => {
          const call = idx++;
          if (call === 0) {
            const ch = makeChain({ data: null, error: null });
            ch.lte = vi.fn().mockReturnValue({
              ...ch,
              then: (r: (v: unknown) => void) =>
                Promise.resolve({ data: [dueRecord], error: null }).then(r),
            });
            ch.gt = vi.fn().mockReturnValue({
              ...ch,
              then: (r: (v: unknown) => void) =>
                Promise.resolve({ data: [], error: null }).then(r),
            });
            return ch;
          }
          if (call === 1) return makeChain({ data: null, error: null }); // subscriptions maybeSingle
          // Remaining: delete + erasure checks
          return makeChain({ data: null, error: null, count: 0 });
        });
      })(),
    };

    // subscriptions maybeSingle (second from() call) needs to return customer id
    const origFrom = admin.from;
    let subCallIdx = 0;
    admin.from = vi.fn((...args: unknown[]) => {
      const chain = (origFrom as (...a: unknown[]) => unknown)(...args) as Record<string, unknown>;
      subCallIdx++;
      if (subCallIdx === 2) {
        // Override maybeSingle to return a customer id
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: { stripe_customer_id: "cus_bad" }, error: null,
        });
      }
      return chain;
    }) as typeof origFrom;

    mockIsStripe.mockReturnValue(true);
    mockGetStripe.mockReturnValue({
      customers: { del: vi.fn().mockRejectedValue(new Error("Stripe API down")) },
    } as never);
    mockAdminClient.mockReturnValue(admin as never);

    const res  = await GET(makeGetRequest(`Bearer ${CRON_SECRET}`));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.permanentlyDeleted).toBe(1);
  });
});
