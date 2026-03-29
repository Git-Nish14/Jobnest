import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeChain } from "@/tests/helpers/supabase-mock";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: vi.fn() }));

import { POST, GET, DELETE } from "@/app/api/documents/share/route";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";

const mockRL     = vi.mocked(checkRateLimit);
const mockCreate = vi.mocked(createClient);

// Proper RFC 4122 v4 UUID
const VALID_DOC_ID = "550e8400-e29b-41d4-a716-446655440001";

function makeClient(user: unknown = { id: "uid" }) {
  const docChain  = makeChain({ data: { id: VALID_DOC_ID }, error: null });
  const linkResult = { id: "link-id", token: "abc123token", expires_at: new Date(Date.now() + 86400_000).toISOString(), view_count: 0 };
  const linkInsert = {
    ...makeChain({ data: linkResult, error: null }),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: linkResult, error: null }),
  };
  const linksListChain = {
    ...makeChain({ data: [], error: null }),
    then: (r: (v: unknown) => void) => Promise.resolve({ data: [], error: null }).then(r),
  };
  linksListChain.eq = vi.fn().mockReturnValue(linksListChain);
  linksListChain.order = vi.fn().mockReturnValue(linksListChain);

  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    from: vi.fn((t: string) => {
      if (t === "application_documents") return docChain;
      if (t === "document_shared_links") {
        return {
          ...linksListChain,
          insert: vi.fn().mockReturnValue(linkInsert),
          delete: vi.fn().mockReturnValue(makeChain({ data: null, error: null })),
        };
      }
      return makeChain();
    }),
  };
}

function jsonRequest(url: string, body: unknown, method = "POST"): Request {
  return new Request(`http://localhost${url}`, {
    method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRL.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() + 60_000 });
  process.env.NEXT_PUBLIC_SITE_URL = "https://jobnest.test";
});

describe("POST /api/documents/share", () => {
  it("returns 401 when unauthenticated", async () => {
    mockCreate.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: { message: "unauth" } }) },
    } as never);
    const res = await POST(jsonRequest("/api/documents/share", { document_id: VALID_DOC_ID }) as never);
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid document_id", async () => {
    mockCreate.mockResolvedValue(makeClient() as never);
    const res = await POST(jsonRequest("/api/documents/share", { document_id: "not-a-uuid" }) as never);
    expect(res.status).toBe(422);
  });

  it("creates a share link and returns 201", async () => {
    mockCreate.mockResolvedValue(makeClient() as never);
    const res = await POST(jsonRequest("/api/documents/share", { document_id: VALID_DOC_ID, expires_in: "7d" }) as never);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.share_url).toContain("jobnest.test");
    expect(body.link).toBeDefined();
  });
});

describe("GET /api/documents/share", () => {
  it("returns 400 without document_id", async () => {
    mockCreate.mockResolvedValue(makeClient() as never);
    const res = await GET(new Request("http://localhost/api/documents/share") as never);
    expect(res.status).toBe(400);
  });

  it("returns 200 with empty links array", async () => {
    mockCreate.mockResolvedValue(makeClient() as never);
    const res = await GET(new Request(`http://localhost/api/documents/share?document_id=${VALID_DOC_ID}`) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.links)).toBe(true);
  });
});

describe("DELETE /api/documents/share", () => {
  it("returns 400 without link_id", async () => {
    mockCreate.mockResolvedValue(makeClient() as never);
    const res = await DELETE(new Request("http://localhost/api/documents/share", { method: "DELETE" }) as never);
    expect(res.status).toBe(400);
  });

  it("returns 204 on successful revoke", async () => {
    mockCreate.mockResolvedValue(makeClient() as never);
    const res = await DELETE(new Request("http://localhost/api/documents/share?link_id=link-id", { method: "DELETE" }) as never);
    expect(res.status).toBe(204);
  });
});
