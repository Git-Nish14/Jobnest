import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeChain } from "@/tests/helpers/supabase-mock";

// ── Mocks must be hoisted before any imports that reference them ──────────────
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/features/ai-usage", () => ({
  TOKEN_CAPS: { free: 100_000, pro: 2_000_000 },
  getUsageHistory: vi.fn(),
}));

import { GET } from "@/app/api/nesta-ai/analytics/route";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getUsageHistory } from "@/lib/features/ai-usage";

const mockCreate  = vi.mocked(createClient);
const mockCheckRL = vi.mocked(checkRateLimit);
const mockHistory = vi.mocked(getUsageHistory);

const USER_ID = "user-aaaa-1111-0000-0000-000000000000";
const TODAY   = new Date().toISOString().slice(0, 10);

const USAGE_ROWS = [
  { date: TODAY,   feature: "chat",         input_tokens: 2000, output_tokens: 800,  request_count: 2, model: "llama-3.3-70b-versatile" },
  { date: TODAY,   feature: "resume_audit", input_tokens: 3000, output_tokens: 1500, request_count: 1, model: "llama-3.3-70b-versatile" },
];

function makeClient(user: unknown, sub: unknown = null) {
  const subChain = makeChain({ data: sub, error: null });
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    from: vi.fn().mockReturnValue(subChain),
  };
}

function req() {
  return new Request("http://localhost/api/nesta-ai/analytics", { method: "GET" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRL.mockReturnValue({ allowed: true, remaining: 29, resetTime: Date.now() + 60_000 });
  mockCreate.mockResolvedValue(makeClient({ id: USER_ID }) as never);
  mockHistory.mockResolvedValue([]);
});

// ── Auth guard ────────────────────────────────────────────────────────────────

describe("GET /api/nesta-ai/analytics — auth guard", () => {
  it("returns 401 when not authenticated", async () => {
    mockCreate.mockResolvedValue(makeClient(null) as never);
    const res = await GET(req() as never);
    expect(res.status).toBe(401);
  });
});

// ── Rate limit ────────────────────────────────────────────────────────────────

describe("GET /api/nesta-ai/analytics — rate limit", () => {
  it("returns 429 when rate limited", async () => {
    mockCheckRL.mockReturnValue({ allowed: false, remaining: 0, resetTime: Date.now() + 60_000 });
    const res = await GET(req() as never);
    expect(res.status).toBe(429);
  });
});

// ── Response shape ────────────────────────────────────────────────────────────

describe("GET /api/nesta-ai/analytics — response shape", () => {
  it("returns correct top-level keys", async () => {
    const res = await GET(req() as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("plan");
    expect(body).toHaveProperty("today");
    expect(body).toHaveProperty("cap");
    expect(body).toHaveProperty("totals");
    expect(body).toHaveProperty("byFeature");
    expect(body).toHaveProperty("dailyChart");
  });

  it("returns plan=free for user with no subscription", async () => {
    const res = await GET(req() as never);
    const body = await res.json();
    expect(body.plan).toBe("free");
    expect(body.cap.daily).toBe(100_000);
  });

  it("returns plan=pro and higher cap for pro subscriber", async () => {
    mockCreate.mockResolvedValue(
      makeClient({ id: USER_ID }, { plan: "pro", status: "active" }) as never,
    );
    const res = await GET(req() as never);
    const body = await res.json();
    expect(body.plan).toBe("pro");
    expect(body.cap.daily).toBe(2_000_000);
  });

  it("returns zero usage when no rows exist", async () => {
    const res = await GET(req() as never);
    const body = await res.json();
    expect(body.today.tokens).toBe(0);
    expect(body.today.requests).toBe(0);
    expect(body.totals.tokens).toBe(0);
  });
});

// ── Token aggregation ─────────────────────────────────────────────────────────

describe("GET /api/nesta-ai/analytics — aggregation", () => {
  beforeEach(() => {
    mockHistory.mockResolvedValue(USAGE_ROWS);
  });

  it("aggregates today tokens correctly", async () => {
    const res = await GET(req() as never);
    const body = await res.json();
    // 2000+800 + 3000+1500 = 7300
    expect(body.today.tokens).toBe(7300);
    expect(body.today.requests).toBe(3);
  });

  it("cap.used matches today tokens", async () => {
    const res = await GET(req() as never);
    const body = await res.json();
    expect(body.cap.used).toBe(body.today.tokens);
    expect(body.cap.remaining).toBe(body.cap.daily - body.today.tokens);
  });

  it("splits usage into byFeature correctly", async () => {
    const res = await GET(req() as never);
    const body = await res.json();
    expect(body.byFeature.chat.tokens).toBe(2800);
    expect(body.byFeature.chat.requests).toBe(2);
    expect(body.byFeature.resume_audit.tokens).toBe(4500);
    expect(body.byFeature.resume_audit.requests).toBe(1);
  });

  it("dailyChart has 14 entries covering the last 14 days", async () => {
    const res = await GET(req() as never);
    const body = await res.json();
    expect(body.dailyChart).toHaveLength(14);
    // Last entry is today
    const last = body.dailyChart[body.dailyChart.length - 1];
    expect(last.date).toBe(TODAY);
    expect(last.tokens).toBe(7300);
  });

  it("remaining is clamped to 0 when over cap", async () => {
    // Simulate usage exceeding the free cap
    const overCapRows = [
      { date: TODAY, feature: "chat", input_tokens: 80_000, output_tokens: 30_000, request_count: 50, model: null },
    ];
    mockHistory.mockResolvedValue(overCapRows);
    const res = await GET(req() as never);
    const body = await res.json();
    expect(body.cap.remaining).toBe(0);
  });
});
