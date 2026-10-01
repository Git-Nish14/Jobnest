/**
 * Unit tests — GET /api/documents/preview-html
 *
 * Covers:
 *   - 401 when not authenticated
 *   - 429 when rate limit is exceeded (regression guard — the non-enforcement
 *     bug fixed in this PR made the limiter completely decorative; this test
 *     ensures it stays enforced)
 *   - 400 when path query param is missing
 *   - 400 when path contains ".." (path-traversal guard)
 *   - 400 when path starts with "/"
 *   - 403 when first path segment does not match user.id
 *   - 400 when extension is not docx or doc
 *   - 404 when Supabase Storage download fails
 *   - 400 when downloaded file exceeds 10 MB
 *   - 200 with { html } body on success
 *   - 200 with fallback message when mammoth returns empty string
 *   - Cache-Control: private, max-age=300 on success
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/security/rate-limit",  () => ({ checkRateLimit: vi.fn() }));
vi.mock("mammoth", () => ({ convertToHtml: vi.fn() }));

import { GET } from "@/app/api/documents/preview-html/route";
import { createClient }   from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import * as mammothMod    from "mammoth";

const mockCreate  = vi.mocked(createClient);
const mockRL      = vi.mocked(checkRateLimit);
const mockConvert = vi.mocked(mammothMod.convertToHtml);

const UID       = "a0a0a0a0-a0a0-4a0a-8a0a-a0a0a0a0a0a0";
const OTHER_UID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function makeRequest(path?: string): NextRequest {
  const url = new URL("http://localhost/api/documents/preview-html");
  if (path !== undefined) url.searchParams.set("path", path);
  return new NextRequest(url.toString());
}

function makeBlob(content: Buffer | ArrayBuffer = Buffer.from("fake docx bytes")) {
  return { arrayBuffer: vi.fn().mockResolvedValue(content) };
}

function makeClient(
  user: { id: string } | null = { id: UID },
  storageError                = false,
  blob                        = makeBlob(),
) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    from: vi.fn(),
    storage: {
      from: vi.fn().mockReturnValue({
        download: vi.fn().mockResolvedValue(
          storageError
            ? { data: null, error: new Error("not found") }
            : { data: blob, error: null },
        ),
      }),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRL.mockReturnValue({ allowed: true, remaining: 19, resetAt: Date.now() + 60_000 });
  mockCreate.mockResolvedValue(makeClient() as never);
  mockConvert.mockResolvedValue({ value: "<p>Hello world</p>", messages: [] });
});

// ── Authentication ─────────────────────────────────────────────────────────────

describe("GET /api/documents/preview-html — authentication", () => {
  it("returns 401 when user is not authenticated", async () => {
    mockCreate.mockResolvedValue(makeClient(null) as never);
    const res = await GET(makeRequest(`${UID}/resume.docx`));
    expect(res.status).toBe(401);
  });
});

// ── Rate limiting ──────────────────────────────────────────────────────────────

describe("GET /api/documents/preview-html — rate limiting", () => {
  it("returns 429 when rate limit is exceeded", async () => {
    mockRL.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 1000 });
    const res = await GET(makeRequest(`${UID}/resume.docx`));
    expect(res.status).toBe(429);
  });

  it("calls checkRateLimit with the user-scoped key", async () => {
    await GET(makeRequest(`${UID}/resume.docx`));
    expect(mockRL).toHaveBeenCalledWith(`docx-preview:${UID}`, expect.objectContaining({ maxRequests: 20 }));
  });
});

// ── Path validation ────────────────────────────────────────────────────────────

describe("GET /api/documents/preview-html — path validation", () => {
  it("returns 400 when path query param is absent", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(400);
  });

  it("returns 400 when path contains '..' (traversal guard)", async () => {
    const res = await GET(makeRequest(`${UID}/../${OTHER_UID}/secret.docx`));
    expect(res.status).toBe(400);
  });

  it("returns 400 when path starts with '/'", async () => {
    const res = await GET(makeRequest(`/${UID}/resume.docx`));
    expect(res.status).toBe(400);
  });

  it("returns 403 when first path segment does not match user.id", async () => {
    const res = await GET(makeRequest(`${OTHER_UID}/resume.docx`));
    expect(res.status).toBe(403);
  });

  it("returns 400 for .pdf extension", async () => {
    const res = await GET(makeRequest(`${UID}/resume.pdf`));
    expect(res.status).toBe(400);
  });

  it("returns 400 for .txt extension", async () => {
    const res = await GET(makeRequest(`${UID}/notes.txt`));
    expect(res.status).toBe(400);
  });

  it("returns 400 for extension-less path", async () => {
    const res = await GET(makeRequest(`${UID}/nodot`));
    expect(res.status).toBe(400);
  });
});

// ── Storage errors ─────────────────────────────────────────────────────────────

describe("GET /api/documents/preview-html — storage", () => {
  it("returns 404 when storage download fails", async () => {
    mockCreate.mockResolvedValue(makeClient({ id: UID }, true) as never);
    const res = await GET(makeRequest(`${UID}/resume.docx`));
    expect(res.status).toBe(404);
  });

  it("returns 400 when file exceeds 10 MB", async () => {
    const oversized = makeBlob(new ArrayBuffer(10 * 1024 * 1024 + 1));
    mockCreate.mockResolvedValue(makeClient({ id: UID }, false, oversized) as never);
    const res = await GET(makeRequest(`${UID}/resume.docx`));
    expect(res.status).toBe(400);
  });
});

// ── Success ────────────────────────────────────────────────────────────────────

describe("GET /api/documents/preview-html — success", () => {
  it("returns 200 with html body for .docx file", async () => {
    const res = await GET(makeRequest(`${UID}/resume.docx`));
    expect(res.status).toBe(200);
    const body = await res.json() as { html: string };
    expect(body.html).toBe("<p>Hello world</p>");
  });

  it("returns 200 for .doc extension (same code path as .docx)", async () => {
    const res = await GET(makeRequest(`${UID}/resume.doc`));
    expect(res.status).toBe(200);
  });

  it("returns fallback html when mammoth produces empty string", async () => {
    mockConvert.mockResolvedValue({ value: "", messages: [] });
    const res = await GET(makeRequest(`${UID}/empty.docx`));
    expect(res.status).toBe(200);
    const body = await res.json() as { html: string };
    expect(body.html.length).toBeGreaterThan(0);
  });

  it("sets Cache-Control: private, max-age=300", async () => {
    const res = await GET(makeRequest(`${UID}/resume.docx`));
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=300");
  });

  it("accepts uppercase extension (.DOCX)", async () => {
    const res = await GET(makeRequest(`${UID}/Resume.DOCX`));
    expect(res.status).toBe(200);
  });
});
