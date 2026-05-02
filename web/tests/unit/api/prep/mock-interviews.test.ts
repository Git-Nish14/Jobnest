/**
 * Unit tests — /api/prep/mock-interviews (GET, POST) and /[id] (PATCH, DELETE)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeChain } from "@/tests/helpers/supabase-mock";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: vi.fn() }));

import { GET, POST } from "@/app/api/prep/mock-interviews/route";
import { PATCH, DELETE } from "@/app/api/prep/mock-interviews/[id]/route";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";

const mockCreate  = vi.mocked(createClient);
const mockCheckRL = vi.mocked(checkRateLimit);

const USER_ID = "user-mock";
const MOCK_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

function makeClient(user: unknown = { id: USER_ID }) {
  const chain = makeChain({ data: { id: MOCK_ID }, error: null });
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    from: vi.fn().mockReturnValue(chain),
  };
}

function req(method: string, body?: unknown, origin?: string): Request {
  return new Request("http://localhost/api/prep/mock-interviews", {
    method,
    headers: { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function idReq(method: string, id: string, body?: unknown, origin?: string): Request {
  return new Request(`http://localhost/api/prep/mock-interviews/${id}`, {
    method,
    headers: { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const validBody = { scheduled_at: "2026-05-01T10:00:00Z", type: "DSA" };

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRL.mockReturnValue({ allowed: true, remaining: 9, resetTime: Date.now() + 60_000 });
  mockCreate.mockResolvedValue(makeClient() as never);
});

describe("GET /api/prep/mock-interviews", () => {
  it("returns 401 when not authenticated", async () => {
    mockCreate.mockResolvedValue(makeClient(null) as never);
    const res = await GET(req("GET") as never);
    expect(res.status).toBe(401);
  });

  it("returns 200 with mockInterviews array", async () => {
    const res = await GET(req("GET") as never);
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveProperty("mockInterviews");
  });
});

describe("POST /api/prep/mock-interviews — security & validation", () => {
  it("returns 403 for cross-site origin (CSRF)", async () => {
    const res = await POST(req("POST", validBody, "http://evil.example.com") as never);
    expect(res.status).toBe(403);
  });

  it("returns 401 when not authenticated", async () => {
    mockCreate.mockResolvedValue(makeClient(null) as never);
    const res = await POST(req("POST", validBody) as never);
    expect(res.status).toBe(401);
  });

  it("returns 400 when scheduled_at is missing", async () => {
    const { scheduled_at: _, ...noDate } = validBody;
    const res = await POST(req("POST", noDate) as never);
    expect(res.status).toBe(400);
  });

  it("returns 400 when type is invalid", async () => {
    const res = await POST(req("POST", { ...validBody, type: "InvalidType" }) as never);
    expect(res.status).toBe(400);
  });

  it("returns 400 when score is out of range (> 5)", async () => {
    const res = await POST(req("POST", { ...validBody, score: 6 }) as never);
    expect(res.status).toBe(400);
  });

  it("returns 201 on valid input", async () => {
    const res = await POST(req("POST", validBody) as never);
    expect(res.status).toBe(201);
  });
});

describe("PATCH /api/prep/mock-interviews/[id]", () => {
  it("returns 403 for cross-site origin", async () => {
    const res = await PATCH(
      idReq("PATCH", MOCK_ID, { status: "Completed" }, "http://evil.example.com") as never,
      { params: Promise.resolve({ id: MOCK_ID }) }
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 for non-UUID id", async () => {
    const res = await PATCH(
      idReq("PATCH", "bad", { status: "Completed" }) as never,
      { params: Promise.resolve({ id: "bad" }) }
    );
    expect(res.status).toBe(400);
  });

  it("enforces user_id ownership on update", async () => {
    const chain = makeChain({ data: { id: MOCK_ID, status: "Completed" }, error: null });
    const client = { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } }, error: null }) }, from: vi.fn().mockReturnValue(chain) };
    mockCreate.mockResolvedValue(client as never);
    await PATCH(idReq("PATCH", MOCK_ID, { status: "Completed" }) as never, { params: Promise.resolve({ id: MOCK_ID }) });
    expect(chain.eq).toHaveBeenCalledWith("user_id", USER_ID);
  });
});

describe("DELETE /api/prep/mock-interviews/[id]", () => {
  it("returns 403 for cross-site origin", async () => {
    const res = await DELETE(
      idReq("DELETE", MOCK_ID, undefined, "http://evil.example.com") as never,
      { params: Promise.resolve({ id: MOCK_ID }) }
    );
    expect(res.status).toBe(403);
  });

  it("returns 200 and enforces user_id ownership", async () => {
    const chain = makeChain({ data: null, error: null });
    const client = { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } }, error: null }) }, from: vi.fn().mockReturnValue(chain) };
    mockCreate.mockResolvedValue(client as never);
    const res = await DELETE(idReq("DELETE", MOCK_ID) as never, { params: Promise.resolve({ id: MOCK_ID }) });
    expect(res.status).toBe(200);
    expect(chain.eq).toHaveBeenCalledWith("user_id", USER_ID);
  });
});
