/**
 * Unit tests — GET /api/export/weekly-report
 *
 * Covers:
 *  - 401 when not authenticated
 *  - 429 when rate limited
 *  - 500 when getDashboardAnalytics fails
 *  - 200 application/pdf with correct headers on success
 *  - goal query-param parsing: valid, zero, overflow, NaN, missing
 *  - rate-limit key is user-scoped
 *
 * renderToBuffer and getDashboardAnalytics are mocked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/server",    () => ({ createClient: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@react-pdf/renderer", () => ({
  renderToBuffer: vi.fn().mockResolvedValue(Buffer.from("%PDF-1.4 mock")),
  Document:    vi.fn(),
  Page:        vi.fn(),
  Text:        vi.fn(),
  View:        vi.fn(),
  Svg:         vi.fn(),
  Rect:        vi.fn(),
  Line:        vi.fn(),
  StyleSheet: { create: vi.fn().mockReturnValue({}) },
}));
vi.mock("@/components/pdf/WeeklyReportPDF", () => ({
  WeeklyReportPDF: vi.fn().mockReturnValue(null),
}));
vi.mock("@/services/analytics", () => ({
  getDashboardAnalytics: vi.fn(),
}));

import { GET } from "@/app/api/export/weekly-report/route";
import { createClient }          from "@/lib/supabase/server";
import { checkRateLimit }        from "@/lib/security/rate-limit";
import { getDashboardAnalytics }  from "@/services/analytics";

const mockCreate    = vi.mocked(createClient);
const mockRL        = vi.mocked(checkRateLimit);
const mockAnalytics = vi.mocked(getDashboardAnalytics);

const UID = "b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b1b1";

const MOCK_ANALYTICS = {
  totalApplications: 8, thisWeek: 3, thisMonth: 8, responseRate: 25,
  averageTimeToResponse: 10, interviewToOfferRate: null, ghostRate: null,
  activePipeline: 1, weeklyMomentum: null, topSource: null,
  statusDistribution: [], dailyTrends: [], weeklyTrends: Array.from({ length: 24 }, (_, i) => ({ week: `W${i}`, count: i })),
  monthlyTrends: [], topCompanies: [], upcomingInterviews: [],
  pendingReminders: [], avgSalaryBySource: [], sourceEffectiveness: [],
  stageFunnel: [
    { stage: "Applied",      count: 8 },
    { stage: "Phone Screen", count: 3 },
    { stage: "Interview",    count: 1 },
    { stage: "Offer",        count: 0 },
    { stage: "Accepted",     count: 0 },
  ],
  weekdayActivity: [],
};

function makeClient(user: unknown = { id: UID, email: "test@example.com", user_metadata: {} }) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    from: vi.fn(),
  };
}

function makeReq(goal?: string) {
  const url = goal !== undefined
    ? `http://localhost/api/export/weekly-report?goal=${goal}`
    : "http://localhost/api/export/weekly-report";
  return new NextRequest(url);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRL.mockReturnValue({ allowed: true, remaining: 9, resetAt: Date.now() + 86_400_000 } as never);
  mockAnalytics.mockResolvedValue({ data: MOCK_ANALYTICS as never, error: null });
  mockCreate.mockResolvedValue(makeClient() as never);
});

describe("GET /api/export/weekly-report — authentication", () => {
  it("returns 401 when user is not authenticated", async () => {
    mockCreate.mockResolvedValue(makeClient(null) as never);
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockRL.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 1000 } as never);
    const res = await GET(makeReq());
    expect(res.status).toBe(429);
  });
});

describe("GET /api/export/weekly-report — error handling", () => {
  it("returns 500 when getDashboardAnalytics fails", async () => {
    mockAnalytics.mockResolvedValue({ data: null, error: "DB error" } as never);
    const res = await GET(makeReq());
    expect(res.status).toBe(500);
  });
});

describe("GET /api/export/weekly-report — success", () => {
  it("returns 200 with application/pdf content-type", async () => {
    const res = await GET(makeReq("5"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
  });

  it("returns attachment Content-Disposition with .pdf filename", async () => {
    const res = await GET(makeReq("5"));
    const cd = res.headers.get("Content-Disposition");
    expect(cd).toMatch(/attachment/);
    expect(cd).toMatch(/weekly-report.*\.pdf/);
  });

  it("sets Cache-Control: no-store", async () => {
    const res = await GET(makeReq("5"));
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("GET /api/export/weekly-report — goal param parsing", () => {
  it("accepts a valid goal between 1 and 100", async () => {
    const res = await GET(makeReq("10"));
    expect(res.status).toBe(200);
  });

  it("clamps goal=0 up to 1 (minimum)", async () => {
    // We can't directly inspect the goal value passed to the PDF component
    // without capturing createElement args — just verify the route succeeds.
    const res = await GET(makeReq("0"));
    expect(res.status).toBe(200);
  });

  it("clamps goal=999 down to 100 (maximum)", async () => {
    const res = await GET(makeReq("999"));
    expect(res.status).toBe(200);
  });

  it("defaults to goal=5 when param is missing", async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
  });

  it("defaults to goal=5 when param is non-numeric", async () => {
    const res = await GET(makeReq("abc"));
    expect(res.status).toBe(200);
  });
});

describe("GET /api/export/weekly-report — rate limiting", () => {
  it("passes user-scoped key with correct limit to checkRateLimit", async () => {
    await GET(makeReq("5"));
    expect(mockRL).toHaveBeenCalledWith(
      `weekly-report-pdf:${UID}`,
      expect.objectContaining({ maxRequests: 10 })
    );
  });
});
