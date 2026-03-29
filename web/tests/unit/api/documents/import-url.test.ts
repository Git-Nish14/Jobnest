import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeChain } from "@/tests/helpers/supabase-mock";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/utils/storage", () => ({
  validateMagicBytes: vi.fn().mockReturnValue(true),
}));
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { POST } from "@/app/api/documents/import-url/route";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";

const mockRL     = vi.mocked(checkRateLimit);
const mockCreate = vi.mocked(createClient);

const VALID_APP_ID = "550e8400-e29b-41d4-a716-446655440001";

function makeClient(user: unknown = { id: "uid" }) {
  const appChain = makeChain({ data: { id: VALID_APP_ID }, error: null });
  const updateChain = makeChain({ data: null, error: null });
  const docResult = { id: "doc-id", label: "Resume", storage_path: "uid/app/Resume/1_r.pdf" };
  const docChain = {
    ...makeChain({ data: docResult, error: null }),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: docResult, error: null }),
  };
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    from: vi.fn((t: string) => {
      if (t === "job_applications") return appChain;
      if (t === "application_documents") return { ...updateChain, insert: vi.fn().mockReturnValue(docChain) };
      return updateChain;
    }),
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ error: null }),
        remove: vi.fn().mockResolvedValue({ error: null }),
      }),
    },
  };
}

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/documents/import-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Builds a mock Response that returns a PDF directly */
function pdfResponse(opts: { contentDisposition?: string } = {}): Response {
  return {
    ok: true,
    headers: {
      get: (k: string) => {
        if (k === "content-type")        return "application/pdf";
        if (k === "content-disposition") return opts.contentDisposition ?? null;
        return null;
      },
    },
    arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(100)),
  } as unknown as Response;
}

/** Builds a mock Response that returns octet-stream + Content-Disposition filename */
function octetWithDisposition(filename: string): Response {
  return {
    ok: true,
    headers: {
      get: (k: string) => {
        if (k === "content-type")        return "application/octet-stream";
        if (k === "content-disposition") return `attachment; filename="${filename}"`;
        return null;
      },
    },
    arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(100)),
  } as unknown as Response;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRL.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() + 60_000 });
  vi.stubGlobal("fetch", mockFetch);
});

