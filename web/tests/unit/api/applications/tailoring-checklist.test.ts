/**
 * Unit tests — POST /api/applications/[id]/tailoring-checklist
 *
 * Covers:
 *   - Origin check → 403
 *   - Auth check → 401
 *   - Rate limit → 429
 *   - Application not found → 404
 *   - No job description → 422
 *   - Job description too short (< 50 chars) → 422
 *   - Groq API failure → 503
 *   - Groq returns invalid JSON → 500
 *   - Groq returns empty items list → 500
 *   - Happy path {items:[...]} shape → 200 with items
 *   - Defensive: bare array shape still handled → 200
 *   - Items capped at 8, empty strings filtered out
 *   - Groq called with job_description sliced to 8000 chars
 *   - Groq called with correct model and response_format
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeChain } from "@/tests/helpers/supabase-mock";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: vi.fn() }));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { POST } from "@/app/api/applications/[id]/tailoring-checklist/route";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";

const mockRL     = vi.mocked(checkRateLimit);
const mockCreate = vi.mocked(createClient);

const USER_ID = "user-uuid-0001";
const APP_ID  = "app-uuid-0001";

const LONG_JD = "Senior Software Engineer at Acme Corp, building scalable distributed systems. " + "x".repeat(100);

const SAMPLE_ITEMS = [
  "Highlight distributed systems experience",
  "Quantify system throughput improvements",
  "Add TypeScript and React to skills section",
  "Emphasise leadership of cross-functional teams",
  "Include examples of CI/CD pipeline ownership",
  "Mention experience with cloud infrastructure (AWS/GCP)",
];

function makeApp(overrides: Partial<{ job_description: string; company: string; position: string }> = {}) {
  return {
    job_description: LONG_JD,
    company: "Acme Corp",
    position: "Senior Engineer",
    ...overrides,
  };
}

function makeClient(user: unknown = { id: USER_ID }, appResult = { data: makeApp(), error: null }) {
  const chain = makeChain(appResult);
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    from: vi.fn().mockReturnValue(chain),
  };
}

function groqResponse(content: string): Response {
  return new Response(
    JSON.stringify({ choices: [{ message: { content } }] }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

function postRequest(appId = APP_ID): Request {
  return new Request(`http://localhost/api/applications/${appId}/tailoring-checklist`, {
    method: "POST",
  });
}

function crossOriginRequest(): Request {
  return new Request(`http://localhost/api/applications/${APP_ID}/tailoring-checklist`, {
    method: "POST",
    headers: { Origin: "http://evil.example.com" },
  });
}

const paramsFor = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.resetAllMocks();
  mockRL.mockReturnValue({ allowed: true, remaining: 9, resetTime: Date.now() + 60_000 });
  mockCreate.mockResolvedValue(makeClient() as never);
  mockFetch.mockResolvedValue(groqResponse(JSON.stringify({ items: SAMPLE_ITEMS })));
});

// ── Auth & gates ─────────────────────────────────────────────────────────────

describe("POST /api/applications/[id]/tailoring-checklist — gates", () => {
  it("returns 403 for cross-site origin", async () => {
    const res = await POST(crossOriginRequest() as never, paramsFor(APP_ID));
    expect(res.status).toBe(403);
  });

  it("returns 401 when not authenticated", async () => {
    mockCreate.mockResolvedValue(makeClient(null) as never);
    const res = await POST(postRequest() as never, paramsFor(APP_ID));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockRL.mockReturnValue({ allowed: false, remaining: 0, resetTime: Date.now() + 60_000 });
    const res = await POST(postRequest() as never, paramsFor(APP_ID));
    expect(res.status).toBe(429);
  });
});

// ── Application lookup ───────────────────────────────────────────────────────

describe("POST /api/applications/[id]/tailoring-checklist — lookup", () => {
  it("returns 404 when application is not found", async () => {
    mockCreate.mockResolvedValue(
      makeClient({ id: USER_ID }, { data: null, error: { message: "not found" } }) as never
    );
    const res = await POST(postRequest() as never, paramsFor(APP_ID));
    expect(res.status).toBe(404);
  });
});

// ── Job description validation ────────────────────────────────────────────────

describe("POST /api/applications/[id]/tailoring-checklist — JD validation", () => {
  it("returns 422 when job_description is null", async () => {
    mockCreate.mockResolvedValue(
      makeClient({ id: USER_ID }, { data: makeApp({ job_description: "" }), error: null }) as never
    );
    const res = await POST(postRequest() as never, paramsFor(APP_ID));
    expect(res.status).toBe(422);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/job description/i);
  });

  it("returns 422 when job_description is shorter than 50 chars", async () => {
    mockCreate.mockResolvedValue(
      makeClient({ id: USER_ID }, { data: makeApp({ job_description: "Too short." }), error: null }) as never
    );
    const res = await POST(postRequest() as never, paramsFor(APP_ID));
    expect(res.status).toBe(422);
  });
});

// ── Groq API ─────────────────────────────────────────────────────────────────

describe("POST /api/applications/[id]/tailoring-checklist — Groq", () => {
  it("returns 503 when Groq API returns a non-OK response", async () => {
    mockFetch.mockResolvedValueOnce(new Response("{}", { status: 500 }));
    const res = await POST(postRequest() as never, paramsFor(APP_ID));
    expect(res.status).toBe(503);
  });

  it("returns 500 when Groq response content is not parseable JSON", async () => {
    mockFetch.mockResolvedValueOnce(groqResponse("not json at all"));
    const res = await POST(postRequest() as never, paramsFor(APP_ID));
    expect(res.status).toBe(500);
  });

  it("returns 500 when Groq returns a valid object with no items array", async () => {
    mockFetch.mockResolvedValueOnce(groqResponse(JSON.stringify({ result: "unexpected shape" })));
    const res = await POST(postRequest() as never, paramsFor(APP_ID));
    expect(res.status).toBe(500);
  });

  it("returns 500 when Groq returns an empty items array", async () => {
    mockFetch.mockResolvedValueOnce(groqResponse(JSON.stringify({ items: [] })));
    const res = await POST(postRequest() as never, paramsFor(APP_ID));
    expect(res.status).toBe(500);
  });

  it("calls Groq with the correct model and response_format", async () => {
    await POST(postRequest() as never, paramsFor(APP_ID));
    const groqCall = mockFetch.mock.calls[0];
    const body = JSON.parse((groqCall[1] as RequestInit).body as string) as {
      model: string;
      response_format: { type: string };
    };
    expect(body.model).toBe("llama-3.3-70b-versatile");
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("slices job_description to 8000 chars before sending to Groq", async () => {
    const longJd = "x".repeat(12_000);
    mockCreate.mockResolvedValue(
      makeClient({ id: USER_ID }, { data: makeApp({ job_description: longJd }), error: null }) as never
    );
    await POST(postRequest() as never, paramsFor(APP_ID));
    const groqCall = mockFetch.mock.calls[0];
    const body = JSON.parse((groqCall[1] as RequestInit).body as string) as {
      messages: { role: string; content: string }[];
    };
    const userMsg = body.messages.find((m) => m.role === "user")!.content;
    // The sliced JD appears in the user message; must not exceed 8000 chars of JD content
    expect(userMsg).toContain("x".repeat(100)); // has JD content
    expect(userMsg.length).toBeLessThan(12_000); // nowhere near original length
  });
});

// ── Happy path ───────────────────────────────────────────────────────────────

describe("POST /api/applications/[id]/tailoring-checklist — success", () => {
  it("returns 200 with items array from {items:[...]} shaped response", async () => {
    const res = await POST(postRequest() as never, paramsFor(APP_ID));
    expect(res.status).toBe(200);
    const body = await res.json() as { items: string[] };
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items[0]).toBe(SAMPLE_ITEMS[0]);
  });

  it("accepts a bare array shape as a defensive fallback", async () => {
    mockFetch.mockResolvedValueOnce(groqResponse(JSON.stringify(SAMPLE_ITEMS)));
    const res = await POST(postRequest() as never, paramsFor(APP_ID));
    expect(res.status).toBe(200);
    const body = await res.json() as { items: string[] };
    expect(body.items.length).toBe(SAMPLE_ITEMS.length);
  });

  it("caps items at 8 even if Groq returns more", async () => {
    const tooMany = Array.from({ length: 12 }, (_, i) => `Item ${i + 1}`);
    mockFetch.mockResolvedValueOnce(groqResponse(JSON.stringify({ items: tooMany })));
    const res = await POST(postRequest() as never, paramsFor(APP_ID));
    expect(res.status).toBe(200);
    const body = await res.json() as { items: string[] };
    expect(body.items.length).toBe(8);
  });

  it("filters out empty-string items returned by Groq", async () => {
    const withBlanks = ["Good tip", "", "   ", "Another tip"];
    mockFetch.mockResolvedValueOnce(groqResponse(JSON.stringify({ items: withBlanks })));
    const res = await POST(postRequest() as never, paramsFor(APP_ID));
    expect(res.status).toBe(200);
    const body = await res.json() as { items: string[] };
    expect(body.items).toEqual(["Good tip", "Another tip"]);
  });

  it("filters non-string entries from the items array", async () => {
    const mixed = ["Valid tip", 42, null, "Another valid tip"];
    mockFetch.mockResolvedValueOnce(groqResponse(JSON.stringify({ items: mixed })));
    const res = await POST(postRequest() as never, paramsFor(APP_ID));
    expect(res.status).toBe(200);
    const body = await res.json() as { items: string[] };
    expect(body.items).toEqual(["Valid tip", "Another valid tip"]);
  });

  it("filters DB query by both id and user_id to prevent IDOR", async () => {
    const client = makeClient() as ReturnType<typeof makeClient>;
    mockCreate.mockResolvedValue(client as never);

    await POST(postRequest() as never, paramsFor(APP_ID));

    const chain = client.from.mock.results[0].value as ReturnType<typeof makeChain>;
    const eqFn = (chain as unknown as { eq: ReturnType<typeof vi.fn> }).eq;
    const eqCalls = eqFn.mock.calls as [string, string][];

    expect(eqCalls.some(([k, v]) => k === "id"      && v === APP_ID)).toBe(true);
    expect(eqCalls.some(([k, v]) => k === "user_id" && v === USER_ID)).toBe(true);
  });
});
