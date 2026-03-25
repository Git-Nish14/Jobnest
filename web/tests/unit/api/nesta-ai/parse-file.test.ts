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

function makeServerClient(user: unknown = { id: "uid", email: "a@b.com" }) {
  return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) } };
}

function makeFormDataRequest(file: File | null): Request {
  const form = new FormData();
  if (file) form.append("file", file);
  return new Request("http://localhost/api/nesta-ai/parse-file", {
    method: "POST",
    body: form,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRL.mockReturnValue({ allowed: true, remaining: 9, resetTime: Date.now() + 60_000 });
  mockCreateClient.mockResolvedValue(makeServerClient() as never);
  mockExtract.mockResolvedValue({ text: "Hello world", error: null });
});

describe("POST /api/nesta-ai/parse-file", () => {
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

  it("returns 400 with friendly message when no file provided", async () => {
    const req = makeFormDataRequest(null);
    const res = await POST(req as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/please select a file/i);
  });

  it("returns 400 with size message when file exceeds 5 MB", async () => {
    // Create a fake 6 MB file
    const big = new File([new Uint8Array(6 * 1024 * 1024)], "big.pdf", { type: "application/pdf" });
    const req = makeFormDataRequest(big);
    const res = await POST(req as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/5 MB/i);
  });

  it("returns 422 with user-friendly message when text extraction fails", async () => {
    mockExtract.mockResolvedValue({ text: null, error: "Unsupported format" });
    const file = new File(["content"], "doc.pdf", { type: "application/pdf" });
    const req = makeFormDataRequest(file);
    const res = await POST(req as never);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/valid PDF|Word document|plain text/i);
  });

  it("returns 200 with extracted text on success", async () => {
    const file = new File(["pdf content"], "resume.pdf", { type: "application/pdf" });
    const req = makeFormDataRequest(file);
    const res = await POST(req as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.text).toBe("Hello world");
    expect(body.fileName).toBe("resume.pdf");
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
