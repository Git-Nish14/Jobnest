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
