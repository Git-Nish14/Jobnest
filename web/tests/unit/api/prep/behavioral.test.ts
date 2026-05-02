/**
 * Unit tests — /api/prep/behavioral (GET, POST) and /[id] (PATCH, DELETE)
 *
 * Covers: CSRF, auth, input validation, ownership enforcement.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeChain } from "@/tests/helpers/supabase-mock";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: vi.fn() }));

import { GET, POST } from "@/app/api/prep/behavioral/route";
import { PATCH, DELETE } from "@/app/api/prep/behavioral/[id]/route";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";

const mockCreate  = vi.mocked(createClient);
const mockCheckRL = vi.mocked(checkRateLimit);

const USER_ID    = "user-behave";
const ANSWER_ID  = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

function makeClient(user: unknown = { id: USER_ID }) {
  const chain = makeChain({ data: { id: ANSWER_ID }, error: null });
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    from: vi.fn().mockReturnValue(chain),
  };
}

function req(method: string, body?: unknown, origin?: string): Request {
  return new Request("http://localhost/api/prep/behavioral", {
    method,
    headers: { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function idReq(method: string, id: string, body?: unknown, origin?: string): Request {
  return new Request(`http://localhost/api/prep/behavioral/${id}`, {
    method,
    headers: { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const validAnswer = { question: "Tell me about a conflict you resolved." };

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRL.mockReturnValue({ allowed: true, remaining: 9, resetTime: Date.now() + 60_000 });
  mockCreate.mockResolvedValue(makeClient() as never);
});

describe("GET /api/prep/behavioral", () => {
  it("returns 401 when not authenticated", async () => {
    mockCreate.mockResolvedValue(makeClient(null) as never);
    const res = await GET(req("GET") as never);
    expect(res.status).toBe(401);
  });

  it("returns 200 with answers", async () => {
    const res = await GET(req("GET") as never);
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveProperty("answers");
  });
});

describe("POST /api/prep/behavioral", () => {
  it("returns 403 for cross-site origin", async () => {
    const res = await POST(req("POST", validAnswer, "http://evil.example.com") as never);
    expect(res.status).toBe(403);
  });

  it("returns 401 when not authenticated", async () => {
    mockCreate.mockResolvedValue(makeClient(null) as never);
    const res = await POST(req("POST", validAnswer) as never);
    expect(res.status).toBe(401);
  });

  it("returns 400 when question is missing", async () => {
    const res = await POST(req("POST", {}) as never);
    expect(res.status).toBe(400);
  });

  it("returns 400 when competency is invalid", async () => {
    const res = await POST(req("POST", { ...validAnswer, competency: "InvalidValue" }) as never);
    expect(res.status).toBe(400);
  });

  it("returns 201 on valid input and enforces user_id from auth", async () => {
    const chain = makeChain({ data: { id: ANSWER_ID, ...validAnswer, user_id: USER_ID }, error: null });
    const client = { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } }, error: null }) }, from: vi.fn().mockReturnValue(chain) };
    mockCreate.mockResolvedValue(client as never);
    const res = await POST(req("POST", validAnswer) as never);
    expect(res.status).toBe(201);
    expect((await res.json()).answer.user_id).toBe(USER_ID);
  });
});

describe("PATCH /api/prep/behavioral/[id]", () => {
  it("returns 403 for cross-site origin", async () => {
    const res = await PATCH(
      idReq("PATCH", ANSWER_ID, { situation: "At work..." }, "http://evil.example.com") as never,
      { params: Promise.resolve({ id: ANSWER_ID }) }
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 for non-UUID id", async () => {
    const res = await PATCH(
      idReq("PATCH", "bad-id", { situation: "..." }) as never,
      { params: Promise.resolve({ id: "bad-id" }) }
    );
    expect(res.status).toBe(400);
  });

  it("enforces user_id ownership", async () => {
    const chain = makeChain({ data: { id: ANSWER_ID }, error: null });
    const client = { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } }, error: null }) }, from: vi.fn().mockReturnValue(chain) };
    mockCreate.mockResolvedValue(client as never);
    await PATCH(idReq("PATCH", ANSWER_ID, { situation: "..." }) as never, { params: Promise.resolve({ id: ANSWER_ID }) });
    expect(chain.eq).toHaveBeenCalledWith("user_id", USER_ID);
  });
});

describe("DELETE /api/prep/behavioral/[id]", () => {
  it("returns 403 for cross-site origin", async () => {
    const res = await DELETE(
      idReq("DELETE", ANSWER_ID, undefined, "http://evil.example.com") as never,
      { params: Promise.resolve({ id: ANSWER_ID }) }
    );
    expect(res.status).toBe(403);
  });

  it("returns 200 and enforces user_id ownership", async () => {
    const chain = makeChain({ data: null, error: null });
    const client = { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } }, error: null }) }, from: vi.fn().mockReturnValue(chain) };
    mockCreate.mockResolvedValue(client as never);
    const res = await DELETE(idReq("DELETE", ANSWER_ID) as never, { params: Promise.resolve({ id: ANSWER_ID }) });
    expect(res.status).toBe(200);
    expect(chain.eq).toHaveBeenCalledWith("user_id", USER_ID);
  });
});
