/**
 * Unit tests — /api/prep/streak (GET, POST)
 *
 * Covers: auth, CSRF on POST, streak calculation logic, system_design_progress merge.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeChain } from "@/tests/helpers/supabase-mock";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { GET, POST } from "@/app/api/prep/streak/route";
import { createClient } from "@/lib/supabase/server";

const mockCreate = vi.mocked(createClient);
const USER_ID    = "user-streak";

const TODAY     = new Date().toISOString().slice(0, 10);
const YESTERDAY = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); })();
const TWO_DAYS_AGO = (() => { const d = new Date(); d.setDate(d.getDate() - 2); return d.toISOString().slice(0, 10); })();

function makeClient(user: unknown = { id: USER_ID }, existingStreak: unknown = null) {
  const chain = makeChain(
    existingStreak
      ? { data: existingStreak, error: null }
      : { data: null, error: { code: "PGRST116", message: "no rows" } }
  );
  const upsertChain = makeChain({ data: { user_id: USER_ID, current_streak: 1, longest_streak: 1 }, error: null });
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    from: vi.fn().mockReturnValue({ ...chain, upsert: vi.fn().mockReturnValue(upsertChain) }),
  };
}

function postReq(body: unknown, origin?: string): Request {
  return new Request("http://localhost/api/prep/streak", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCreate.mockResolvedValue(makeClient() as never);
});

// ── GET ───────────────────────────────────────────────────────────────────────

describe("GET /api/prep/streak", () => {
  it("returns 401 when not authenticated", async () => {
    mockCreate.mockResolvedValue(makeClient(null) as never);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns default zero streak when no row exists", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.streak.current_streak).toBe(0);
    expect(body.streak.longest_streak).toBe(0);
    expect(body.streak.last_activity_date).toBeNull();
  });

  it("returns existing streak data", async () => {
    const existing = { user_id: USER_ID, current_streak: 5, longest_streak: 10, last_activity_date: TODAY, system_design_progress: {} };
    mockCreate.mockResolvedValue(makeClient({ id: USER_ID }, existing) as never);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.streak.current_streak).toBe(5);
  });
});

// ── POST — CSRF & auth ────────────────────────────────────────────────────────

describe("POST /api/prep/streak — CSRF & auth", () => {
  it("returns 403 for cross-site origin", async () => {
    const res = await POST(postReq({ log_activity: true }, "http://evil.example.com") as never);
    expect(res.status).toBe(403);
  });

  it("returns 401 when not authenticated", async () => {
    mockCreate.mockResolvedValue(makeClient(null) as never);
    const res = await POST(postReq({ log_activity: true }) as never);
    expect(res.status).toBe(401);
  });
});

// ── POST — streak logic ───────────────────────────────────────────────────────

describe("POST /api/prep/streak — streak calculation", () => {
  it("increments streak when last activity was yesterday", async () => {
    const existing = { user_id: USER_ID, current_streak: 3, longest_streak: 3, last_activity_date: YESTERDAY, system_design_progress: {} };
    const upsertChain = makeChain({ data: { user_id: USER_ID, current_streak: 4, longest_streak: 4 }, error: null });
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } }, error: null }) },
      from: vi.fn().mockReturnValue({ ...makeChain({ data: existing, error: null }), upsert: vi.fn().mockReturnValue(upsertChain) }),
    };
    mockCreate.mockResolvedValue(client as never);
    const res = await POST(postReq({ log_activity: true }) as never);
    expect(res.status).toBe(200);
    // upsert was called — streak was updated
    const chain = client.from("prep_streaks");
    expect(chain.upsert).toHaveBeenCalled();
  });

  it("resets streak to 1 when last activity was 2+ days ago", async () => {
    const existing = { user_id: USER_ID, current_streak: 5, longest_streak: 5, last_activity_date: TWO_DAYS_AGO, system_design_progress: {} };
    const upsertChain = makeChain({ data: { user_id: USER_ID, current_streak: 1, longest_streak: 5 }, error: null });
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } }, error: null }) },
      from: vi.fn().mockReturnValue({ ...makeChain({ data: existing, error: null }), upsert: vi.fn().mockReturnValue(upsertChain) }),
    };
    mockCreate.mockResolvedValue(client as never);
    const res = await POST(postReq({ log_activity: true }) as never);
    expect(res.status).toBe(200);
    // Verify reset: current_streak in upsert call should be 1
    const upsertCall = (client.from("prep_streaks").upsert as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(upsertCall.current_streak).toBe(1);
    // longest_streak preserved
    expect(upsertCall.longest_streak).toBe(5);
  });

  it("does not change streak when activity already logged today", async () => {
    const existing = { user_id: USER_ID, current_streak: 7, longest_streak: 7, last_activity_date: TODAY, system_design_progress: {} };
    const upsertChain = makeChain({ data: existing, error: null });
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } }, error: null }) },
      from: vi.fn().mockReturnValue({ ...makeChain({ data: existing, error: null }), upsert: vi.fn().mockReturnValue(upsertChain) }),
    };
    mockCreate.mockResolvedValue(client as never);
    const res = await POST(postReq({ log_activity: true }) as never);
    expect(res.status).toBe(200);
    const upsertCall = (client.from("prep_streaks").upsert as ReturnType<typeof vi.fn>).mock.calls[0][0];
    // Streak unchanged — already logged today
    expect(upsertCall.current_streak).toBe(7);
  });

  it("merges system_design_progress without overwriting existing keys", async () => {
    const existing = {
      user_id: USER_ID, current_streak: 1, longest_streak: 1,
      last_activity_date: TODAY,
      system_design_progress: { "CAP Theorem": "Reading", "CDN": "Comfortable" },
    };
    const upsertChain = makeChain({ data: existing, error: null });
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } }, error: null }) },
      from: vi.fn().mockReturnValue({ ...makeChain({ data: existing, error: null }), upsert: vi.fn().mockReturnValue(upsertChain) }),
    };
    mockCreate.mockResolvedValue(client as never);
    await POST(postReq({ system_design_progress: { "Rate Limiting": "Comfortable" } }) as never);
    const upsertCall = (client.from("prep_streaks").upsert as ReturnType<typeof vi.fn>).mock.calls[0][0];
    // Both old and new keys present
    expect(upsertCall.system_design_progress["CAP Theorem"]).toBe("Reading");
    expect(upsertCall.system_design_progress["CDN"]).toBe("Comfortable");
    expect(upsertCall.system_design_progress["Rate Limiting"]).toBe("Comfortable");
  });

  it("returns 400 when system_design_progress contains invalid status value", async () => {
    const res = await POST(postReq({ system_design_progress: { "CDN": "Expert" } }) as never);
    expect(res.status).toBe(400);
  });
});
