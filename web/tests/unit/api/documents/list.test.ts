import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeChain } from "@/tests/helpers/supabase-mock";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/utils/storage", () => ({
  getSignedUrls: vi.fn().mockResolvedValue({}),
}));

import { GET } from "@/app/api/documents/list/route";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";

const mockRL     = vi.mocked(checkRateLimit);
const mockCreate = vi.mocked(createClient);

const DOC_ROWS = [
  { id: "d1", storage_path: "uid/app/Resume/1_r.pdf", label: "Resume", is_current: true, size_bytes: 1024, mime_type: "application/pdf", uploaded_at: new Date().toISOString() },
];

function makeClient(user: unknown = { id: "uid" }, docs: unknown[] = DOC_ROWS) {
  const appChain  = makeChain({ data: { id: "app-id" }, error: null });
  // docs query chain needs to resolve as array
  const docsChain = {
    ...makeChain({ data: docs, error: null }),
    then: (resolve: (v: unknown) => void) => Promise.resolve({ data: docs, error: null }).then(resolve),
  };
  docsChain.eq    = vi.fn().mockReturnValue(docsChain);
  docsChain.is    = vi.fn().mockReturnValue(docsChain);
  docsChain.order = vi.fn().mockReturnValue(docsChain);
  docsChain.select = vi.fn().mockReturnValue(docsChain);

  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    from: vi.fn((t: string) => {
      if (t === "job_applications") return appChain;
      if (t === "application_documents") return docsChain;
      return makeChain();
    }),
  };
}

function makeGetRequest(params: Record<string, string>): Request {
  const url = new URL("http://localhost/api/documents/list");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new Request(url.toString(), { method: "GET" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRL.mockReturnValue({ allowed: true, remaining: 100, resetAt: Date.now() + 60_000 });
});

describe("GET /api/documents/list", () => {
  it("returns 401 when unauthenticated", async () => {
    mockCreate.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: { message: "unauth" } }) },
    } as never);
    const res = await GET(makeGetRequest({ application_id: "app-id" }) as never);
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockCreate.mockResolvedValue(makeClient() as never);
    mockRL.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() });
    const res = await GET(makeGetRequest({ application_id: "app-id" }) as never);
    expect(res.status).toBe(429);
  });

  it("returns 200 with documents list", async () => {
    mockCreate.mockResolvedValue(makeClient() as never);
    const res = await GET(makeGetRequest({ application_id: "app-id" }) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.documents)).toBe(true);
  });

  it("returns documents with signed_url field", async () => {
    const { getSignedUrls } = await import("@/lib/utils/storage");
    vi.mocked(getSignedUrls).mockResolvedValueOnce({ "uid/app/Resume/1_r.pdf": "https://signed.url/file" });
    mockCreate.mockResolvedValue(makeClient() as never);
    const res = await GET(makeGetRequest({ application_id: "app-id" }) as never);
    const body = await res.json();
    expect(body.documents[0]).toHaveProperty("signed_url");
  });
});
