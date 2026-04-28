/**
 * Unit tests — GET / POST / DELETE /api/profile/certifications
 *
 * Covers:
 *   GET:    401 unauthed · 200 with list · 500 DB error
 *   POST:   403 bad origin · 401 unauthed · 429 rate-limited
 *           422 schema (empty name, name too long, invalid date format)
 *           422 refine (expires_at before issued_at)
 *           201 created · 500 insert failure
 *           Accepts valid optional fields (provider, credential_id, credential_url, expires_at)
 *   DELETE: 401 · 403 · 400 missing/non-UUID id · 404 no row · 204 success · 500 DB error
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { makeChain } from "@/tests/helpers/supabase-mock";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: vi.fn() }));

import { GET, POST, DELETE } from "@/app/api/profile/certifications/route";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";

const mockCreate = vi.mocked(createClient);
const mockRL     = vi.mocked(checkRateLimit);

const USER       = { id: "uid-1", email: "u@test.com" };
const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
const CERT = {
  id: VALID_UUID, name: "AWS Solutions Architect", provider: "Amazon",
  issued_at: "2024-01-15", expires_at: null, user_id: USER.id,
};

function makeClient(user: unknown, dbResult: unknown = { data: null, error: null }) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    from: vi.fn().mockReturnValue(makeChain(dbResult)),
  };
}

function postReq(body: unknown, origin?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (origin) headers["Origin"] = origin;
  return new NextRequest("http://localhost/api/profile/certifications", {
    method: "POST", headers, body: JSON.stringify(body),
  });
}

function deleteReq(id?: string) {
  const url = id
    ? `http://localhost/api/profile/certifications?id=${id}`
    : "http://localhost/api/profile/certifications";
  return new NextRequest(url, { method: "DELETE" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRL.mockReturnValue({ allowed: true, remaining: 29, resetTime: Date.now() + 60_000 });
});

// ── GET ───────────────────────────────────────────────────────────────────────

describe("GET /api/profile/certifications", () => {
  it("returns 401 when unauthenticated", async () => {
    mockCreate.mockResolvedValue(makeClient(null) as never);
    expect((await GET()).status).toBe(401);
  });

  it("returns 200 with certifications list", async () => {
    mockCreate.mockResolvedValue(makeClient(USER, { data: [CERT], error: null }) as never);
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).certifications).toEqual([CERT]);
  });

  it("returns 500 when DB query fails", async () => {
    mockCreate.mockResolvedValue(
      makeClient(USER, { data: null, error: { message: "db error" } }) as never
    );
    expect((await GET()).status).toBe(500);
  });
});

// ── POST ──────────────────────────────────────────────────────────────────────

describe("POST /api/profile/certifications", () => {
  it("returns 403 for foreign origin", async () => {
    mockCreate.mockResolvedValue(makeClient(USER) as never);
    expect((await POST(postReq({ name: "AWS SAA", issued_at: "2024-01-15" }, "https://evil.com"))).status).toBe(403);
  });

  it("returns 401 when unauthenticated", async () => {
    mockCreate.mockResolvedValue(makeClient(null) as never);
    expect((await POST(postReq({ name: "AWS SAA", issued_at: "2024-01-15" }))).status).toBe(401);
  });

  it("returns 429 when rate-limited", async () => {
    mockRL.mockReturnValue({ allowed: false, remaining: 0, resetTime: Date.now() + 60_000 });
    mockCreate.mockResolvedValue(makeClient(USER) as never);
    expect((await POST(postReq({ name: "AWS SAA", issued_at: "2024-01-15" }))).status).toBe(429);
  });

  it("returns 422 when name is empty", async () => {
    mockCreate.mockResolvedValue(makeClient(USER) as never);
    expect((await POST(postReq({ name: "", issued_at: "2024-01-15" }))).status).toBe(422);
  });

  it("returns 422 when name exceeds 120 chars", async () => {
    mockCreate.mockResolvedValue(makeClient(USER) as never);
    expect((await POST(postReq({ name: "x".repeat(121), issued_at: "2024-01-15" }))).status).toBe(422);
  });

  it("returns 422 when issued_at is missing", async () => {
    mockCreate.mockResolvedValue(makeClient(USER) as never);
    expect((await POST(postReq({ name: "AWS SAA" }))).status).toBe(422);
  });

  it("returns 422 when issued_at is not a valid date", async () => {
    mockCreate.mockResolvedValue(makeClient(USER) as never);
    expect((await POST(postReq({ name: "AWS SAA", issued_at: "not-a-date" }))).status).toBe(422);
  });

  it("returns 422 when expires_at is before issued_at", async () => {
    mockCreate.mockResolvedValue(makeClient(USER) as never);
    const res = await POST(postReq({
      name: "AWS SAA",
      issued_at: "2024-06-01",
      expires_at: "2024-01-01",
    }));
    expect(res.status).toBe(422);
  });

  it("returns 422 when expires_at equals issued_at", async () => {
    mockCreate.mockResolvedValue(makeClient(USER) as never);
    const res = await POST(postReq({
      name: "AWS SAA",
      issued_at: "2024-06-01",
      expires_at: "2024-06-01",
    }));
    expect(res.status).toBe(422);
  });

  it("returns 201 with created certification (minimal fields)", async () => {
    mockCreate.mockResolvedValue(makeClient(USER, { data: CERT, error: null }) as never);
    const res = await POST(postReq({ name: "AWS SAA", issued_at: "2024-01-15" }));
    expect(res.status).toBe(201);
    expect((await res.json()).certification.name).toBe("AWS Solutions Architect");
  });

  it("returns 201 with all optional fields filled in", async () => {
    const full = { ...CERT, expires_at: "2027-01-15" };
    mockCreate.mockResolvedValue(makeClient(USER, { data: full, error: null }) as never);
    const res = await POST(postReq({
      name: "AWS SAA",
      provider: "Amazon",
      credential_id: "CERT-12345",
      credential_url: "https://aws.amazon.com/verify",
      issued_at: "2024-01-15",
      expires_at: "2027-01-15",
    }));
    expect(res.status).toBe(201);
  });

  it("returns 500 when insert fails", async () => {
    mockCreate.mockResolvedValue(
      makeClient(USER, { data: null, error: { message: "insert error" } }) as never
    );
    expect((await POST(postReq({ name: "AWS SAA", issued_at: "2024-01-15" }))).status).toBe(500);
  });
});

// ── DELETE ────────────────────────────────────────────────────────────────────

describe("DELETE /api/profile/certifications", () => {
  it("returns 401 when unauthenticated", async () => {
    mockCreate.mockResolvedValue(makeClient(null) as never);
    expect((await DELETE(deleteReq(VALID_UUID))).status).toBe(401);
  });

  it("returns 403 for foreign origin", async () => {
    mockCreate.mockResolvedValue(makeClient(USER) as never);
    const req = new NextRequest(`http://localhost/api/profile/certifications?id=${VALID_UUID}`, {
      method: "DELETE",
      headers: { "Origin": "https://evil.com" },
    });
    expect((await DELETE(req)).status).toBe(403);
  });

  it("returns 400 when id is missing", async () => {
    mockCreate.mockResolvedValue(makeClient(USER) as never);
    expect((await DELETE(deleteReq())).status).toBe(400);
  });

  it("returns 400 for non-UUID id", async () => {
    mockCreate.mockResolvedValue(makeClient(USER) as never);
    const res = await DELETE(deleteReq("not-a-uuid"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/valid certification id/i);
  });

  it("returns 404 when no row was deleted", async () => {
    mockCreate.mockResolvedValue(makeClient(USER, { data: [], error: null }) as never);
    expect((await DELETE(deleteReq(VALID_UUID))).status).toBe(404);
  });

  it("returns 204 on successful delete", async () => {
    mockCreate.mockResolvedValue(
      makeClient(USER, { data: [{ id: VALID_UUID }], error: null }) as never
    );
    expect((await DELETE(deleteReq(VALID_UUID))).status).toBe(204);
  });

  it("returns 500 on DB error", async () => {
    mockCreate.mockResolvedValue(
      makeClient(USER, { data: null, error: { message: "db error" } }) as never
    );
    expect((await DELETE(deleteReq(VALID_UUID))).status).toBe(500);
  });
});
