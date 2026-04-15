import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/utils/document-parser", () => ({
  extractTextFromBuffer: vi.fn().mockResolvedValue({ text: "extracted text", error: null }),
}));

import { POST } from "@/app/api/nesta-ai/parse-file/route";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { extractTextFromBuffer } from "@/lib/utils/document-parser";

const mockCheckRL = vi.mocked(checkRateLimit);
const mockCreateClient = vi.mocked(createClient);
const mockExtract = vi.mocked(extractTextFromBuffer);

const VALID_SESSION_ID = "11111111-2222-3333-4444-555555555555";

function makeStorageClient(uploadError: unknown = null) {
  return {
    upload: vi.fn().mockResolvedValue({ error: uploadError }),
  };
}

function makeServerClient(
  user: unknown = { id: "uid", email: "a@b.com" },
  uploadError: unknown = null
) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    storage: { from: vi.fn().mockReturnValue(makeStorageClient(uploadError)) },
  };
}

/** No Origin header → verifyOrigin returns true (same-origin pass-through) */
function makeFormDataRequest(file: File | null, sessionId?: string): Request {
  const form = new FormData();
  if (file) form.append("file", file);
  if (sessionId !== undefined) form.append("session_id", sessionId);
  return new Request("http://localhost/api/nesta-ai/parse-file", {
    method: "POST",
    body: form,
  });
}

/** Cross-site Origin → verifyOrigin returns false → 403 */
function crossOriginRequest(file: File | null): Request {
  const form = new FormData();
  if (file) form.append("file", file);
  return new Request("http://localhost/api/nesta-ai/parse-file", {
    method: "POST",
    headers: { Origin: "http://evil.example.com" },
    body: form,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRL.mockReturnValue({ allowed: true, remaining: 9, resetTime: Date.now() + 60_000 });
  mockCreateClient.mockResolvedValue(makeServerClient() as never);
  mockExtract.mockResolvedValue({ text: "Hello world", error: null });
});

// ── Auth & gates ──────────────────────────────────────────────────────────────

describe("POST /api/nesta-ai/parse-file — auth & gates", () => {
  it("returns 403 when request comes from a cross-site origin", async () => {
    const file = new File(["content"], "resume.pdf", { type: "application/pdf" });
    const req = crossOriginRequest(file);
    const res = await POST(req as never);
    expect(res.status).toBe(403);
  });

  it("returns 401 when not authenticated", async () => {
    mockCreateClient.mockResolvedValue(makeServerClient(null) as never);
    const req = makeFormDataRequest(null);
    const res = await POST(req as never);
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRL.mockReturnValue({ allowed: false, remaining: 0, resetTime: Date.now() + 60_000 });
    const req = makeFormDataRequest(null);
    const res = await POST(req as never);
    expect(res.status).toBe(429);
  });
});

// ── File validation ───────────────────────────────────────────────────────────

describe("POST /api/nesta-ai/parse-file — file validation", () => {
  it("returns 400 with friendly message when no file provided", async () => {
    const req = makeFormDataRequest(null);
    const res = await POST(req as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/please select a file/i);
  });

  it("returns 400 with size message when file exceeds 5 MB", async () => {
    const big = new File([new Uint8Array(6 * 1024 * 1024)], "big.pdf", { type: "application/pdf" });
    const req = makeFormDataRequest(big);
    const res = await POST(req as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/5 MB/i);
  });

  it("returns 422 with user-friendly message when text extraction fails entirely", async () => {
    mockExtract.mockResolvedValue({ text: null, error: "Unsupported format" });
    const file = new File(["content"], "doc.pdf", { type: "application/pdf" });
    const req = makeFormDataRequest(file);
    const res = await POST(req as never);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/valid PDF|Word document|plain text/i);
  });
});

// ── Text extraction ───────────────────────────────────────────────────────────

describe("POST /api/nesta-ai/parse-file — text extraction", () => {
  it("returns 200 with extracted text and fileName on success (no session)", async () => {
    const file = new File(["pdf content"], "resume.pdf", { type: "application/pdf" });
    const req = makeFormDataRequest(file);
    const res = await POST(req as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.text).toBe("Hello world");
    expect(body.fileName).toBe("resume.pdf");
    expect(body.storagePath).toBeNull();
  });

  it("returns 200 even when extraction has partial error but text exists", async () => {
    mockExtract.mockResolvedValue({ text: "partial text", error: "some pages failed" });
    const file = new File(["pdf"], "partial.pdf", { type: "application/pdf" });
    const req = makeFormDataRequest(file);
    const res = await POST(req as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.text).toBe("partial text");
  });
});

// ── Storage upload (sessionId) ────────────────────────────────────────────────

describe("POST /api/nesta-ai/parse-file — storage upload with sessionId", () => {
  it("uploads to storage and returns storagePath when a valid UUID sessionId is provided", async () => {
    mockCreateClient.mockResolvedValue(makeServerClient({ id: "uid" }, null) as never);
    const file = new File(["pdf"], "resume.pdf", { type: "application/pdf" });
    const req = makeFormDataRequest(file, VALID_SESSION_ID);
    const res = await POST(req as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.storagePath).toMatch(/^chat-attachments\/uid\//);
    expect(body.storagePath).toContain(VALID_SESSION_ID);
    expect(body.storagePath).toContain("resume.pdf");
  });

  it("storagePath is null when sessionId is not a valid UUID (path traversal attempt)", async () => {
    const maliciousSessionId = "../../other-user-id/leaked";
    const file = new File(["pdf"], "resume.pdf", { type: "application/pdf" });
    const req = makeFormDataRequest(file, maliciousSessionId);
    const res = await POST(req as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    // Upload must be skipped — no storagePath
    expect(body.storagePath).toBeNull();
  });

  it("storagePath is null when sessionId contains non-UUID characters", async () => {
    const file = new File(["pdf"], "resume.pdf", { type: "application/pdf" });
    const req = makeFormDataRequest(file, "not-a-valid-uuid!");
    const res = await POST(req as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.storagePath).toBeNull();
  });

  it("storagePath is null and still returns 200 when storage upload fails", async () => {
    mockCreateClient.mockResolvedValue(
      makeServerClient({ id: "uid" }, { message: "bucket full" }) as never
    );
    const file = new File(["pdf"], "resume.pdf", { type: "application/pdf" });
    const req = makeFormDataRequest(file, VALID_SESSION_ID);
    const res = await POST(req as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.storagePath).toBeNull();
    // Text was still extracted
    expect(body.text).toBe("Hello world");
  });

  it("storagePath is null when no sessionId is provided", async () => {
    const file = new File(["pdf"], "resume.pdf", { type: "application/pdf" });
    const req = makeFormDataRequest(file); // no sessionId
    const res = await POST(req as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.storagePath).toBeNull();
  });

  it("sanitises dangerous characters in the filename used in storage path", async () => {
    mockCreateClient.mockResolvedValue(makeServerClient({ id: "uid" }, null) as never);
    const file = new File(["pdf"], "my résumé (2024)!.pdf", { type: "application/pdf" });
    const req = makeFormDataRequest(file, VALID_SESSION_ID);
    const res = await POST(req as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    // Storage path must only contain safe characters
    expect(body.storagePath).toMatch(/^chat-attachments\/uid\//);
    expect(body.storagePath).not.toMatch(/[^a-zA-Z0-9/_.-]/);
  });
});
