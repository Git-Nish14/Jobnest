/**
 * Unit tests — POST /api/documents/diff
 *
 * Covers:
 *   - 403 on cross-origin request
 *   - 401 when not authenticated
 *   - 429 when rate limited
 *   - 422 when base_id === compare_id (schema-level check maps to badRequest → 400... but
 *         badRequest after body parse is a 400; zod validation of missing fields is 422)
 *   - 422 when doc IDs are not valid UUIDs (Zod validation)
 *   - 404 when one/both docs not found for user
 *   - 400 when text extraction fails on base doc
 *   - 400 when text extraction fails on compare doc
 *   - 200 with correct diff shape on success
 *   - stats.unchanged counts words (not chunks)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeChain } from "@/tests/helpers/supabase-mock";

vi.mock("@/lib/supabase/server",       () => ({ createClient: vi.fn() }));
vi.mock("@/lib/security/rate-limit",   () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/security/csrf",         () => ({ verifyOrigin: vi.fn() }));
vi.mock("@/lib/utils/document-parser", () => ({ extractDocumentText: vi.fn() }));

import { POST } from "@/app/api/documents/diff/route";
import { createClient }          from "@/lib/supabase/server";
import { checkRateLimit }        from "@/lib/security/rate-limit";
import { verifyOrigin }          from "@/lib/security/csrf";
import { extractDocumentText }   from "@/lib/utils/document-parser";

const mockCreate  = vi.mocked(createClient);
const mockRL      = vi.mocked(checkRateLimit);
const mockOrigin  = vi.mocked(verifyOrigin);
const mockExtract = vi.mocked(extractDocumentText);

const UID      = "a0a0a0a0-a0a0-4a0a-8a0a-a0a0a0a0a0a0";
const BASE_ID  = "a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1";
const CMP_ID   = "b2b2b2b2-b2b2-4b2b-9b2b-b2b2b2b2b2b2";

const BASE_DOC = {
  id: BASE_ID, storage_path: "uid/app/Resume/v1_resume.pdf",
  label: "Resume", original_name: "resume_v1.pdf",
  uploaded_at: "2026-01-01T00:00:00Z", is_current: true,
};
const CMP_DOC  = {
  id: CMP_ID, storage_path: "uid/app/Resume/v2_resume.pdf",
  label: "Resume", original_name: "resume_v2.pdf",
  uploaded_at: "2026-02-01T00:00:00Z", is_current: false,
};

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/documents/diff", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeClient(docs: unknown[] = [BASE_DOC, CMP_DOC]) {
  const chain = makeChain({ data: docs, error: null });
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: UID } }, error: null }) },
    from: vi.fn(() => chain),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockOrigin.mockReturnValue(true);
  mockRL.mockReturnValue({ allowed: true, remaining: 19, resetAt: Date.now() + 60_000 });
  mockCreate.mockResolvedValue(makeClient() as never);
  mockExtract.mockResolvedValue({ text: "Hello world this is a resume document", error: null });
});

describe("POST /api/documents/diff — auth & origin", () => {
  it("returns 403 on cross-origin request", async () => {
    mockOrigin.mockReturnValue(false);
    const res = await POST(makeRequest({ base_id: BASE_ID, compare_id: CMP_ID }) as never);
    expect(res.status).toBe(403);
  });

  it("returns 401 when not authenticated", async () => {
    mockCreate.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error("x") }) },
      from: vi.fn(),
    } as never);
    const res = await POST(makeRequest({ base_id: BASE_ID, compare_id: CMP_ID }) as never);
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockRL.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 1000 });
    const res = await POST(makeRequest({ base_id: BASE_ID, compare_id: CMP_ID }) as never);
    expect(res.status).toBe(429);
  });
});

describe("POST /api/documents/diff — validation", () => {
  it("returns 422 for invalid UUID base_id", async () => {
    const res = await POST(makeRequest({ base_id: "not-a-uuid", compare_id: CMP_ID }) as never);
    expect(res.status).toBe(422);
  });

  it("returns 422 for invalid UUID compare_id", async () => {
    const res = await POST(makeRequest({ base_id: BASE_ID, compare_id: "not-a-uuid" }) as never);
    expect(res.status).toBe(422);
  });

  it("returns 422 when missing compare_id", async () => {
    const res = await POST(makeRequest({ base_id: BASE_ID }) as never);
    expect(res.status).toBe(422);
  });

  it("returns 400 when base_id === compare_id (caught after body parse)", async () => {
    const res = await POST(makeRequest({ base_id: BASE_ID, compare_id: BASE_ID }) as never);
    expect(res.status).toBe(400);
  });
});

describe("POST /api/documents/diff — document lookup", () => {
  it("returns 404 when only one doc is found (not both belong to user)", async () => {
    mockCreate.mockResolvedValue(makeClient([BASE_DOC]) as never);
    const res = await POST(makeRequest({ base_id: BASE_ID, compare_id: CMP_ID }) as never);
    expect(res.status).toBe(404);
  });

  it("returns 404 when DB returns empty array", async () => {
    mockCreate.mockResolvedValue(makeClient([]) as never);
    const res = await POST(makeRequest({ base_id: BASE_ID, compare_id: CMP_ID }) as never);
    expect(res.status).toBe(404);
  });
});

describe("POST /api/documents/diff — text extraction", () => {
  it("returns 400 when base doc text extraction fails", async () => {
    mockExtract
      .mockResolvedValueOnce({ text: null, error: "Cannot extract text from this file." })
      .mockResolvedValueOnce({ text: "compare text", error: null });
    const res = await POST(makeRequest({ base_id: BASE_ID, compare_id: CMP_ID }) as never);
    expect(res.status).toBe(400);
  });

  it("returns 400 when compare doc text extraction fails", async () => {
    mockExtract
      .mockResolvedValueOnce({ text: "base text", error: null })
      .mockResolvedValueOnce({ text: null, error: "Cannot extract text from this file." });
    const res = await POST(makeRequest({ base_id: BASE_ID, compare_id: CMP_ID }) as never);
    expect(res.status).toBe(400);
  });
});

describe("POST /api/documents/diff — success", () => {
  it("returns 200 with changes array and stats on success", async () => {
    mockExtract
      .mockResolvedValueOnce({ text: "Hello world this is version one", error: null })
      .mockResolvedValueOnce({ text: "Hello world this is version two", error: null });
    const res = await POST(makeRequest({ base_id: BASE_ID, compare_id: CMP_ID }) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    const data = body.data ?? body;
    expect(Array.isArray(data.changes)).toBe(true);
    expect(data.stats).toBeDefined();
    expect(typeof data.stats.added).toBe("number");
    expect(typeof data.stats.removed).toBe("number");
    expect(typeof data.stats.unchanged).toBe("number");
  });

  it("stats.unchanged counts words not chunks", async () => {
    mockExtract
      .mockResolvedValueOnce({ text: "hello world foo", error: null })
      .mockResolvedValueOnce({ text: "hello world bar", error: null });
    const res = await POST(makeRequest({ base_id: BASE_ID, compare_id: CMP_ID }) as never);
    const body = await res.json();
    const data = body.data ?? body;
    // "hello world" is unchanged = 2 words; unchanged should be ≥ 2, not just 1 chunk
    expect(data.stats.unchanged).toBeGreaterThanOrEqual(2);
    expect(data.stats.added).toBeGreaterThanOrEqual(1);
    expect(data.stats.removed).toBeGreaterThanOrEqual(1);
  });

  it("response includes base and compare metadata", async () => {
    const res = await POST(makeRequest({ base_id: BASE_ID, compare_id: CMP_ID }) as never);
    const body = await res.json();
    const data = body.data ?? body;
    expect(data.base.id).toBe(BASE_ID);
    expect(data.compare.id).toBe(CMP_ID);
  });
});