describe("POST /api/documents/import-url", () => {
  it("returns 401 when unauthenticated", async () => {
    mockCreate.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: { message: "unauth" } }) },
    } as never);
    const res = await POST(jsonRequest({ url: "http://example.com/resume.pdf", label: "Resume", application_id: VALID_APP_ID }) as never);
    expect(res.status).toBe(401);
  });

  it("returns 422 for invalid URL", async () => {
    mockCreate.mockResolvedValue(makeClient() as never);
    const res = await POST(jsonRequest({ url: "not-a-url", label: "Resume", application_id: VALID_APP_ID }) as never);
    expect(res.status).toBe(422);
  });

  it("returns 400 when missing application_id for non-master", async () => {
    mockCreate.mockResolvedValue(makeClient() as never);
    const res = await POST(jsonRequest({ url: "http://example.com/resume.pdf", label: "Resume" }) as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("application_id");
  });

  it("returns 400 on network error", async () => {
    mockCreate.mockResolvedValue(makeClient() as never);
    mockFetch.mockRejectedValueOnce(new Error("Network error"));
    const res = await POST(jsonRequest({ url: "http://example.com/resume.pdf", label: "Resume", application_id: VALID_APP_ID }) as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Could not reach");
  });

  it("returns 400 when remote returns 403 with auth hint", async () => {
    mockCreate.mockResolvedValue(makeClient() as never);
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403 } as Response);
    const res = await POST(jsonRequest({ url: "http://example.com/resume.pdf", label: "Resume", application_id: VALID_APP_ID }) as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("403");
    expect(body.error).toContain("authentication");
  });

  it("returns 400 when non-Google URL returns HTML page", async () => {
    mockCreate.mockResolvedValue(makeClient() as never);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: (k: string) => k === "content-type" ? "text/html" : null },
      text: vi.fn().mockResolvedValue("<html><body>Login page</body></html>"),
    } as unknown as Response);
    const res = await POST(jsonRequest({ url: "http://example.com/resume", label: "Resume", application_id: VALID_APP_ID }) as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("HTML page");
  });

  it("returns 400 for unsupported content type", async () => {
    mockCreate.mockResolvedValue(makeClient() as never);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: (k: string) => k === "content-type" ? "application/zip" : null },
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(10)),
    } as unknown as Response);
    const res = await POST(jsonRequest({ url: "http://example.com/file.zip", label: "Resume", application_id: VALID_APP_ID }) as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("not supported");
  });

  it("returns 201 on successful direct PDF import", async () => {
    mockCreate.mockResolvedValue(makeClient() as never);
    mockFetch.mockResolvedValueOnce(pdfResponse());
    const res = await POST(jsonRequest({ url: "http://example.com/resume.pdf", label: "Resume", application_id: VALID_APP_ID }) as never);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.document).toBeDefined();
  });

  it("resolves MIME type from Content-Disposition when Content-Type is octet-stream", async () => {
    mockCreate.mockResolvedValue(makeClient() as never);
    // Simulates Google Drive returning application/octet-stream + filename header
    mockFetch.mockResolvedValueOnce(octetWithDisposition("My Resume.pdf"));
    const res = await POST(jsonRequest({ url: "http://example.com/download", label: "Resume", application_id: VALID_APP_ID }) as never);
    expect(res.status).toBe(201);
  });

  it("resolves DOCX from Content-Disposition filename", async () => {
    mockCreate.mockResolvedValue(makeClient() as never);
    mockFetch.mockResolvedValueOnce(octetWithDisposition("Cover Letter.docx"));
    const res = await POST(jsonRequest({ url: "http://example.com/download", label: "Cover Letter", application_id: VALID_APP_ID }) as never);
    expect(res.status).toBe(201);
  });

  it("transforms Google Drive share URL to usercontent download URL", async () => {
    mockCreate.mockResolvedValue(makeClient() as never);
    mockFetch.mockResolvedValueOnce(pdfResponse({ contentDisposition: 'attachment; filename="resume.pdf"' }));
    const gdUrl = "https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/view?usp=sharing";
    const res = await POST(jsonRequest({ url: gdUrl, label: "Resume", application_id: VALID_APP_ID }) as never);
    expect(res.status).toBe(201);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("drive.usercontent.google.com"),
      expect.any(Object)
    );
  });

  it("handles Google Drive virus-scan confirmation (2-step download)", async () => {
    mockCreate.mockResolvedValue(makeClient() as never);
    // Step 1: confirmation page HTML
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: (k: string) => k === "content-type" ? "text/html; charset=utf-8" : null },
      text: vi.fn().mockResolvedValue(
        '<a href="/uc?export=download&confirm=t&id=FILE_ID">Download anyway</a>'
      ),
    } as unknown as Response);
    // Step 2: actual PDF
    mockFetch.mockResolvedValueOnce(
      pdfResponse({ contentDisposition: 'attachment; filename="My Document.pdf"' })
    );
    const gdUrl = "https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/view?usp=sharing";
    const res = await POST(jsonRequest({ url: gdUrl, label: "Resume", application_id: VALID_APP_ID }) as never);
    expect(res.status).toBe(201);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("handles Google Drive DOCX via Content-Disposition (no ext in URL)", async () => {
    mockCreate.mockResolvedValue(makeClient() as never);
    // Google Drive returns octet-stream with filename in Content-Disposition
    mockFetch.mockResolvedValueOnce(octetWithDisposition("Cover Letter.docx"));
    const gdUrl = "https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/view?usp=sharing";
    const res = await POST(jsonRequest({ url: gdUrl, label: "Cover Letter", application_id: VALID_APP_ID }) as never);
    expect(res.status).toBe(201);
  });
});
