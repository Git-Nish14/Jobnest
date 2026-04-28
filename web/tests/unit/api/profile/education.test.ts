/**
 * Unit tests — GET / POST / DELETE /api/profile/education
 *
 * Covers:
 *   GET:    401 unauthed · 200 with list · 500 DB error
 *   POST:   403 bad origin · 401 unauthed · 429 rate-limited
 *           422 schema (empty institution, name too long, invalid degree enum)
 *           422 refine (end_date before start_date when not is_current)
 *           201 created (minimal) · 201 with all optional fields
 *           201 with is_current=true (no end_date required)
 *           500 insert failure
 *   DELETE: 401 · 403 · 400 missing/non-UUID · 404 no row · 204 success · 500
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { makeChain } from "@/tests/helpers/supabase-mock";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: vi.fn() }));

import { GET, POST, DELETE } from "@/app/api/profile/education/route";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";

const mockCreate = vi.mocked(createClient);
const mockRL     = vi.mocked(checkRateLimit);

const USER       = { id: "uid-1", email: "u@test.com" };
const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
const ENTRY = {
  id: VALID_UUID, institution: "MIT", degree: "BS", field_of_study: "Computer Science",
  gpa: 3.8, show_gpa: true, start_date: "2018-09-01", end_date: "2022-05-15",
  is_current: false, activities: [], user_id: USER.id,
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
  return new NextRequest("http://localhost/api/profile/education", {
    method: "POST", headers, body: JSON.stringify(body),
  });
}

function deleteReq(id?: string) {
  const url = id
    ? `http://localhost/api/profile/education?id=${id}`
    : "http://localhost/api/profile/education";
  return new NextRequest(url, { method: "DELETE" });
}

const MINIMAL_POST = { institution: "MIT", start_date: "2018-09-01" };

beforeEach(() => {
  vi.clearAllMocks();
  mockRL.mockReturnValue({ allowed: true, remaining: 29, resetTime: Date.now() + 60_000 });
});

// ── GET ───────────────────────────────────────────────────────────────────────

describe("GET /api/profile/education", () => {
  it("returns 401 when unauthenticated", async () => {
    mockCreate.mockResolvedValue(makeClient(null) as never);
    expect((await GET()).status).toBe(401);
  });

  it("returns 200 with education list", async () => {
    mockCreate.mockResolvedValue(makeClient(USER, { data: [ENTRY], error: null }) as never);
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).education).toEqual([ENTRY]);
  });

  it("returns 500 when DB query fails", async () => {
    mockCreate.mockResolvedValue(
      makeClient(USER, { data: null, error: { message: "db error" } }) as never
    );
    expect((await GET()).status).toBe(500);
  });
});

// ── POST ──────────────────────────────────────────────────────────────────────

describe("POST /api/profile/education", () => {
  it("returns 403 for foreign origin", async () => {
    mockCreate.mockResolvedValue(makeClient(USER) as never);
    expect((await POST(postReq(MINIMAL_POST, "https://evil.com"))).status).toBe(403);
  });

  it("returns 401 when unauthenticated", async () => {
    mockCreate.mockResolvedValue(makeClient(null) as never);
    expect((await POST(postReq(MINIMAL_POST))).status).toBe(401);
  });

  it("returns 429 when rate-limited", async () => {
    mockRL.mockReturnValue({ allowed: false, remaining: 0, resetTime: Date.now() + 60_000 });
    mockCreate.mockResolvedValue(makeClient(USER) as never);
    expect((await POST(postReq(MINIMAL_POST))).status).toBe(429);
  });

  it("returns 422 when institution is empty", async () => {
    mockCreate.mockResolvedValue(makeClient(USER) as never);
    expect((await POST(postReq({ institution: "", start_date: "2020-09-01" }))).status).toBe(422);
  });

  it("returns 422 when institution exceeds 120 chars", async () => {
    mockCreate.mockResolvedValue(makeClient(USER) as never);
    expect((await POST(postReq({ institution: "x".repeat(121), start_date: "2020-09-01" }))).status).toBe(422);
  });

  it("returns 422 for invalid degree enum", async () => {
    mockCreate.mockResolvedValue(makeClient(USER) as never);
    expect((await POST(postReq({ ...MINIMAL_POST, degree: "DD" }))).status).toBe(422);
  });

  it("returns 422 when start_date is missing", async () => {
    mockCreate.mockResolvedValue(makeClient(USER) as never);
    expect((await POST(postReq({ institution: "MIT" }))).status).toBe(422);
  });

  it("returns 422 when end_date is before start_date (not is_current)", async () => {
    mockCreate.mockResolvedValue(makeClient(USER) as never);
    const res = await POST(postReq({
      institution: "MIT", start_date: "2022-09-01",
      end_date: "2020-01-01", is_current: false,
    }));
    expect(res.status).toBe(422);
  });

  it("returns 422 for GPA above 4.0", async () => {
    mockCreate.mockResolvedValue(makeClient(USER) as never);
    expect((await POST(postReq({ ...MINIMAL_POST, gpa: 4.1 }))).status).toBe(422);
  });

  it("returns 201 for minimal valid payload (institution + start_date)", async () => {
    mockCreate.mockResolvedValue(makeClient(USER, { data: ENTRY, error: null }) as never);
    const res = await POST(postReq(MINIMAL_POST));
    expect(res.status).toBe(201);
    expect((await res.json()).education.institution).toBe("MIT");
  });

  it("returns 201 when is_current=true without end_date", async () => {
    const currentEntry = { ...ENTRY, end_date: null, is_current: true };
    mockCreate.mockResolvedValue(makeClient(USER, { data: currentEntry, error: null }) as never);
    const res = await POST(postReq({
      institution: "MIT", start_date: "2022-09-01", is_current: true,
    }));
    expect(res.status).toBe(201);
  });

  it("returns 201 with all optional fields", async () => {
    mockCreate.mockResolvedValue(makeClient(USER, { data: ENTRY, error: null }) as never);
    const res = await POST(postReq({
      institution: "MIT", degree: "BS", field_of_study: "Computer Science",
      gpa: 3.8, show_gpa: true,
      start_date: "2018-09-01", end_date: "2022-05-15", is_current: false,
      activities: ["Robotics Club", "Hackathon"],
    }));
    expect(res.status).toBe(201);
  });

  it("accepts all valid degree values", async () => {
    const degrees = ["BS","MS","PhD","MBA","Associate","Bootcamp","Certificate","Self-taught","Other"] as const;
    for (const degree of degrees) {
      mockCreate.mockResolvedValue(makeClient(USER, { data: { ...ENTRY, degree }, error: null }) as never);
      const res = await POST(postReq({ institution: "Uni", start_date: "2020-09-01", degree }));
      expect(res.status).toBe(201);
    }
  });

  it("returns 500 when insert fails", async () => {
    mockCreate.mockResolvedValue(
      makeClient(USER, { data: null, error: { message: "insert error" } }) as never
    );
    expect((await POST(postReq(MINIMAL_POST))).status).toBe(500);
  });
});

// ── DELETE ────────────────────────────────────────────────────────────────────

describe("DELETE /api/profile/education", () => {
  it("returns 401 when unauthenticated", async () => {
    mockCreate.mockResolvedValue(makeClient(null) as never);
    expect((await DELETE(deleteReq(VALID_UUID))).status).toBe(401);
  });

  it("returns 403 for foreign origin", async () => {
    mockCreate.mockResolvedValue(makeClient(USER) as never);
    const req = new NextRequest(`http://localhost/api/profile/education?id=${VALID_UUID}`, {
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
    expect((await res.json()).error).toMatch(/valid education id/i);
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
