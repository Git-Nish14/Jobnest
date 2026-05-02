/**
 * Unit tests — /api/prep/assessments (GET, POST) and /[id] (PATCH, DELETE)
 *
 * Key security: CSRF, auth, IDOR (application_id must belong to requesting user).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeChain } from "@/tests/helpers/supabase-mock";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: vi.fn() }));

import { GET, POST } from "@/app/api/prep/assessments/route";
import { PATCH, DELETE } from "@/app/api/prep/assessments/[id]/route";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";

const mockCreate  = vi.mocked(createClient);
const mockCheckRL = vi.mocked(checkRateLimit);

const USER_ID   = "user-assess";
const ASSESS_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const APP_ID    = "11111111-2222-4333-8444-555555555555";
const OTHER_APP = "99999999-8888-4777-8666-555555555555";

/** Build client for POST when application_id is supplied.
 *  Route calls from("job_applications") first, then from("assessments").
 */
function makeClientForPost(user: unknown = { id: USER_ID }, appFound = true) {
  const appChain = makeChain(
    appFound
      ? { data: { id: APP_ID }, error: null }
      : { data: null, error: { code: "PGRST116", message: "not found" } }
  );
  const assessChain = makeChain({ data: { id: ASSESS_ID }, error: null });
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    from: vi.fn()
      .mockReturnValueOnce(appChain)    // first from() → job_applications (ownership check)
      .mockReturnValue(assessChain),    // second from() → assessments (insert)
  };
}

/** Client for POST when no application_id is provided — only assessments table hit. */
function makeClientNoApp(user: unknown = { id: USER_ID }) {
  const assessChain = makeChain({ data: { id: ASSESS_ID }, error: null });
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    from: vi.fn().mockReturnValue(assessChain),
  };
}

function makeClientForGet(user: unknown = { id: USER_ID }) {
  const chain = makeChain({ data: [{ id: ASSESS_ID }], error: null });
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    from: vi.fn().mockReturnValue(chain),
  };
}

