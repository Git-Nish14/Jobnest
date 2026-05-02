/**
 * Unit tests — /api/prep/problems (GET, POST) and /api/prep/problems/[id] (PATCH, DELETE)
 *
 * Covers: CSRF guard, auth, rate-limit, input validation, ownership enforcement.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeChain } from "@/tests/helpers/supabase-mock";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: vi.fn() }));

import { GET, POST } from "@/app/api/prep/problems/route";
import { PATCH, DELETE } from "@/app/api/prep/problems/[id]/route";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";

const mockCreate = vi.mocked(createClient);
const mockCheckRL = vi.mocked(checkRateLimit);

const USER_ID    = "user-111";
const PROBLEM_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

function makeClient(user: unknown = { id: USER_ID }, rows: unknown[] = []) {
  const chain = makeChain({ data: rows, error: null });
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    from: vi.fn().mockReturnValue(chain),
  };
}

function json(body: unknown, origin?: string): Request {
  return new Request("http://localhost/api/prep/problems", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) },
    body: JSON.stringify(body),
  });
}

function getReq(params?: Record<string, string>): Request {
  const url = new URL("http://localhost/api/prep/problems");
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new Request(url.toString());
}

function idReq(method: string, id: string, body?: unknown, origin?: string): Request {
  return new Request(`http://localhost/api/prep/problems/${id}`, {
    method,
    headers: { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const validProblem = {
  title: "Two Sum", difficulty: "Easy", topic: "Array", status: "Todo",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRL.mockReturnValue({ allowed: true, remaining: 9, resetTime: Date.now() + 60_000 });
  mockCreate.mockResolvedValue(makeClient() as never);
});

// ── GET /api/prep/problems ────────────────────────────────────────────────────

describe("GET /api/prep/problems", () => {
  it("returns 401 when not authenticated", async () => {
    mockCreate.mockResolvedValue(makeClient(null) as never);
    const res = await GET(getReq() as never);
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRL.mockReturnValue({ allowed: false, remaining: 0, resetTime: Date.now() + 60_000 });
    const res = await GET(getReq() as never);
    expect(res.status).toBe(429);
  });

  it("returns 200 with problems array", async () => {
    mockCreate.mockResolvedValue(makeClient({ id: USER_ID }, [validProblem]) as never);
    const res = await GET(getReq() as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.problems)).toBe(true);
  });

  it("enforces user_id filter (owns only own data)", async () => {
    const client = makeClient({ id: USER_ID }, []);
    mockCreate.mockResolvedValue(client as never);
    await GET(getReq() as never);
    const chain = client.from("coding_problems");
    // eq("user_id", user.id) must be called
    expect(chain.eq).toHaveBeenCalledWith("user_id", USER_ID);
  });
});

// ── POST /api/prep/problems ───────────────────────────────────────────────────

describe("POST /api/prep/problems", () => {
  it("returns 403 for cross-site origin (CSRF)", async () => {
    const res = await POST(json(validProblem, "http://evil.example.com") as never);
    expect(res.status).toBe(403);
  });

  it("returns 401 when not authenticated", async () => {
    mockCreate.mockResolvedValue(makeClient(null) as never);
    const res = await POST(json(validProblem) as never);
    expect(res.status).toBe(401);
  });

  it("returns 400 when title is missing", async () => {
    const { title: _, ...noTitle } = validProblem;
    const res = await POST(json(noTitle) as never);
    expect(res.status).toBe(400);
  });

  it("returns 400 when difficulty is invalid", async () => {
    const res = await POST(json({ ...validProblem, difficulty: "XHard" }) as never);
    expect(res.status).toBe(400);
  });

  it("inserts with user_id set from auth (not from request body)", async () => {
    const client = makeClient({ id: USER_ID });
    const insertedRow = { id: PROBLEM_ID, ...validProblem, user_id: USER_ID };
    const chain = makeChain({ data: insertedRow, error: null });
    client.from = vi.fn().mockReturnValue(chain);
    mockCreate.mockResolvedValue(client as never);
    const res = await POST(json(validProblem) as never);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.problem.user_id).toBe(USER_ID);
  });
});

// ── PATCH /api/prep/problems/[id] ────────────────────────────────────────────

describe("PATCH /api/prep/problems/[id]", () => {
  it("returns 403 for cross-site origin (CSRF)", async () => {
    const res = await PATCH(
      idReq("PATCH", PROBLEM_ID, { status: "Solved" }, "http://evil.example.com") as never,
      { params: Promise.resolve({ id: PROBLEM_ID }) }
    );
    expect(res.status).toBe(403);
  });

  it("returns 401 when not authenticated", async () => {
    mockCreate.mockResolvedValue(makeClient(null) as never);
    const res = await PATCH(
      idReq("PATCH", PROBLEM_ID, { status: "Solved" }) as never,
      { params: Promise.resolve({ id: PROBLEM_ID }) }
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 for non-UUID id", async () => {
    const res = await PATCH(
      idReq("PATCH", "not-a-uuid", { status: "Solved" }) as never,
      { params: Promise.resolve({ id: "not-a-uuid" }) }
    );
    expect(res.status).toBe(400);
  });

  it("enforces ownership via .eq('user_id', userId)", async () => {
    const chain = makeChain({ data: { id: PROBLEM_ID, status: "Solved" }, error: null });
    const client = { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } }, error: null }) }, from: vi.fn().mockReturnValue(chain) };
    mockCreate.mockResolvedValue(client as never);
    await PATCH(idReq("PATCH", PROBLEM_ID, { status: "Solved" }) as never, { params: Promise.resolve({ id: PROBLEM_ID }) });
    expect(chain.eq).toHaveBeenCalledWith("user_id", USER_ID);
  });
});

// ── DELETE /api/prep/problems/[id] ───────────────────────────────────────────

describe("DELETE /api/prep/problems/[id]", () => {
  it("returns 403 for cross-site origin (CSRF)", async () => {
    const res = await DELETE(
      idReq("DELETE", PROBLEM_ID, undefined, "http://evil.example.com") as never,
      { params: Promise.resolve({ id: PROBLEM_ID }) }
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 for non-UUID id", async () => {
    const res = await DELETE(
      idReq("DELETE", "bad-id") as never,
      { params: Promise.resolve({ id: "bad-id" }) }
    );
    expect(res.status).toBe(400);
  });

  it("returns 200 on success and enforces ownership", async () => {
    const chain = makeChain({ data: null, error: null });
    const client = { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } }, error: null }) }, from: vi.fn().mockReturnValue(chain) };
    mockCreate.mockResolvedValue(client as never);
    const res = await DELETE(
      idReq("DELETE", PROBLEM_ID) as never,
      { params: Promise.resolve({ id: PROBLEM_ID }) }
    );
    expect(res.status).toBe(200);
    expect(chain.eq).toHaveBeenCalledWith("user_id", USER_ID);
  });
});
