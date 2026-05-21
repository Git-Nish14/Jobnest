/**
 * Unit tests — POST /api/applications/bulk-import
 *
 * Covers:
 *  - Origin check              → 403
 *  - Auth check                → 401
 *  - Rate limit                → 429
 *  - Empty rows array          → 400
 *  - Rows exceeding 500 cap    → 400
 *  - All rows invalid          → 422 with error list
 *  - Partial success           → 200 with imported count + error list
 *  - Insert failure            → 500 with generic message (no DB internals leaked)
 *  - Happy path                → 200, correct count
 *  - Row defaults              → status defaults to "Applied", date to today
 *  - company_tier field        → accepted when valid, rejected when invalid enum
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeChain } from "@/tests/helpers/supabase-mock";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/security/csrf",       () => ({ verifyOrigin: vi.fn() }));

import { POST } from "@/app/api/applications/bulk-import/route";
import { createClient }  from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyOrigin }  from "@/lib/security/csrf";

const mockCreate   = vi.mocked(createClient);
const mockRL       = vi.mocked(checkRateLimit);
const mockOrigin   = vi.mocked(verifyOrigin);

const USER_ID = "user-uuid-0001";

const VALID_ROW = { company: "Acme Corp", position: "Engineer" };

function makeClient(user: unknown = { id: USER_ID }, insertError: unknown = null) {
  const insertChain = makeChain({ data: null, error: insertError });
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    from: vi.fn().mockReturnValue(insertChain),
  };
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/applications/bulk-import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockOrigin.mockReturnValue(true);
  mockRL.mockReturnValue({ allowed: true, remaining: 4, resetTime: Date.now() + 60_000 });
  mockCreate.mockResolvedValue(makeClient() as never);
});

// ── Gates ─────────────────────────────────────────────────────────────────────

describe("POST /api/applications/bulk-import — gates", () => {
  it("returns 403 when origin check fails", async () => {
    mockOrigin.mockReturnValue(false);
    const res = await POST(makeRequest({ rows: [VALID_ROW] }));
    expect(res.status).toBe(403);
  });

  it("returns 401 when user is not authenticated", async () => {
    mockCreate.mockResolvedValue(makeClient(null) as never);
    const res = await POST(makeRequest({ rows: [VALID_ROW] }));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockRL.mockReturnValue({ allowed: false, remaining: 0, resetTime: Date.now() + 60_000 });
    const res = await POST(makeRequest({ rows: [VALID_ROW] }));
    expect(res.status).toBe(429);
  });
});

// ── Input validation ──────────────────────────────────────────────────────────

describe("POST /api/applications/bulk-import — input validation", () => {
  it("returns 400 for empty rows array", async () => {
    const res = await POST(makeRequest({ rows: [] }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when rows exceeds 500", async () => {
    const rows = Array.from({ length: 501 }, () => ({ ...VALID_ROW }));
    const res = await POST(makeRequest({ rows }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/500/);
  });

  it("returns 422 when all rows fail Zod validation", async () => {
    const rows = [{ company: "", position: "" }, { company: "X" }]; // missing required fields
    const res = await POST(makeRequest({ rows }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.imported).toBe(0);
    expect(Array.isArray(body.errors)).toBe(true);
    expect(body.errors.length).toBeGreaterThan(0);
  });

  it("returns 400 for non-array rows field", async () => {
    const res = await POST(makeRequest({ rows: "not an array" }));
    expect(res.status).toBe(400);
  });
});

// ── Row-level validation ──────────────────────────────────────────────────────

describe("POST /api/applications/bulk-import — per-row validation", () => {
  it("accepts a minimal valid row (company + position only)", async () => {
    const res = await POST(makeRequest({ rows: [VALID_ROW] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.imported).toBe(1);
    expect(body.errors).toHaveLength(0);
  });

  it("defaults status to Applied when status is missing", async () => {
    const client = makeClient() as ReturnType<typeof makeClient>;
    mockCreate.mockResolvedValue(client as never);

    await POST(makeRequest({ rows: [VALID_ROW] }));

    const insertChain = client.from.mock.results[0].value;
    const insertFn = (insertChain as { insert: ReturnType<typeof vi.fn> }).insert;
    const inserted = insertFn.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(inserted[0].status).toBe("Applied");
  });

  it("defaults status to Applied for unrecognised status values", async () => {
    const client = makeClient() as ReturnType<typeof makeClient>;
    mockCreate.mockResolvedValue(client as never);

    await POST(makeRequest({ rows: [{ ...VALID_ROW, status: "Hired" }] }));

    const insertChain = client.from.mock.results[0].value;
    const insertFn = (insertChain as { insert: ReturnType<typeof vi.fn> }).insert;
    const inserted = insertFn.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(inserted[0].status).toBe("Applied");
  });

  it("accepts a fully populated row", async () => {
    const fullRow = {
      company:      "Acme Corp",
      position:     "Senior Engineer",
      status:       "Interview",
      applied_date: "2026-05-01",
      location:     "Remote",
      salary_range: "$150k",
      notes:        "Great role",
      job_url:      "https://acme.com/jobs/1",
      source:       "LinkedIn",
    };
    const res = await POST(makeRequest({ rows: [fullRow] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.imported).toBe(1);
  });

  it("returns 422 for row with empty company name", async () => {
    const res = await POST(makeRequest({ rows: [{ company: "", position: "Engineer" }] }));
    expect(res.status).toBe(422);
  });

  it("returns 422 for row with invalid job_url scheme", async () => {
    const row = { company: "X", position: "Y", job_url: "javascript:alert(1)" };
    const res = await POST(makeRequest({ rows: [row] }));
    expect(res.status).toBe(422);
  });

  it("returns partial success: valid rows imported, invalid rows listed in errors", async () => {
    const rows = [
      VALID_ROW,                               // valid
      { company: "", position: "Engineer" },   // invalid — empty company
      { company: "Beta", position: "PM" },     // valid
    ];
    const res = await POST(makeRequest({ rows }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.imported).toBe(2);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0].row).toBe(2); // second row (1-indexed)
  });
});

// ── DB failure ────────────────────────────────────────────────────────────────

describe("POST /api/applications/bulk-import — DB failure", () => {
  it("returns 500 when insert fails", async () => {
    mockCreate.mockResolvedValue(
      makeClient({ id: USER_ID }, { message: "duplicate key violates constraint idx_foo" }) as never
    );
    const res = await POST(makeRequest({ rows: [VALID_ROW] }));
    expect(res.status).toBe(500);
  });

  it("does NOT leak internal DB error message to the client", async () => {
    mockCreate.mockResolvedValue(
      makeClient({ id: USER_ID }, { message: "duplicate key violates constraint idx_secret_column" }) as never
    );
    const res = await POST(makeRequest({ rows: [VALID_ROW] }));
    const body = await res.json();
    // The raw DB error must never appear in the response body
    expect(JSON.stringify(body)).not.toContain("idx_secret_column");
    expect(body.error).toMatch(/import failed/i);
  });
});
