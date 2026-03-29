import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeChain } from "@/tests/helpers/supabase-mock";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/utils/storage", () => ({
  validateMagicBytes: vi.fn().mockReturnValue(true),
  uploadVersionedFile: vi.fn().mockResolvedValue("uid/app-id/Resume/12345_resume.pdf"),
}));

import { POST } from "@/app/api/documents/upload/route";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";

const mockRL     = vi.mocked(checkRateLimit);
const mockCreate = vi.mocked(createClient);

function makeFile(name = "resume.pdf", type = "application/pdf", size = 1024): File {
  const blob = new Blob(["x".repeat(size)], { type });
  return new File([blob], name, { type });
}

function makeFormRequest(fields: Record<string, string | File>): Request {
  const form = new FormData();
  Object.entries(fields).forEach(([k, v]) => form.append(k, v));
  return new Request("http://localhost/api/documents/upload", {
    method: "POST",
    body: form,
  });
}

function makeClient(user: unknown = { id: "uid" }, docInsert: unknown = null) {
  const appChain = makeChain({ data: { id: "app-id" }, error: null });
  const updateChain = makeChain({ data: null, error: null });
  const docChain = {
    ...makeChain({ data: { id: "doc-id", label: "Resume" }, error: docInsert }),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: "doc-id", label: "Resume" }, error: docInsert }),
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
        remove: vi.fn().mockResolvedValue({ error: null }),
      }),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRL.mockReturnValue({ allowed: true, remaining: 19, resetAt: Date.now() + 60_000 });
});

describe("POST /api/documents/upload", () => {
  it("returns 401 when not authenticated", async () => {
    mockCreate.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: { message: "Not auth" } }) },
    } as never);
    const res = await POST(makeFormRequest({ file: makeFile(), label: "Resume", application_id: "app-id" }) as never);
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockCreate.mockResolvedValue(makeClient() as never);
    mockRL.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() });
    const res = await POST(makeFormRequest({ file: makeFile(), label: "Resume", application_id: "app-id" }) as never);
    expect(res.status).toBe(429);
  });

  it("returns 400 when no file provided", async () => {
    mockCreate.mockResolvedValue(makeClient() as never);
    const res = await POST(makeFormRequest({ label: "Resume", application_id: "app-id" }) as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("No file");
  });

  it("returns 400 when label is missing", async () => {
    mockCreate.mockResolvedValue(makeClient() as never);
    const res = await POST(makeFormRequest({ file: makeFile(), application_id: "app-id" }) as never);
    expect(res.status).toBe(400);
  });

  it("returns 400 when application_id missing for non-master", async () => {
    mockCreate.mockResolvedValue(makeClient() as never);
    const res = await POST(makeFormRequest({ file: makeFile(), label: "Resume" }) as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("application_id");
  });

  it("returns 400 for unsupported MIME type", async () => {
    mockCreate.mockResolvedValue(makeClient() as never);
    const file = makeFile("test.exe", "application/x-msdownload");
    const res = await POST(makeFormRequest({ file, label: "Resume", application_id: "app-id" }) as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("not supported");
  });

  it("returns 400 when magic bytes validation fails", async () => {
    const { validateMagicBytes } = await import("@/lib/utils/storage");
    vi.mocked(validateMagicBytes).mockReturnValueOnce(false);
    mockCreate.mockResolvedValue(makeClient() as never);
    const res = await POST(makeFormRequest({ file: makeFile(), label: "Resume", application_id: "app-id" }) as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("content does not match");
  });

  it("returns 201 on successful upload", async () => {
    mockCreate.mockResolvedValue(makeClient() as never);
    const res = await POST(makeFormRequest({ file: makeFile(), label: "Resume", application_id: "app-id" }) as never);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.document).toBeDefined();
  });
});