function req(method: string, body?: unknown, origin?: string): Request {
  return new Request("http://localhost/api/prep/assessments", {
    method,
    headers: { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function idReq(method: string, id: string, body?: unknown, origin?: string): Request {
  return new Request(`http://localhost/api/prep/assessments/${id}`, {
    method,
    headers: { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const validTitle = { title: "HackerRank Challenge" };

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRL.mockReturnValue({ allowed: true, remaining: 9, resetTime: Date.now() + 60_000 });
  mockCreate.mockResolvedValue(makeClientForGet() as never);
});

// ── GET ───────────────────────────────────────────────────────────────────────

describe("GET /api/prep/assessments", () => {
  it("returns 401 when not authenticated", async () => {
    mockCreate.mockResolvedValue(makeClientForGet(null) as never);
    const res = await GET(req("GET") as never);
    expect(res.status).toBe(401);
  });

  it("returns 200 with assessments", async () => {
    const res = await GET(req("GET") as never);
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveProperty("assessments");
  });
});

// ── POST — CSRF, auth, validation ────────────────────────────────────────────

describe("POST /api/prep/assessments — gates & validation", () => {
  it("returns 403 for cross-site origin (CSRF)", async () => {
    mockCreate.mockResolvedValue(makeClientNoApp() as never);
    const res = await POST(req("POST", validTitle, "http://evil.example.com") as never);
    expect(res.status).toBe(403);
  });

  it("returns 401 when not authenticated", async () => {
    mockCreate.mockResolvedValue(makeClientNoApp(null) as never);
    const res = await POST(req("POST", validTitle) as never);
    expect(res.status).toBe(401);
  });

  it("returns 400 when title is missing", async () => {
    mockCreate.mockResolvedValue(makeClientNoApp() as never);
    const res = await POST(req("POST", {}) as never);
    expect(res.status).toBe(400);
  });

  it("returns 400 when application_id is not a valid UUID", async () => {
    mockCreate.mockResolvedValue(makeClientNoApp() as never);
    const res = await POST(req("POST", { ...validTitle, application_id: "not-uuid" }) as never);
    expect(res.status).toBe(400);
  });
});

// ── POST — IDOR: application_id ownership ────────────────────────────────────

describe("POST /api/prep/assessments — IDOR protection", () => {
  it("returns 201 when no application_id is provided (no ownership check needed)", async () => {
    mockCreate.mockResolvedValue(makeClientNoApp() as never);
    const res = await POST(req("POST", validTitle) as never);
    expect(res.status).toBe(201);
  });

  it("returns 201 when application_id belongs to the authenticated user", async () => {
    mockCreate.mockResolvedValue(makeClientForPost({ id: USER_ID }, true) as never);
    const res = await POST(req("POST", { ...validTitle, application_id: APP_ID }) as never);
    expect(res.status).toBe(201);
  });

  it("returns 403 when application_id belongs to another user", async () => {
    mockCreate.mockResolvedValue(makeClientForPost({ id: USER_ID }, false) as never);
    const res = await POST(req("POST", { ...validTitle, application_id: OTHER_APP }) as never);
    expect(res.status).toBe(403);
  });

  it("verifies app ownership before inserting (from order)", async () => {
    const client = makeClientForPost({ id: USER_ID }, true);
    mockCreate.mockResolvedValue(client as never);
    await POST(req("POST", { ...validTitle, application_id: APP_ID }) as never);
    expect(client.from).toHaveBeenNthCalledWith(1, "job_applications");
    expect(client.from).toHaveBeenNthCalledWith(2, "assessments");
  });
});

// ── PATCH — CSRF & ownership ──────────────────────────────────────────────────

describe("PATCH /api/prep/assessments/[id]", () => {
  it("returns 403 for cross-site origin", async () => {
    const res = await PATCH(
      idReq("PATCH", ASSESS_ID, { status: "Submitted" }, "http://evil.example.com") as never,
      { params: Promise.resolve({ id: ASSESS_ID }) }
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 for non-UUID id", async () => {
    const res = await PATCH(
      idReq("PATCH", "bad", { status: "Submitted" }) as never,
      { params: Promise.resolve({ id: "bad" }) }
    );
    expect(res.status).toBe(400);
  });

  it("enforces user_id ownership on update", async () => {
    const chain = makeChain({ data: { id: ASSESS_ID, status: "Submitted" }, error: null });
    const client = { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } }, error: null }) }, from: vi.fn().mockReturnValue(chain) };
    mockCreate.mockResolvedValue(client as never);
    await PATCH(idReq("PATCH", ASSESS_ID, { status: "Submitted" }) as never, { params: Promise.resolve({ id: ASSESS_ID }) });
    expect(chain.eq).toHaveBeenCalledWith("user_id", USER_ID);
  });
});

// ── DELETE — CSRF & ownership ─────────────────────────────────────────────────

describe("DELETE /api/prep/assessments/[id]", () => {
  it("returns 403 for cross-site origin", async () => {
    const res = await DELETE(
      idReq("DELETE", ASSESS_ID, undefined, "http://evil.example.com") as never,
      { params: Promise.resolve({ id: ASSESS_ID }) }
    );
    expect(res.status).toBe(403);
  });

  it("returns 200 and enforces user_id ownership", async () => {
    const chain = makeChain({ data: null, error: null });
    const client = { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } }, error: null }) }, from: vi.fn().mockReturnValue(chain) };
    mockCreate.mockResolvedValue(client as never);
    const res = await DELETE(idReq("DELETE", ASSESS_ID) as never, { params: Promise.resolve({ id: ASSESS_ID }) });
    expect(res.status).toBe(200);
    expect(chain.eq).toHaveBeenCalledWith("user_id", USER_ID);
  });
});
