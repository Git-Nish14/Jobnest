/**
 * Unit tests — /api/prep/interview-questions (GET, POST) and /[id] (DELETE)
 *
 * Key security: CSRF, auth, IDOR (interview_id must belong to requesting user).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeChain } from "@/tests/helpers/supabase-mock";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: vi.fn() }));

import { GET, POST } from "@/app/api/prep/interview-questions/route";
import { DELETE } from "@/app/api/prep/interview-questions/[id]/route";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";

const mockCreate  = vi.mocked(createClient);
const mockCheckRL = vi.mocked(checkRateLimit);

const USER_ID      = "user-iq";
const INTERVIEW_ID = "11111111-2222-4333-8444-555555555555";
const QUESTION_ID  = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const OTHER_ITV_ID = "99999999-8888-4777-8666-555555555555";

/** Build a client whose from() returns chains in the order the route calls them:
 *  1st call → interviews ownership check
 *  2nd call → interview_questions insert
 */
function makeClientForPost(user: unknown = { id: USER_ID }, interviewFound = true) {
  const interviewChain = makeChain(
    interviewFound
      ? { data: { id: INTERVIEW_ID }, error: null }
      : { data: null, error: { code: "PGRST116", message: "not found" } }
  );
  const questionChain = makeChain({ data: { id: QUESTION_ID }, error: null });
  const fromMock = vi.fn()
    .mockReturnValueOnce(interviewChain)   // first from() → interviews
    .mockReturnValue(questionChain);        // subsequent → interview_questions
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    from: fromMock,
  };
}

/** Client for GET — returns questions list */
function makeClientForGet(user: unknown = { id: USER_ID }) {
  const chain = makeChain({ data: [{ id: QUESTION_ID }], error: null });
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    from: vi.fn().mockReturnValue(chain),
  };
}

function postReq(body: unknown, origin?: string): Request {
  return new Request("http://localhost/api/prep/interview-questions", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) },
    body: JSON.stringify(body),
  });
}

function delReq(id: string, origin?: string): Request {
  return new Request(`http://localhost/api/prep/interview-questions/${id}`, {
    method: "DELETE",
    headers: origin ? { Origin: origin } : {},
  });
}

const validBody = {
  interview_id: INTERVIEW_ID,
  question: "What is a hash map?",
  category: "DSA",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRL.mockReturnValue({ allowed: true, remaining: 9, resetTime: Date.now() + 60_000 });
  mockCreate.mockResolvedValue(makeClientForGet() as never);
});

// ── GET ───────────────────────────────────────────────────────────────────────

describe("GET /api/prep/interview-questions", () => {
  it("returns 401 when not authenticated", async () => {
    mockCreate.mockResolvedValue(makeClientForGet(null) as never);
    const res = await GET(new Request("http://localhost/api/prep/interview-questions") as never);
    expect(res.status).toBe(401);
  });

  it("returns 200 with questions for the authenticated user", async () => {
    const res = await GET(new Request("http://localhost/api/prep/interview-questions") as never);
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveProperty("questions");
  });
});

// ── POST — CSRF & auth ────────────────────────────────────────────────────────

describe("POST /api/prep/interview-questions — CSRF & auth", () => {
  it("returns 403 for cross-site origin", async () => {
    mockCreate.mockResolvedValue(makeClientForPost() as never);
    const res = await POST(postReq(validBody, "http://evil.example.com") as never);
    expect(res.status).toBe(403);
  });

  it("returns 401 when not authenticated", async () => {
    mockCreate.mockResolvedValue(makeClientForPost(null) as never);
    const res = await POST(postReq(validBody) as never);
    expect(res.status).toBe(401);
  });
});

// ── POST — IDOR: interview ownership ─────────────────────────────────────────

describe("POST /api/prep/interview-questions — IDOR protection", () => {
  it("returns 403 when interview_id belongs to another user", async () => {
    mockCreate.mockResolvedValue(makeClientForPost({ id: USER_ID }, false) as never);
    const res = await POST(postReq({ ...validBody, interview_id: OTHER_ITV_ID }) as never);
    expect(res.status).toBe(403);
  });

  it("returns 201 when interview_id belongs to the authenticated user", async () => {
    mockCreate.mockResolvedValue(makeClientForPost({ id: USER_ID }, true) as never);
    const res = await POST(postReq(validBody) as never);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.question).toHaveProperty("id");
  });

  it("verifies interview ownership before inserting question", async () => {
    const client = makeClientForPost({ id: USER_ID }, true);
    mockCreate.mockResolvedValue(client as never);
    await POST(postReq(validBody) as never);
    // First from() call must be to "interviews" table for ownership check
    expect(client.from).toHaveBeenNthCalledWith(1, "interviews");
    expect(client.from).toHaveBeenNthCalledWith(2, "interview_questions");
  });
});

// ── POST — input validation ───────────────────────────────────────────────────

describe("POST /api/prep/interview-questions — validation", () => {
  beforeEach(() => {
    mockCreate.mockResolvedValue(makeClientForPost() as never);
  });

  it("returns 400 when question is empty", async () => {
    const res = await POST(postReq({ ...validBody, question: "" }) as never);
    expect(res.status).toBe(400);
  });

  it("returns 400 when category is an invalid enum value", async () => {
    const res = await POST(postReq({ ...validBody, category: "Random" }) as never);
    expect(res.status).toBe(400);
  });

  it("returns 400 when interview_id is not a valid UUID", async () => {
    const res = await POST(postReq({ ...validBody, interview_id: "not-a-uuid" }) as never);
    expect(res.status).toBe(400);
  });
});

// ── DELETE — CSRF & ownership ────────────────────────────────────────────────

describe("DELETE /api/prep/interview-questions/[id]", () => {
  it("returns 403 for cross-site origin", async () => {
    mockCreate.mockResolvedValue(makeClientForGet() as never);
    const res = await DELETE(
      delReq(QUESTION_ID, "http://evil.example.com") as never,
      { params: Promise.resolve({ id: QUESTION_ID }) }
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 for non-UUID id", async () => {
    const res = await DELETE(
      delReq("bad-id") as never,
      { params: Promise.resolve({ id: "bad-id" }) }
    );
    expect(res.status).toBe(400);
  });

  it("returns 200 and enforces user_id ownership on delete", async () => {
    const chain = makeChain({ data: null, error: null });
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } }, error: null }) },
      from: vi.fn().mockReturnValue(chain),
    };
    mockCreate.mockResolvedValue(client as never);
    const res = await DELETE(
      delReq(QUESTION_ID) as never,
      { params: Promise.resolve({ id: QUESTION_ID }) }
    );
    expect(res.status).toBe(200);
    expect(chain.eq).toHaveBeenCalledWith("user_id", USER_ID);
  });
});
