/**
 * Unit tests for GET /api/portfolio/linkedin/verify
 *
 * Tests URL validation, outbound fetch mock, and auth guard.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { GET as verifyLinkedIn } from "@/app/api/portfolio/linkedin/verify/route";
import { createClient } from "@/lib/supabase/server";

const mockCreate = vi.mocked(createClient);

const USER = { id: "uid-1", email: "user@test.com", user_metadata: {} };

function authedClient() {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: USER }, error: null }) },
  };
}

function unauthClient() {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: { message: "not auth" } }) },
  };
}

function req(url: string) {
  return new NextRequest(`http://localhost/api/portfolio/linkedin/verify?url=${encodeURIComponent(url)}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("GET /api/portfolio/linkedin/verify — auth guard", () => {
  it("returns 401 when unauthenticated", async () => {
    mockCreate.mockResolvedValue(unauthClient() as never);
    const res = await verifyLinkedIn(req("https://linkedin.com/in/nish"));
    expect(res.status).toBe(401);
  });
});

describe("GET /api/portfolio/linkedin/verify — URL validation", () => {
  it("returns { status: 'invalid' } for missing url param", async () => {
    mockCreate.mockResolvedValue(authedClient() as never);
    const r = new NextRequest("http://localhost/api/portfolio/linkedin/verify");
    const res = await verifyLinkedIn(r);
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("invalid");
  });

  it("returns { status: 'invalid' } for a non-LinkedIn URL", async () => {
    mockCreate.mockResolvedValue(authedClient() as never);
    const res = await verifyLinkedIn(req("https://twitter.com/nish"));
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("invalid");
  });

  it("returns { status: 'invalid' } for an HTTP (not HTTPS) LinkedIn URL", async () => {
    mockCreate.mockResolvedValue(authedClient() as never);
    const res = await verifyLinkedIn(req("http://linkedin.com/in/nish"));
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("invalid");
  });

  it("returns { status: 'invalid' } for a company page (not /in/ path)", async () => {
    mockCreate.mockResolvedValue(authedClient() as never);
    const res = await verifyLinkedIn(req("https://linkedin.com/company/google"));
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("invalid");
  });

  it("returns { status: 'invalid' } for a username that is too short (< 3 chars)", async () => {
    mockCreate.mockResolvedValue(authedClient() as never);
    const res = await verifyLinkedIn(req("https://linkedin.com/in/ab"));
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("invalid");
  });
});

describe("GET /api/portfolio/linkedin/verify — fetch results", () => {
  it("returns { status: 'found' } when fetch returns 200", async () => {
    mockCreate.mockResolvedValue(authedClient() as never);
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(null, { status: 200 })
    );
    const res = await verifyLinkedIn(req("https://linkedin.com/in/nishpatel14"));
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("found");
  });

  it("returns { status: 'not_found' } when fetch returns 404", async () => {
    mockCreate.mockResolvedValue(authedClient() as never);
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(null, { status: 404 })
    );
    const res = await verifyLinkedIn(req("https://linkedin.com/in/nobody123xyz"));
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("not_found");
  });

  it("returns { status: 'blocked' } when fetch returns 999 (LinkedIn bot block)", async () => {
    mockCreate.mockResolvedValue(authedClient() as never);
    // Status 999 is outside the spec range so we can't use `new Response()`.
    // Cast a plain object — the route only reads res.status.
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      { status: 999 } as unknown as Response
    );
    const res = await verifyLinkedIn(req("https://linkedin.com/in/nishpatel14"));
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("blocked");
  });

  it("returns { status: 'blocked' } when fetch returns 429 (rate limited)", async () => {
    mockCreate.mockResolvedValue(authedClient() as never);
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(null, { status: 429 })
    );
    const res = await verifyLinkedIn(req("https://linkedin.com/in/nishpatel14"));
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("blocked");
  });

  it("returns { status: 'private' } for 3xx redirect (unauthenticated redirect to login)", async () => {
    mockCreate.mockResolvedValue(authedClient() as never);
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(null, { status: 302 })
    );
    const res = await verifyLinkedIn(req("https://linkedin.com/in/nishpatel14"));
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("private");
  });

  it("returns { status: 'blocked' } when fetch throws (timeout / network error)", async () => {
    mockCreate.mockResolvedValue(authedClient() as never);
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("fetch failed"));
    const res = await verifyLinkedIn(req("https://linkedin.com/in/nishpatel14"));
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("blocked");
  });
});
