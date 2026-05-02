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

const mockCheckRL  = vi.mocked(checkRateLimit);
const mockCreate   = vi.mocked(createClient);
const mockExtract  = vi.mocked(extractTextFromBuffer);

const USER_ID          = "uid-abc";
const VALID_SESSION_ID = "11111111-2222-3333-4444-555555555555";

function makeStorageClient(uploadError: unknown = null) {
  return { upload: vi.fn().mockResolvedValue({ error: uploadError }) };
}

function makeServerClient(user: unknown = { id: USER_ID }, uploadError: unknown = null) {
  return {
    auth:    { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    storage: { from: vi.fn().mockReturnValue(makeStorageClient(uploadError)) },
  };
}

function makeRequest(file: File | null, sessionId?: string, origin?: string): Request {
  const form = new FormData();
  if (file) form.append("file", file);
  if (sessionId !== undefined) form.append("session_id", sessionId);
  const headers: Record<string, string> = {};
  if (origin) headers["Origin"] = origin;
  return new Request("http://localhost/api/nesta-ai/parse-file", { method: "POST", body: form, headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRL.mockReturnValue({ allowed: true, remaining: 9, resetTime: Date.now() + 60_000 });
  mockCreate.mockResolvedValue(makeServerClient() as never);
  mockExtract.mockResolvedValue({ text: "Hello world", error: null });
});

// ── Auth & CSRF ───────────────────────────────────────────────────────────────

describe("POST /api/nesta-ai/parse-file — auth & CSRF", () => {
  it("returns 403 for a cross-site origin", async () => {
    const file = new File(["content"], "resume.pdf", { type: "application/pdf" });
    const res = await POST(makeRequest(file, VALID_SESSION_ID, "http://evil.example.com") as never);
    expect(res.status).toBe(403);
  });

  it("returns 401 when not authenticated", async () => {
    mockCreate.mockResolvedValue(makeServerClient(null) as never);
    const res = await POST(makeRequest(null, VALID_SESSION_ID) as never);
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRL.mockReturnValue({ allowed: false, remaining: 0, resetTime: Date.now() + 60_000 });
    const res = await POST(makeRequest(null, VALID_SESSION_ID) as never);
    expect(res.status).toBe(429);
  });
});

// ── Input validation ──────────────────────────────────────────────────────────

describe("POST /api/nesta-ai/parse-file — input validation", () => {
  it("returns 400 when no file is provided", async () => {
    const res = await POST(makeRequest(null, VALID_SESSION_ID) as never);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/please select a file/i);
  });

  it("returns 400 when file exceeds 5 MB", async () => {
    const big = new File([new Uint8Array(6 * 1024 * 1024)], "big.pdf", { type: "application/pdf" });
    const res = await POST(makeRequest(big, VALID_SESSION_ID) as never);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/5 MB/i);
  });

  it("returns 400 when session_id is missing (now required for storage)", async () => {
    const file = new File(["content"], "resume.pdf", { type: "application/pdf" });
    const res = await POST(makeRequest(file) as never);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/session/i);
  });

  it("returns 400 when session_id is not a valid UUID (path traversal guard)", async () => {
    const file = new File(["content"], "resume.pdf", { type: "application/pdf" });
    const res = await POST(makeRequest(file, "../../other-user/leaked") as never);
    expect(res.status).toBe(400);
  });

  it("returns 400 when session_id contains non-UUID characters", async () => {
    const file = new File(["content"], "resume.pdf", { type: "application/pdf" });
    const res = await POST(makeRequest(file, "not-a-uuid!") as never);
    expect(res.status).toBe(400);
  });
});

// ── Text extraction ───────────────────────────────────────────────────────────

describe("POST /api/nesta-ai/parse-file — text extraction", () => {
  it("returns 400 with user-friendly message when text extraction fails entirely", async () => {
    mockExtract.mockResolvedValue({ text: null, error: "Unsupported format" });
    const file = new File(["content"], "doc.pdf", { type: "application/pdf" });
    // storage call will still fail (bad content), but extraction error fires first
    mockCreate.mockResolvedValue(makeServerClient({ id: USER_ID }, null) as never);
    const res = await POST(makeRequest(file, VALID_SESSION_ID) as never);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/valid PDF|Word document|plain text/i);
  });

  it("returns 200 with text when extraction has a partial error but text exists", async () => {
    mockExtract.mockResolvedValue({ text: "partial text", error: "some pages failed" });
    const file = new File(["pdf"], "partial.pdf", { type: "application/pdf" });
    const res = await POST(makeRequest(file, VALID_SESSION_ID) as never);
    expect(res.status).toBe(200);
    expect((await res.json()).text).toBe("partial text");
  });
});

