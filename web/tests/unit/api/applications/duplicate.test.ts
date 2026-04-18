/**
 * Unit tests — POST /api/applications/[id]/duplicate
 *
 * Covers:
 *   - Origin check → 403
 *   - Auth check → 401
 *   - Rate limit → 429
 *   - Application not found (wrong user / bad id) → 404
 *   - Supabase insert failure → 500
 *   - Happy path → 201 with new id, correct fields copied, status reset to Applied
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeChain } from "@/tests/helpers/supabase-mock";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: vi.fn() }));

import { POST } from "@/app/api/applications/[id]/duplicate/route";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";

const mockRL     = vi.mocked(checkRateLimit);
const mockCreate = vi.mocked(createClient);

const USER_ID  = "user-uuid-0001";
const APP_ID   = "app-uuid-0001";
const NEW_ID   = "app-uuid-0002";

const ORIGINAL = {
  company:         "Acme Corp",
  position:        "Senior Engineer",
  job_id:          "JD-99",
  job_url:         "https://acme.com/jobs/99",
  salary_range:    "$140k–$160k",
  location:        "Remote",
  notes:           "Great team",
  job_description: "Build scalable systems.",
  source:          "LinkedIn",
};

function makeClient(user: unknown = { id: USER_ID }, fetchResult = { data: ORIGINAL, error: null }, insertResult = { data: { id: NEW_ID }, error: null }) {
  const fetchChain  = makeChain(fetchResult);
  const insertChain = makeChain(insertResult);
  // insert chain: .insert({}).select("id").single()
  // makeChain already chains .insert().select().single() correctly

  const from = vi.fn()
    .mockReturnValueOnce(fetchChain)   // first call: fetch original
    .mockReturnValueOnce(insertChain); // second call: insert duplicate

  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    from,
  };
}

/** POST without Origin header — verifyOrigin passes (same-origin) */
function postRequest(appId = APP_ID): Request {
  return new Request(`http://localhost/api/applications/${appId}/duplicate`, {
    method: "POST",
  });
}

/** POST with a cross-site Origin — verifyOrigin returns false → 403 */
function crossOriginRequest(): Request {
  return new Request(`http://localhost/api/applications/${APP_ID}/duplicate`, {
    method: "POST",
    headers: { Origin: "http://evil.example.com" },
  });
}

const paramsFor = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.resetAllMocks();
  mockRL.mockReturnValue({ allowed: true, remaining: 19, resetTime: Date.now() + 60_000 });
  mockCreate.mockResolvedValue(makeClient() as never);
});

// ── Auth & gates ─────────────────────────────────────────────────────────────

describe("POST /api/applications/[id]/duplicate — gates", () => {
  it("returns 403 for cross-site origin", async () => {
    const res = await POST(crossOriginRequest() as never, paramsFor(APP_ID));
    expect(res.status).toBe(403);
  });

  it("returns 401 when not authenticated", async () => {
    mockCreate.mockResolvedValue(makeClient(null) as never);
    const res = await POST(postRequest() as never, paramsFor(APP_ID));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockRL.mockReturnValue({ allowed: false, remaining: 0, resetTime: Date.now() + 60_000 });
    const res = await POST(postRequest() as never, paramsFor(APP_ID));
    expect(res.status).toBe(429);
  });
});

// ── Application lookup ───────────────────────────────────────────────────────

describe("POST /api/applications/[id]/duplicate — lookup", () => {
  it("returns 404 when application is not found (wrong user or bad id)", async () => {
    mockCreate.mockResolvedValue(
      makeClient({ id: USER_ID }, { data: null, error: { message: "not found" } }) as never
    );
    const res = await POST(postRequest() as never, paramsFor(APP_ID));
    expect(res.status).toBe(404);
  });
});

// ── Insert failure ───────────────────────────────────────────────────────────

describe("POST /api/applications/[id]/duplicate — insert failure", () => {
  it("returns 500 when Supabase insert fails", async () => {
    mockCreate.mockResolvedValue(
      makeClient(
        { id: USER_ID },
        { data: ORIGINAL, error: null },
        { data: null, error: { message: "insert failed" } }
      ) as never
    );
    const res = await POST(postRequest() as never, paramsFor(APP_ID));
    expect(res.status).toBe(500);
  });
});

// ── Happy path ───────────────────────────────────────────────────────────────

describe("POST /api/applications/[id]/duplicate — success", () => {
  it("returns 201 with the new application id", async () => {
    const res = await POST(postRequest() as never, paramsFor(APP_ID));
    expect(res.status).toBe(201);
    const body = await res.json() as { id: string };
    expect(body.id).toBe(NEW_ID);
  });

  it("sets status to 'Applied' and applied_date to today regardless of original", async () => {
    const client = makeClient() as ReturnType<typeof makeClient>;
    mockCreate.mockResolvedValue(client as never);

    await POST(postRequest() as never, paramsFor(APP_ID));

    // The second `from` call is the insert
    const insertChainFrom = client.from.mock.results[1].value as ReturnType<typeof makeChain>;
    const insertFn = (insertChainFrom as unknown as { insert: ReturnType<typeof vi.fn> }).insert;
    expect(insertFn).toHaveBeenCalledOnce();

    const insertedRow = insertFn.mock.calls[0][0] as Record<string, unknown>;
    expect(insertedRow.status).toBe("Applied");
    expect(insertedRow.applied_date).toBe(new Date().toISOString().slice(0, 10));
    expect(insertedRow.user_id).toBe(USER_ID);
  });

  it("copies all non-status fields from the original application", async () => {
    const client = makeClient() as ReturnType<typeof makeClient>;
    mockCreate.mockResolvedValue(client as never);

    await POST(postRequest() as never, paramsFor(APP_ID));

    const insertChainFrom = client.from.mock.results[1].value as ReturnType<typeof makeChain>;
    const insertFn = (insertChainFrom as unknown as { insert: ReturnType<typeof vi.fn> }).insert;
    const insertedRow = insertFn.mock.calls[0][0] as Record<string, unknown>;

    expect(insertedRow.company).toBe(ORIGINAL.company);
    expect(insertedRow.position).toBe(ORIGINAL.position);
    expect(insertedRow.job_url).toBe(ORIGINAL.job_url);
    expect(insertedRow.salary_range).toBe(ORIGINAL.salary_range);
    expect(insertedRow.location).toBe(ORIGINAL.location);
    expect(insertedRow.notes).toBe(ORIGINAL.notes);
    expect(insertedRow.job_description).toBe(ORIGINAL.job_description);
    expect(insertedRow.source).toBe(ORIGINAL.source);
  });

  it("filters fetch by both id and user_id to prevent IDOR", async () => {
    const client = makeClient() as ReturnType<typeof makeClient>;
    mockCreate.mockResolvedValue(client as never);

    await POST(postRequest() as never, paramsFor(APP_ID));

    const fetchChain = client.from.mock.results[0].value as ReturnType<typeof makeChain>;
    const eqFn = (fetchChain as unknown as { eq: ReturnType<typeof vi.fn> }).eq;

    // Both .eq("id", APP_ID) and .eq("user_id", USER_ID) must have been called
    const eqCalls = eqFn.mock.calls as [string, string][];
    expect(eqCalls.some(([k, v]) => k === "id"      && v === APP_ID)).toBe(true);
    expect(eqCalls.some(([k, v]) => k === "user_id" && v === USER_ID)).toBe(true);
  });
});
