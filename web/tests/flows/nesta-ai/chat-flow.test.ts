/**
 * E2E flow: NESTAi chat
 *
 * Journey:
 *   1. File upload → text extracted → returned to client
 *   2. Chat message (with/without attachment) → streaming response
 *   3. Rate limit behaviour
 *   4. Context trimming kicks in for large data sets
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeRequest } from "@/tests/helpers/supabase-mock";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/utils/document-parser", () => ({
  extractTextFromBuffer: vi.fn(),
  extractAllDocuments: vi.fn(),
}));

// Intercept global fetch — captures the Groq API call made by the NESTAi route
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { POST as parseFile } from "@/app/api/nesta-ai/parse-file/route";
import { POST as chat } from "@/app/api/nesta-ai/route";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { extractTextFromBuffer, extractAllDocuments } from "@/lib/utils/document-parser";

const mockCheckRL = vi.mocked(checkRateLimit);
const mockCreateClient = vi.mocked(createClient);
const mockExtract = vi.mocked(extractTextFromBuffer);
const mockExtractAll = vi.mocked(extractAllDocuments);

const authedUser = {
  id: "uid",
  email: "u@test.com",
  user_metadata: { about_me: "Software engineer seeking senior roles." },
};

// Empty Supabase chain — returns [] for all queries (no applications, interviews etc.)
function makeEmptyChain() {
  const self: Record<string, unknown> = {};
  const method = () => vi.fn().mockReturnValue(self);
  self.select = method(); self.eq = method(); self.order = method();
  self.in = method(); self.limit = method(); self.is = method();
  self.single = vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } });
  (self as Record<string, unknown>).then = (r: (v: unknown) => void) =>
    Promise.resolve({ data: [], error: null }).then(r);
  return self;
}

function makeServerClient(user: unknown = authedUser) {
  return {
    from: vi.fn().mockReturnValue(makeEmptyChain()),
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
  };
}

function makeStreamResponse(tokens = "Hello! I see your data.") {
  const body = tokens
    .split(" ")
    .map((t) => `data: ${JSON.stringify({ choices: [{ delta: { content: t + " " } }] })}\n`)
    .join("") + "data: [DONE]\n";

  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRL.mockReturnValue({ allowed: true, remaining: 4, resetTime: Date.now() + 60_000 });
  mockCreateClient.mockResolvedValue(makeServerClient() as never);
  mockExtract.mockResolvedValue({ text: "Extracted resume content", error: null });
  mockExtractAll.mockResolvedValue([]);
  mockFetch.mockResolvedValue(makeStreamResponse());
});

// ── parse-file ───────────────────────────────────────────────────────────────

describe("NESTAi — file upload (parse-file)", () => {
  it("returns 401 when not authenticated", async () => {
    mockCreateClient.mockResolvedValue(makeServerClient(null) as never);
    const form = new FormData();
    form.append("file", new File(["content"], "cv.pdf", { type: "application/pdf" }));
    const req = new Request("http://localhost/api/nesta-ai/parse-file", { method: "POST", body: form });
    const res = await parseFile(req as never);
    expect(res.status).toBe(401);
  });

  it("returns 400 with friendly message for missing file", async () => {
    const form = new FormData();
    const req = new Request("http://localhost/api/nesta-ai/parse-file", { method: "POST", body: form });
    const res = await parseFile(req as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/please select a file/i);
  });

  it("returns 400 for files over 5 MB", async () => {
    const big = new File([new Uint8Array(6 * 1024 * 1024)], "huge.pdf");
    const form = new FormData();
    form.append("file", big);
    const req = new Request("http://localhost/api/nesta-ai/parse-file", { method: "POST", body: form });
    const res = await parseFile(req as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/5 MB/i);
  });

  it("returns 422 with user-friendly message when text extraction fails", async () => {
    mockExtract.mockResolvedValue({ text: null, error: "Not a valid PDF" });
    const form = new FormData();
    form.append("file", new File(["content"], "broken.pdf"));
    const req = new Request("http://localhost/api/nesta-ai/parse-file", { method: "POST", body: form });
    const res = await parseFile(req as never);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/valid PDF|Word document/i);
  });

  it("returns 200 with extracted text on success", async () => {
    const form = new FormData();
    form.append("file", new File(["pdf"], "resume.pdf"));
    const req = new Request("http://localhost/api/nesta-ai/parse-file", { method: "POST", body: form });
    const res = await parseFile(req as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.text).toBe("Extracted resume content");
    expect(body.fileName).toBe("resume.pdf");
  });
});

// ── chat route ───────────────────────────────────────────────────────────────

describe("NESTAi — chat message", () => {
  it("returns 401 when not authenticated", async () => {
    mockCreateClient.mockResolvedValue(makeServerClient(null) as never);
    const res = await chat(makeRequest("/api/nesta-ai", { question: "Hi", history: [] }) as never);
    expect(res.status).toBe(401);
  });

  it("returns 429 with resetIn when rate limited", async () => {
    mockCheckRL.mockReturnValue({ allowed: false, remaining: 0, resetTime: Date.now() + 42_000 });
    const res = await chat(makeRequest("/api/nesta-ai", { question: "Hi", history: [] }) as never);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(typeof body.resetIn).toBe("number");
    expect(body.resetIn).toBeGreaterThan(0);
    expect(body.error).toMatch(/5 messages per minute/i);
  });

  it("returns 422 for empty question", async () => {
    const res = await chat(makeRequest("/api/nesta-ai", { question: "", history: [] }) as never);
    expect(res.status).toBe(422);
  });

  it("returns streaming text/plain response with rate limit headers", async () => {
    const res = await chat(makeRequest("/api/nesta-ai", { question: "How many applications?", history: [] }) as never);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    expect(res.headers.get("X-RateLimit-Limit")).toBe("5");
    expect(res.headers.get("X-RateLimit-Remaining")).toBeDefined();
  });

  it("returns 500 with generic message (not internal config) when GROQ_API_KEY missing", async () => {
    const original = process.env.GROQ_API_KEY;
    process.env.GROQ_API_KEY = "";
    const res = await chat(makeRequest("/api/nesta-ai", { question: "test", history: [] }) as never);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/temporarily unavailable/i);
    expect(body.error).not.toMatch(/GROQ_API_KEY/i);
    process.env.GROQ_API_KEY = original;
  });

  it("returns 429 from Groq as user-friendly message", async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ error: "rate limited" }), { status: 429 }));
    const res = await chat(makeRequest("/api/nesta-ai", { question: "Hi", history: [] }) as never);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toMatch(/busy|wait/i);
  });
});

// ── context trimming / Groq call verification ─────────────────────────────────

describe("NESTAi — context trimming", () => {
  it("does not call Groq when question exceeds schema limit (2000 chars)", async () => {
    const res = await chat(makeRequest("/api/nesta-ai", { question: "x".repeat(2001), history: [] }) as never);
    expect(res.status).toBe(422);
    // Groq should not have been called — rate-limit check happens before it anyway
    const groqCalls = mockFetch.mock.calls.filter(
      (c: unknown[]) => typeof c[0] === "string" && (c[0] as string).includes("groq.com")
    );
    expect(groqCalls).toHaveLength(0);
  });

  it("sends request to Groq with model llama-3.1-8b-instant and stream: true", async () => {
    await chat(makeRequest("/api/nesta-ai", { question: "Hello", history: [] }) as never);
    const groqCall = mockFetch.mock.calls.find(
      (c: unknown[]) => typeof c[0] === "string" && (c[0] as string).includes("groq.com")
    );
    expect(groqCall).toBeDefined();
    const requestBody = JSON.parse((groqCall![1] as RequestInit).body as string);
    expect(requestBody.model).toBe("llama-3.1-8b-instant");
    expect(requestBody.stream).toBe(true);
  });

  it("injects about_me into system prompt", async () => {
    await chat(makeRequest("/api/nesta-ai", { question: "Who am I?", history: [] }) as never);
    const groqCall = mockFetch.mock.calls.find(
      (c: unknown[]) => typeof c[0] === "string" && (c[0] as string).includes("groq.com")
    );
    expect(groqCall).toBeDefined();
    const requestBody = JSON.parse((groqCall![1] as RequestInit).body as string);
    const systemMsg = (requestBody.messages as Array<{ role: string; content: string }>)
      .find((m) => m.role === "system");
    expect(systemMsg?.content).toContain("Software engineer seeking senior roles.");
  });

  it("passes file attachment content in user message when fileContent provided", async () => {
    await chat(makeRequest("/api/nesta-ai", {
      question: "Summarise my CV",
      history: [],
      fileContent: "John Doe — Senior Engineer",
      fileName: "cv.pdf",
    }) as never);
    const groqCall = mockFetch.mock.calls.find(
      (c: unknown[]) => typeof c[0] === "string" && (c[0] as string).includes("groq.com")
    );
    expect(groqCall).toBeDefined();
    const requestBody = JSON.parse((groqCall![1] as RequestInit).body as string);
    const userMsg = (requestBody.messages as Array<{ role: string; content: string }>)
      .find((m) => m.role === "user");
    expect(userMsg?.content).toContain("cv.pdf");
    expect(userMsg?.content).toContain("John Doe");
  });
});