// ── Image handling ────────────────────────────────────────────────────────────

describe("POST /api/nesta-ai/parse-file — image files", () => {
  it("skips text extraction for image/png and returns context note as text", async () => {
    const img = new File(["png-bytes"], "screenshot.png", { type: "image/png" });
    const res = await POST(makeRequest(img, VALID_SESSION_ID) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.text).toMatch(/\[Image attached: screenshot\.png\]/);
    expect(mockExtract).not.toHaveBeenCalled();
  });

  it("skips text extraction for image/jpeg", async () => {
    const img = new File(["jpg-bytes"], "photo.jpg", { type: "image/jpeg" });
    const res = await POST(makeRequest(img, VALID_SESSION_ID) as never);
    expect(res.status).toBe(200);
    expect(mockExtract).not.toHaveBeenCalled();
  });
});

// ── Storage upload ────────────────────────────────────────────────────────────

describe("POST /api/nesta-ai/parse-file — storage upload", () => {
  it("returns 200 with storagePath under {userId}/chat-attachments/ on success", async () => {
    const file = new File(["pdf"], "resume.pdf", { type: "application/pdf" });
    const res = await POST(makeRequest(file, VALID_SESSION_ID) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    // New path format: {userId}/chat-attachments/{sessionId}/timestamp_filename
    expect(body.storagePath).toMatch(new RegExp(`^${USER_ID}/chat-attachments/${VALID_SESSION_ID}/`));
    expect(body.storagePath).toContain("resume.pdf");
    expect(body.text).toBe("Hello world");
    expect(body.fileName).toBe("resume.pdf");
  });

  it("returns 500 when storage upload fails (no silent null)", async () => {
    mockCreate.mockResolvedValue(makeServerClient({ id: USER_ID }, { message: "bucket full" }) as never);
    const file = new File(["pdf"], "resume.pdf", { type: "application/pdf" });
    const res = await POST(makeRequest(file, VALID_SESSION_ID) as never);
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/could not save|storage/i);
  });

  it("sanitises special characters in filename used in storage path", async () => {
    const file = new File(["pdf"], "my résumé (2024)!.pdf", { type: "application/pdf" });
    const res = await POST(makeRequest(file, VALID_SESSION_ID) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    // Path must only contain URL-safe characters
    expect(body.storagePath).not.toMatch(/[^a-zA-Z0-9/_.-]/);
  });

  it("uploads to the documents bucket", async () => {
    const client = makeServerClient({ id: USER_ID });
    mockCreate.mockResolvedValue(client as never);
    const file = new File(["pdf"], "resume.pdf", { type: "application/pdf" });
    await POST(makeRequest(file, VALID_SESSION_ID) as never);
    expect(client.storage.from).toHaveBeenCalledWith("documents");
  });

  it("uploads with correct content-type from file", async () => {
    const client = makeServerClient({ id: USER_ID });
    mockCreate.mockResolvedValue(client as never);
    const file = new File(["pdf"], "resume.pdf", { type: "application/pdf" });
    await POST(makeRequest(file, VALID_SESSION_ID) as never);
    const uploadFn = client.storage.from("documents").upload as ReturnType<typeof vi.fn>;
    expect(uploadFn.mock.calls[0][2]).toMatchObject({ contentType: "application/pdf" });
  });

  it("falls back to application/octet-stream for files with no mime type", async () => {
    const client = makeServerClient({ id: USER_ID });
    mockCreate.mockResolvedValue(client as never);
    const file = new File(["txt"], "notes.txt", { type: "" });
    await POST(makeRequest(file, VALID_SESSION_ID) as never);
    const uploadFn = client.storage.from("documents").upload as ReturnType<typeof vi.fn>;
    expect(uploadFn.mock.calls[0][2]).toMatchObject({ contentType: "application/octet-stream" });
  });
});
