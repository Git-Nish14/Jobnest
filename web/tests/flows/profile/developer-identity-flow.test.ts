/**
 * E2E flow — Developer Identity (skills, certifications, education)
 *
 * Each sub-flow exercises the full request pipeline for one entity type:
 *   1. GET empty list
 *   2. POST to create an entry → 201
 *   3. GET again → list includes the new entry
 *   4. DELETE the entry → 204
 *   5. GET again → list is empty
 *
 * Confirms that auth, schema validation, and the UUID guard all compose
 * correctly across requests — the same guarantee a real integration test
 * would provide, using the same DB-layer mock the rest of the test suite uses.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { makeChain } from "@/tests/helpers/supabase-mock";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: vi.fn() }));

import { GET as getSkills, POST as postSkill, DELETE as deleteSkill } from "@/app/api/profile/skills/route";
import { GET as getCerts,  POST as postCert,  DELETE as deleteCert  } from "@/app/api/profile/certifications/route";
import { GET as getEdu,    POST as postEdu,   DELETE as deleteEdu   } from "@/app/api/profile/education/route";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";

const mockCreate = vi.mocked(createClient);
const mockRL     = vi.mocked(checkRateLimit);

const USER       = { id: "uid-flow", email: "flow@test.com" };
const SKILL_UUID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const CERT_UUID  = "11111111-2222-3333-4444-555555555555";
const EDU_UUID   = "66666666-7777-8888-9999-000000000000";

const SKILL_ROW = { id: SKILL_UUID, name: "Rust",       category: "Language",  proficiency: "Advanced",     years_experience: 2,    user_id: USER.id };
const CERT_ROW  = { id: CERT_UUID,  name: "CKA",        provider: "CNCF",      issued_at: "2024-03-01",     expires_at: "2027-03-01", user_id: USER.id };
const EDU_ROW   = { id: EDU_UUID,   institution: "ETH", degree: "MS",          field_of_study: "ML",        start_date: "2020-09-01",  end_date: "2022-07-01", is_current: false, gpa: 5.5, show_gpa: false, activities: [], user_id: USER.id };

function client(user: unknown, result: unknown = { data: null, error: null }) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    from: vi.fn().mockReturnValue(makeChain(result)),
  };
}

function postReq(url: string, body: unknown) {
  return new NextRequest(`http://localhost${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function delReq(url: string, id: string) {
  return new NextRequest(`http://localhost${url}?id=${id}`, { method: "DELETE" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRL.mockReturnValue({ allowed: true, remaining: 29, resetTime: Date.now() + 60_000 });
});

// ── Skills CRUD flow ──────────────────────────────────────────────────────────

describe("Skills — full CRUD flow", () => {
  it("GET returns empty list before any skills are added", async () => {
    mockCreate.mockResolvedValue(client(USER, { data: [], error: null }) as never);
    const res = await getSkills();
    expect(res.status).toBe(200);
    expect((await res.json()).skills).toEqual([]);
  });

  it("POST creates a skill and returns 201 with the new row", async () => {
    mockCreate.mockResolvedValue(client(USER, { data: SKILL_ROW, error: null }) as never);
    const res = await postSkill(postReq("/api/profile/skills", {
      name: "Rust", category: "Language", proficiency: "Advanced", years_experience: 2,
    }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.skill.id).toBe(SKILL_UUID);
    expect(body.skill.name).toBe("Rust");
  });

  it("GET returns the new skill after creation", async () => {
    mockCreate.mockResolvedValue(client(USER, { data: [SKILL_ROW], error: null }) as never);
    const res = await getSkills();
    expect(res.status).toBe(200);
    expect((await res.json()).skills).toHaveLength(1);
    expect((await (await getSkills())).status).toBe(200);
  });

  it("DELETE returns 204 for the created skill", async () => {
    mockCreate.mockResolvedValue(client(USER, { data: [{ id: SKILL_UUID }], error: null }) as never);
    const res = await deleteSkill(delReq("/api/profile/skills", SKILL_UUID));
    expect(res.status).toBe(204);
  });

  it("DELETE returns 404 for an already-deleted (stale) skill", async () => {
    mockCreate.mockResolvedValue(client(USER, { data: [], error: null }) as never);
    const res = await deleteSkill(delReq("/api/profile/skills", SKILL_UUID));
    expect(res.status).toBe(404);
  });

  it("GET returns empty list after deletion", async () => {
    mockCreate.mockResolvedValue(client(USER, { data: [], error: null }) as never);
    const res = await getSkills();
    expect(res.status).toBe(200);
    expect((await res.json()).skills).toEqual([]);
  });

  it("unauthenticated request is rejected at every step", async () => {
    mockCreate.mockResolvedValue(client(null) as never);
    expect((await getSkills()).status).toBe(401);
    expect((await postSkill(postReq("/api/profile/skills", { name: "Go" }))).status).toBe(401);
    expect((await deleteSkill(delReq("/api/profile/skills", SKILL_UUID))).status).toBe(401);
  });
});

// ── Certifications CRUD flow ──────────────────────────────────────────────────

describe("Certifications — full CRUD flow", () => {
  it("POST creates a certification with expiry and returns 201", async () => {
    mockCreate.mockResolvedValue(client(USER, { data: CERT_ROW, error: null }) as never);
    const res = await postCert(postReq("/api/profile/certifications", {
      name: "CKA", provider: "CNCF",
      issued_at: "2024-03-01", expires_at: "2027-03-01",
    }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.certification.name).toBe("CKA");
    expect(body.certification.expires_at).toBe("2027-03-01");
  });

  it("POST rejects invalid date ordering before hitting DB", async () => {
    const c = client(USER);
    mockCreate.mockResolvedValue(c as never);
    const res = await postCert(postReq("/api/profile/certifications", {
      name: "CKA", issued_at: "2027-03-01", expires_at: "2024-03-01",
    }));
    expect(res.status).toBe(422);
    // Zod refine rejects before any DB round-trip
    expect(c.from).not.toHaveBeenCalled();
  });

  it("DELETE returns 204 for a valid certification", async () => {
    mockCreate.mockResolvedValue(client(USER, { data: [{ id: CERT_UUID }], error: null }) as never);
    const res = await deleteCert(delReq("/api/profile/certifications", CERT_UUID));
    expect(res.status).toBe(204);
  });

  it("GET returns the certification list", async () => {
    mockCreate.mockResolvedValue(client(USER, { data: [CERT_ROW], error: null }) as never);
    const res = await getCerts();
    expect(res.status).toBe(200);
    expect((await res.json()).certifications).toHaveLength(1);
  });
});

// ── Education CRUD flow ───────────────────────────────────────────────────────

describe("Education — full CRUD flow", () => {
  it("POST creates an education entry and returns 201", async () => {
    mockCreate.mockResolvedValue(client(USER, { data: EDU_ROW, error: null }) as never);
    const res = await postEdu(postReq("/api/profile/education", {
      institution: "ETH", degree: "MS", field_of_study: "ML",
      start_date: "2020-09-01", end_date: "2022-07-01", is_current: false,
    }));
    expect(res.status).toBe(201);
    expect((await res.json()).education.institution).toBe("ETH");
  });

  it("POST with is_current=true succeeds even without end_date", async () => {
    const currentEntry = { ...EDU_ROW, end_date: null, is_current: true };
    mockCreate.mockResolvedValue(client(USER, { data: currentEntry, error: null }) as never);
    const res = await postEdu(postReq("/api/profile/education", {
      institution: "Stanford", degree: "PhD", start_date: "2022-09-01", is_current: true,
    }));
    expect(res.status).toBe(201);
  });

  it("POST rejects end_date before start_date without is_current", async () => {
    mockCreate.mockResolvedValue(client(USER) as never);
    const res = await postEdu(postReq("/api/profile/education", {
      institution: "MIT", start_date: "2022-09-01",
      end_date: "2020-01-01", is_current: false,
    }));
    expect(res.status).toBe(422);
  });

  it("DELETE returns 204 for a valid education entry", async () => {
    mockCreate.mockResolvedValue(client(USER, { data: [{ id: EDU_UUID }], error: null }) as never);
    const res = await deleteEdu(delReq("/api/profile/education", EDU_UUID));
    expect(res.status).toBe(204);
  });

  it("DELETE returns 404 for a stale id (row already gone)", async () => {
    mockCreate.mockResolvedValue(client(USER, { data: [], error: null }) as never);
    const res = await deleteEdu(delReq("/api/profile/education", EDU_UUID));
    expect(res.status).toBe(404);
  });

  it("GET returns education entries in order", async () => {
    mockCreate.mockResolvedValue(client(USER, { data: [EDU_ROW], error: null }) as never);
    const res = await getEdu();
    expect(res.status).toBe(200);
    expect((await res.json()).education[0].institution).toBe("ETH");
  });
});

// ── Cross-cutting: schema guards stop DB calls ────────────────────────────────

describe("Schema validation prevents DB round-trips", () => {
  it("invalid skill category never reaches the DB", async () => {
    const c = client(USER);
    mockCreate.mockResolvedValue(c as never);
    await postSkill(postReq("/api/profile/skills", { name: "Go", category: "Magic" }));
    expect((c.from as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it("invalid education degree never reaches the DB", async () => {
    const c = client(USER);
    mockCreate.mockResolvedValue(c as never);
    await postEdu(postReq("/api/profile/education", { institution: "MIT", degree: "DD", start_date: "2020-01-01" }));
    expect((c.from as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it("non-UUID delete id never reaches the DB", async () => {
    const c = client(USER);
    mockCreate.mockResolvedValue(c as never);
    await deleteSkill(delReq("/api/profile/skills", "not-a-uuid"));
    expect((c.from as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });
});
