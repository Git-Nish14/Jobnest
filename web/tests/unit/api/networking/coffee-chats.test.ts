import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeChain } from "@/tests/helpers/supabase-mock";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/security/csrf", () => ({ verifyOrigin: vi.fn().mockReturnValue(true) }));

import { GET, POST } from "@/app/api/networking/coffee-chats/route";
import { PATCH, DELETE } from "@/app/api/networking/coffee-chats/[id]/route";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyOrigin } from "@/lib/security/csrf";

const mockCreate      = vi.mocked(createClient);
const mockAdminCreate = vi.mocked(createAdminClient);
const mockCheckRL     = vi.mocked(checkRateLimit);
const mockVerifyOrigin = vi.mocked(verifyOrigin);

const USER_ID = "user-aaaaaaaa-0000-0000-0000-000000000000";
const CHAT_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

const FUTURE_TS = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

const CHAT_ROW = {
  id: CHAT_ID, user_id: USER_ID, contact_id: null,
  scheduled_at: FUTURE_TS, medium: "Zoom", status: "Scheduled",
  agenda: null, notes: null, follow_up_sent: false, referral_outcome: null,
  created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
};

function makeAdminClient() {
  const chain = makeChain({ data: null, error: null });
  return { from: vi.fn().mockReturnValue(chain) };
}

function makeClient(user: unknown = { id: USER_ID }, rows: unknown[] = []) {
  const chain = makeChain({ data: rows, error: null });
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    from: vi.fn().mockReturnValue(chain),
  };
}

function req(method: string, body?: unknown) {
  return new Request("http://localhost/api/networking/coffee-chats", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function idReq(method: string, id: string, body?: unknown) {
  return new Request(`http://localhost/api/networking/coffee-chats/${id}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRL.mockReturnValue({ allowed: true, remaining: 9, resetTime: Date.now() + 60_000 });
  mockCreate.mockResolvedValue(makeClient() as never);
  mockAdminCreate.mockReturnValue(makeAdminClient() as never);
  mockVerifyOrigin.mockReturnValue(true);
});

describe("GET /api/networking/coffee-chats", () => {
  it("returns 200 with chat list", async () => {
    mockCreate.mockResolvedValue(makeClient({ id: USER_ID }, [CHAT_ROW]) as never);
    const res = await GET(req("GET") as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.chats).toHaveLength(1);
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

describe("POST /api/networking/coffee-chats", () => {
  it("returns 201 on success", async () => {
    mockCreate.mockResolvedValue(makeClient({ id: USER_ID }, [CHAT_ROW]) as never);
    const res = await POST(req("POST", { scheduled_at: FUTURE_TS, medium: "Zoom" }) as never);
    expect(res.status).toBe(201);
  });

  it("calls admin client to insert reminder for future chat", async () => {
    mockCreate.mockResolvedValue(makeClient({ id: USER_ID }, [CHAT_ROW]) as never);
    const adminClient = makeAdminClient();
    mockAdminCreate.mockReturnValue(adminClient as never);
    await POST(req("POST", { scheduled_at: FUTURE_TS, medium: "Zoom" }) as never);
    expect(adminClient.from).toHaveBeenCalledWith("reminders");
  });

  it("returns 403 when CSRF fails", async () => {
    mockVerifyOrigin.mockReturnValue(false);
    const res = await POST(req("POST", { scheduled_at: FUTURE_TS }) as never);
    expect(res.status).toBe(403);
  });

  it("returns 401 when not authenticated", async () => {
    mockCreate.mockResolvedValue(makeClient(null) as never);
    const res = await POST(req("POST", { scheduled_at: FUTURE_TS }) as never);
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRL.mockReturnValue({ allowed: false, remaining: 0, resetTime: Date.now() + 60_000 });
    const res = await POST(req("POST", { scheduled_at: FUTURE_TS }) as never);
    expect(res.status).toBe(429);
  });

  it("returns 400 for invalid datetime", async () => {
    const res = await POST(req("POST", { scheduled_at: "not-a-datetime" }) as never);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid medium", async () => {
    const res = await POST(req("POST", { scheduled_at: FUTURE_TS, medium: "Carrier Pigeon" }) as never);
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/networking/coffee-chats/[id]", () => {
  it("returns 200 on success", async () => {
    mockCreate.mockResolvedValue(makeClient({ id: USER_ID }, [{ ...CHAT_ROW, status: "Completed" }]) as never);
    const res = await PATCH(
      idReq("PATCH", CHAT_ID, { status: "Completed" }) as never,
      { params: Promise.resolve({ id: CHAT_ID }) },
    );
    expect(res.status).toBe(200);
  });

  it("returns 403 when CSRF fails", async () => {
    mockVerifyOrigin.mockReturnValue(false);
    const res = await PATCH(
      idReq("PATCH", CHAT_ID, { status: "Completed" }) as never,
      { params: Promise.resolve({ id: CHAT_ID }) },
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 for non-UUID id", async () => {
    const res = await PATCH(
      idReq("PATCH", "not-a-uuid", { status: "Completed" }) as never,
      { params: Promise.resolve({ id: "not-a-uuid" }) },
    );
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/networking/coffee-chats/[id]", () => {
  it("returns 200 on success", async () => {
    const res = await DELETE(
      idReq("DELETE", CHAT_ID) as never,
      { params: Promise.resolve({ id: CHAT_ID }) },
    );
    expect(res.status).toBe(200);
  });

  it("returns 403 when CSRF fails", async () => {
    mockVerifyOrigin.mockReturnValue(false);
    const res = await DELETE(
      idReq("DELETE", CHAT_ID) as never,
      { params: Promise.resolve({ id: CHAT_ID }) },
    );
    expect(res.status).toBe(403);
  });

  it("ownership eq called with user_id", async () => {
    const client = makeClient({ id: USER_ID });
    mockCreate.mockResolvedValue(client as never);
    await DELETE(
      idReq("DELETE", CHAT_ID) as never,
      { params: Promise.resolve({ id: CHAT_ID }) },
    );
    const chain = client.from.mock.results[0].value;
    expect(chain.eq).toHaveBeenCalledWith("user_id", USER_ID);
  });
});
