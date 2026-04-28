/**
 * Unit tests — GET / POST / DELETE /api/profile/skills
 *
 * Covers:
 *   GET:    401 unauthenticated · 200 with list · 500 on DB error
 *   POST:   403 bad origin · 401 unauthed · 429 rate-limited
 *           422 schema rejections (empty name, too long, bad category/proficiency)
 *           201 created · 500 insert failure
 *   DELETE: 401 unauthed · 403 bad origin · 400 missing id · 400 non-UUID id
 *           404 no row deleted · 204 success · 500 DB error
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { makeChain } from "@/tests/helpers/supabase-mock";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: vi.fn() }));

import { GET, POST, DELETE } from "@/app/api/profile/skills/route";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";

const mockCreate = vi.mocked(createClient);
const mockRL     = vi.mocked(checkRateLimit);

const USER       = { id: "uid-1", email: "u@test.com" };
const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
const SKILL      = { id: VALID_UUID, name: "TypeScript", category: "Language", proficiency: "Advanced", years_experience: 3, user_id: USER.id };

function makeClient(user: unknown, dbResult: unknown = { data: null, error: null }) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    from: vi.fn().mockReturnValue(makeChain(dbResult)),
  };
}

function postReq(body: unknown, origin?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (origin) headers["Origin"] = origin;
  return new NextRequest("http://localhost/api/profile/skills", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function deleteReq(id?: string) {
  const url = id
    ? `http://localhost/api/profile/skills?id=${id}`
    : "http://localhost/api/profile/skills";
  return new NextRequest(url, { method: "DELETE" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRL.mockReturnValue({ allowed: true, remaining: 29, resetTime: Date.now() + 60_000 });
});

// ── GET ───────────────────────────────────────────────────────────────────────

describe("GET /api/profile/skills", () => {
  it("returns 401 when unauthenticated", async () => {
    mockCreate.mockResolvedValue(makeClient(null) as never);
    expect((await GET()).status).toBe(401);
  });

  it("returns 200 with skills list", async () => {
    mockCreate.mockResolvedValue(makeClient(USER, { data: [SKILL], error: null }) as never);
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).skills).toEqual([SKILL]);
  });

  it("returns 500 when DB query fails", async () => {
    mockCreate.mockResolvedValue(
      makeClient(USER, { data: null, error: { message: "db error" } }) as never
    );
    expect((await GET()).status).toBe(500);
  });
});

// ── POST ──────────────────────────────────────────────────────────────────────

describe("POST /api/profile/skills", () => {
  it("returns 403 when Origin header is a foreign domain", async () => {
    mockCreate.mockResolvedValue(makeClient(USER) as never);
    expect((await POST(postReq({ name: "TypeScript" }, "https://evil.com"))).status).toBe(403);
  });

  it("returns 401 when unauthenticated", async () => {
    mockCreate.mockResolvedValue(makeClient(null) as never);
    expect((await POST(postReq({ name: "TypeScript" }))).status).toBe(401);
  });

  it("returns 429 when rate-limited", async () => {
    mockRL.mockReturnValue({ allowed: false, remaining: 0, resetTime: Date.now() + 60_000 });
    mockCreate.mockResolvedValue(makeClient(USER) as never);
    expect((await POST(postReq({ name: "TypeScript" }))).status).toBe(429);
  });

  it("returns 422 when name is empty string", async () => {
    mockCreate.mockResolvedValue(makeClient(USER) as never);
    expect((await POST(postReq({ name: "" }))).status).toBe(422);
  });

  it("returns 422 when name exceeds 80 chars", async () => {
    mockCreate.mockResolvedValue(makeClient(USER) as never);
    expect((await POST(postReq({ name: "x".repeat(81) }))).status).toBe(422);
  });

  it("returns 422 for invalid category value", async () => {
    mockCreate.mockResolvedValue(makeClient(USER) as never);
    expect((await POST(postReq({ name: "Go", category: "Magic" }))).status).toBe(422);
  });

  it("returns 422 for invalid proficiency value", async () => {
    mockCreate.mockResolvedValue(makeClient(USER) as never);
    expect((await POST(postReq({ name: "Go", proficiency: "Godlike" }))).status).toBe(422);
  });

  it("returns 422 for years_experience above 50", async () => {
    mockCreate.mockResolvedValue(makeClient(USER) as never);
    expect((await POST(postReq({ name: "Go", years_experience: 51 }))).status).toBe(422);
  });

  it("returns 201 with created skill", async () => {
    mockCreate.mockResolvedValue(makeClient(USER, { data: SKILL, error: null }) as never);
    const res = await POST(postReq({ name: "TypeScript", category: "Language", proficiency: "Advanced" }));
    expect(res.status).toBe(201);
    expect((await res.json()).skill.name).toBe("TypeScript");
  });

  it("returns 500 when insert fails", async () => {
    mockCreate.mockResolvedValue(
      makeClient(USER, { data: null, error: { message: "insert error" } }) as never
    );
    expect((await POST(postReq({ name: "TypeScript" }))).status).toBe(500);
  });

  it("accepts all valid categories without error", async () => {
    const categories = ["Language", "Framework", "Database", "Cloud", "Tool", "Soft"] as const;
    for (const category of categories) {
      mockCreate.mockResolvedValue(makeClient(USER, { data: { ...SKILL, category }, error: null }) as never);
      const res = await POST(postReq({ name: "Skill", category }));
      expect(res.status).toBe(201);
    }
  });
});

// ── DELETE ────────────────────────────────────────────────────────────────────

describe("DELETE /api/profile/skills", () => {
  it("returns 401 when unauthenticated", async () => {
    mockCreate.mockResolvedValue(makeClient(null) as never);
    expect((await DELETE(deleteReq(VALID_UUID))).status).toBe(401);
  });

  it("returns 403 when Origin header is a foreign domain", async () => {
    mockCreate.mockResolvedValue(makeClient(USER) as never);
    const req = new NextRequest(`http://localhost/api/profile/skills?id=${VALID_UUID}`, {
      method: "DELETE",
      headers: { "Origin": "https://evil.com" },
    });
    expect((await DELETE(req)).status).toBe(403);
  });

  it("returns 400 when id param is missing", async () => {
    mockCreate.mockResolvedValue(makeClient(USER) as never);
    expect((await DELETE(deleteReq())).status).toBe(400);
  });

  it("returns 400 for non-UUID id (plain string)", async () => {
    mockCreate.mockResolvedValue(makeClient(USER) as never);
    const res = await DELETE(deleteReq("not-a-uuid"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/valid skill id/i);
  });

  it("returns 400 for numeric id", async () => {
    mockCreate.mockResolvedValue(makeClient(USER) as never);
    expect((await DELETE(deleteReq("12345"))).status).toBe(400);
  });

  it("returns 404 when no row was deleted (stale or wrong-user id)", async () => {
    mockCreate.mockResolvedValue(makeClient(USER, { data: [], error: null }) as never);
    expect((await DELETE(deleteReq(VALID_UUID))).status).toBe(404);
  });

  it("returns 204 on successful delete", async () => {
    mockCreate.mockResolvedValue(
      makeClient(USER, { data: [{ id: VALID_UUID }], error: null }) as never
    );
    expect((await DELETE(deleteReq(VALID_UUID))).status).toBe(204);
  });

  it("returns 500 when DB delete errors", async () => {
    mockCreate.mockResolvedValue(
      makeClient(USER, { data: null, error: { message: "db error" } }) as never
    );
    expect((await DELETE(deleteReq(VALID_UUID))).status).toBe(500);
  });
});
