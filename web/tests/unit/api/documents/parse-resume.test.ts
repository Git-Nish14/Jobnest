/**
 * Unit tests — POST /api/documents/parse-resume
 *
 * Covers:
 *   - 403 on cross-origin request
 *   - 401 when not authenticated
 *   - 429 when rate limited
 *   - 422 on invalid document_id (non-UUID) — Zod validation
 *   - 404 when document does not belong to user
 *   - 400 when text extraction returns null / error
 *   - 503 when GROQ_API_KEY is not configured
 *   - 503 when Groq API returns non-200
 *   - 200 with structured extracted data on success
 *   - Extracted data arrays default to [] when AI omits them
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeChain } from "@/tests/helpers/supabase-mock";

vi.mock("@/lib/supabase/server",       () => ({ createClient: vi.fn() }));
vi.mock("@/lib/security/rate-limit",   () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/security/csrf",         () => ({ verifyOrigin: vi.fn() }));
vi.mock("@/lib/utils/document-parser", () => ({ extractDocumentText: vi.fn() }));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { POST } from "@/app/api/documents/parse-resume/route";
import { createClient }        from "@/lib/supabase/server";
import { checkRateLimit }      from "@/lib/security/rate-limit";
import { verifyOrigin }        from "@/lib/security/csrf";
import { extractDocumentText } from "@/lib/utils/document-parser";

const mockCreate  = vi.mocked(createClient);
const mockRL      = vi.mocked(checkRateLimit);
const mockOrigin  = vi.mocked(verifyOrigin);
const mockExtract = vi.mocked(extractDocumentText);

const UID    = "a0a0a0a0-a0a0-4a0a-8a0a-a0a0a0a0a0a0";
const DOC_ID = "b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b1b1";
const DOC_ROW = {
  storage_path: "uid/library/Resume/1234_resume.pdf",
  mime_type: "application/pdf",
  original_name: "resume.pdf",
  label: "Resume",
};

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/documents/parse-resume", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeClient(user: unknown = { id: UID }, docData: unknown = DOC_ROW) {
  const hasDoc = docData !== null;
  const chain = {
    ...makeChain({ data: hasDoc ? docData : null, error: hasDoc ? null : new Error("not found") }),
    single: vi.fn().mockResolvedValue({
      data: hasDoc ? docData : null,
      error: hasDoc ? null : new Error("not found"),
    }),
  };
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    from: vi.fn(() => chain),
  };
}

function groqResponse(content: object): Response {
  return new Response(
    JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

const EXTRACTED = {
  name: "Jane Smith",
  email: "jane@example.com",
  skills: [{ name: "TypeScript", category: "Language", proficiency: "Advanced" }],
  education: [{
    institution: "MIT", degree: "BS", field_of_study: "CS",
    start_date: "2018-09-01", end_date: "2022-06-01", is_current: false, gpa: 3.9,
  }],
  certifications: [{ name: "AWS SAA", provider: "Amazon", issued_at: "2024-01-01", expires_at: null }],
  experience: [{ company: "Acme Corp", title: "SWE", start_date: "2022-07-01", end_date: null, is_current: true }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockOrigin.mockReturnValue(true);
  mockRL.mockReturnValue({ allowed: true, remaining: 4, resetAt: Date.now() + 60_000 });
  mockCreate.mockResolvedValue(makeClient() as never);
  mockExtract.mockResolvedValue({ text: "Jane Smith Software Engineer with 4 years experience.", error: null });
  mockFetch.mockResolvedValue(groqResponse(EXTRACTED));
  process.env.GROQ_API_KEY = "test-groq-key";
});

describe("POST /api/documents/parse-resume — auth & origin", () => {
  it("returns 403 on cross-origin request", async () => {
    mockOrigin.mockReturnValue(false);
    const res = await POST(makeRequest({ document_id: DOC_ID }) as never);
    expect(res.status).toBe(403);
  });

  it("returns 401 when not authenticated", async () => {
    mockCreate.mockResolvedValue(makeClient(null) as never);
    const res = await POST(makeRequest({ document_id: DOC_ID }) as never);
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockRL.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 1000 });
    const res = await POST(makeRequest({ document_id: DOC_ID }) as never);
    expect(res.status).toBe(429);
  });
});

describe("POST /api/documents/parse-resume — validation (422)", () => {
  it("returns 422 for non-UUID document_id", async () => {
    const res = await POST(makeRequest({ document_id: "not-a-uuid" }) as never);
    expect(res.status).toBe(422);
  });

  it("returns 422 when document_id is missing", async () => {
    const res = await POST(makeRequest({}) as never);
    expect(res.status).toBe(422);
  });
});

describe("POST /api/documents/parse-resume — document lookup", () => {
  it("returns 404 when document not found for user", async () => {
    mockCreate.mockResolvedValue(makeClient(undefined, null) as never);
    const res = await POST(makeRequest({ document_id: DOC_ID }) as never);
    expect(res.status).toBe(404);
  });
});

describe("POST /api/documents/parse-resume — text extraction", () => {
  it("returns 400 when text extraction returns null", async () => {
    mockExtract.mockResolvedValue({ text: null, error: "Cannot extract text." });
    const res = await POST(makeRequest({ document_id: DOC_ID }) as never);
    expect(res.status).toBe(400);
  });

  it("returns 400 when extraction returns empty file error", async () => {
    mockExtract.mockResolvedValue({ text: null, error: "File is empty." });
    const res = await POST(makeRequest({ document_id: DOC_ID }) as never);
    expect(res.status).toBe(400);
  });
});

describe("POST /api/documents/parse-resume — Groq API", () => {
  it("returns 503 when GROQ_API_KEY is not set", async () => {
    const original = process.env.GROQ_API_KEY;
    delete process.env.GROQ_API_KEY;
    try {
      const res = await POST(makeRequest({ document_id: DOC_ID }) as never);
      expect(res.status).toBe(503);
    } finally {
      process.env.GROQ_API_KEY = original;
    }
  });

  it("returns 503 when Groq returns non-200", async () => {
    mockFetch.mockResolvedValue(new Response("Internal Server Error", { status: 500 }));
    const res = await POST(makeRequest({ document_id: DOC_ID }) as never);
    expect(res.status).toBe(503);
  });
});

describe("POST /api/documents/parse-resume — success", () => {
  it("returns 200 with extracted data on success", async () => {
    const res = await POST(makeRequest({ document_id: DOC_ID }) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    const data = body.data ?? body;
    expect(data.extracted).toBeDefined();
    expect(data.counts).toBeDefined();
  });

  it("extracted.skills is an array with expected content", async () => {
    const res = await POST(makeRequest({ document_id: DOC_ID }) as never);
    const body = await res.json();
    const data = body.data ?? body;
    expect(Array.isArray(data.extracted.skills)).toBe(true);
    expect(data.extracted.skills[0].name).toBe("TypeScript");
  });

  it("extracted.education is an array", async () => {
    const res = await POST(makeRequest({ document_id: DOC_ID }) as never);
    const body = await res.json();
    const data = body.data ?? body;
    expect(Array.isArray(data.extracted.education)).toBe(true);
  });

  it("counts reflect number of extracted items", async () => {
    const res = await POST(makeRequest({ document_id: DOC_ID }) as never);
    const body = await res.json();
    const data = body.data ?? body;
    expect(data.counts.skills).toBe(1);
    expect(data.counts.education).toBe(1);
    expect(data.counts.certifications).toBe(1);
  });

  it("defaults arrays to [] when AI omits them", async () => {
    mockFetch.mockResolvedValue(groqResponse({ name: "Jane", email: null }));
    const res = await POST(makeRequest({ document_id: DOC_ID }) as never);
    const body = await res.json();
    const data = body.data ?? body;
    expect(data.extracted.skills).toEqual([]);
    expect(data.extracted.education).toEqual([]);
    expect(data.extracted.certifications).toEqual([]);
    expect(data.extracted.experience).toEqual([]);
  });
});
