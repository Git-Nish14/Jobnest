import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeChain } from "@/tests/helpers/supabase-mock";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/security/csrf", () => ({ verifyOrigin: vi.fn().mockReturnValue(true) }));

import { GET, POST } from "@/app/api/networking/referrals/route";
import { PATCH, DELETE } from "@/app/api/networking/referrals/[id]/route";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyOrigin } from "@/lib/security/csrf";

const mockCreate       = vi.mocked(createClient);
const mockCheckRL      = vi.mocked(checkRateLimit);
const mockVerifyOrigin = vi.mocked(verifyOrigin);

const USER_ID    = "user-aaaaaaaa-0000-0000-0000-000000000000";
const REFERRAL_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

const REFERRAL_ROW = {
  id: REFERRAL_ID, user_id: USER_ID, application_id: null, contact_id: null,
  status: "Requested", referral_date: null, notes: null,
  created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
};

function makeClient(user: unknown = { id: USER_ID }, rows: unknown[] = []) {
  const chain = makeChain({ data: rows, error: null });
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    from: vi.fn().mockReturnValue(chain),
  };
}

function req(method: string, body?: unknown) {
  return new Request("http://localhost/api/networking/referrals", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function idReq(method: string, id: string, body?: unknown) {
  return new Request(`http://localhost/api/networking/referrals/${id}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRL.mockReturnValue({ allowed: true, remaining: 9, resetTime: Date.now() + 60_000 });
  mockCreate.mockResolvedValue(makeClient() as never);
  mockVerifyOrigin.mockReturnValue(true);
});

describe("GET /api/networking/referrals", () => {
  it("returns 200 with referral list", async () => {
    mockCreate.mockResolvedValue(makeClient({ id: USER_ID }, [REFERRAL_ROW]) as never);
    const res = await GET(req("GET") as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.referrals).toHaveLength(1);
  });

  it("returns 401 when not authenticated", async () => {
    mockCreate.mockResolvedValue(makeClient(null) as never);
    const res = await GET(req("GET") as never);
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRL.mockReturnValue({ allowed: false, remaining: 0, resetTime: Date.now() + 60_000 });
    const res = await GET(req("GET") as never);
    expect(res.status).toBe(429);
  });
});

describe("POST /api/networking/referrals", () => {
  it("returns 201 on success with user_id from auth (no application_id)", async () => {
    mockCreate.mockResolvedValue(makeClient({ id: USER_ID }, [{ ...REFERRAL_ROW, id: "new-id" }]) as never);
    const res = await POST(req("POST", { status: "Requested" }) as never);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.referral).toBeTruthy();
  });

  it("returns 403 when application_id belongs to another user", async () => {
    // Simulate: app ownership check returns no row (belongs to someone else)
    const chain = makeChain({ data: null, error: { message: "not found" } });
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } }, error: null }) },
      from: vi.fn().mockReturnValue(chain),
    };
    mockCreate.mockResolvedValue(client as never);
    const res = await POST(
      req("POST", { status: "Requested", application_id: REFERRAL_ID }) as never,
    );
    expect(res.status).toBe(403);
  });

  it("returns 403 when CSRF fails", async () => {
    mockVerifyOrigin.mockReturnValue(false);
    const res = await POST(req("POST", { status: "Requested" }) as never);
    expect(res.status).toBe(403);
  });

  it("returns 401 when not authenticated", async () => {
    mockCreate.mockResolvedValue(makeClient(null) as never);
    const res = await POST(req("POST", { status: "Requested" }) as never);
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRL.mockReturnValue({ allowed: false, remaining: 0, resetTime: Date.now() + 60_000 });
    const res = await POST(req("POST", { status: "Requested" }) as never);
    expect(res.status).toBe(429);
  });

  it("returns 400 for invalid status enum", async () => {
    const res = await POST(req("POST", { status: "InvalidStatus" }) as never);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid referral_date format", async () => {
    const res = await POST(req("POST", { status: "Requested", referral_date: "not-a-date" }) as never);
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/networking/referrals/[id]", () => {
  it("returns 200 on success (no application_id change)", async () => {
    mockCreate.mockResolvedValue(makeClient({ id: USER_ID }, [{ ...REFERRAL_ROW, status: "Submitted" }]) as never);
    const res = await PATCH(
      idReq("PATCH", REFERRAL_ID, { status: "Submitted" }) as never,
      { params: Promise.resolve({ id: REFERRAL_ID }) },
    );
    expect(res.status).toBe(200);
  });

  it("returns 403 when application_id being set belongs to another user", async () => {
    const chain = makeChain({ data: null, error: { message: "not found" } });
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } }, error: null }) },
      from: vi.fn().mockReturnValue(chain),
    };
    mockCreate.mockResolvedValue(client as never);
    const res = await PATCH(
      idReq("PATCH", REFERRAL_ID, { application_id: REFERRAL_ID }) as never,
      { params: Promise.resolve({ id: REFERRAL_ID }) },
    );
    expect(res.status).toBe(403);
  });

  it("returns 403 when CSRF fails", async () => {
    mockVerifyOrigin.mockReturnValue(false);
    const res = await PATCH(
      idReq("PATCH", REFERRAL_ID, { status: "Submitted" }) as never,
      { params: Promise.resolve({ id: REFERRAL_ID }) },
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 for non-UUID id", async () => {
    const res = await PATCH(
      idReq("PATCH", "not-a-uuid", { status: "Submitted" }) as never,
      { params: Promise.resolve({ id: "not-a-uuid" }) },
    );
    expect(res.status).toBe(400);
  });

  it("enforces ownership via user_id eq", async () => {
    const client = makeClient({ id: USER_ID }, [REFERRAL_ROW]);
    mockCreate.mockResolvedValue(client as never);
    await PATCH(
      idReq("PATCH", REFERRAL_ID, { status: "Submitted" }) as never,
      { params: Promise.resolve({ id: REFERRAL_ID }) },
    );
    const chain = client.from.mock.results[0].value;
    expect(chain.eq).toHaveBeenCalledWith("user_id", USER_ID);
  });
});

describe("DELETE /api/networking/referrals/[id]", () => {
  it("returns 200 on success", async () => {
    const res = await DELETE(
      idReq("DELETE", REFERRAL_ID) as never,
      { params: Promise.resolve({ id: REFERRAL_ID }) },
    );
    expect(res.status).toBe(200);
  });

  it("returns 403 when CSRF fails", async () => {
    mockVerifyOrigin.mockReturnValue(false);
    const res = await DELETE(
      idReq("DELETE", REFERRAL_ID) as never,
      { params: Promise.resolve({ id: REFERRAL_ID }) },
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 for non-UUID id", async () => {
    const res = await DELETE(
      idReq("DELETE", "bad-id") as never,
      { params: Promise.resolve({ id: "bad-id" }) },
    );
    expect(res.status).toBe(400);
  });

  it("ownership eq called with user_id", async () => {
    const client = makeClient({ id: USER_ID });
    mockCreate.mockResolvedValue(client as never);
    await DELETE(
      idReq("DELETE", REFERRAL_ID) as never,
      { params: Promise.resolve({ id: REFERRAL_ID }) },
    );
    const chain = client.from.mock.results[0].value;
    expect(chain.eq).toHaveBeenCalledWith("user_id", USER_ID);
  });
});
