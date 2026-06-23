/**
 * Unit tests — GET /api/export/pdf-report
 *
 * Covers:
 *  - 401 when not authenticated
 *  - 429 when rate limited
 *  - 500 when getDashboardAnalytics fails
 *  - 500 when applications query fails
 *  - 200 application/pdf with correct Content-Disposition on success
 *  - user_id filter applied to the applications query (defence-in-depth)
 *
 * renderToBuffer is mocked — PDF generation is an integration concern.
 * getDashboardAnalytics is mocked at the service boundary.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeChain } from "@/tests/helpers/supabase-mock";

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
  G:           vi.fn(),
  StyleSheet: { create: vi.fn().mockReturnValue({}) },
}));
vi.mock("@/components/pdf/SearchHistoryPDF", () => ({
  SearchHistoryPDF: vi.fn().mockReturnValue(null),
}));
// getDashboardAnalytics is exported via @/services which re-exports analytics.ts
vi.mock("@/services/analytics", () => ({
  getDashboardAnalytics: vi.fn(),
}));

import { GET } from "@/app/api/export/pdf-report/route";
import { createClient }         from "@/lib/supabase/server";
import { checkRateLimit }       from "@/lib/security/rate-limit";
import { getDashboardAnalytics } from "@/services/analytics";

const mockCreate  = vi.mocked(createClient);
const mockRL      = vi.mocked(checkRateLimit);
const mockAnalytics = vi.mocked(getDashboardAnalytics);

const UID = "a0a0a0a0-a0a0-4a0a-8a0a-a0a0a0a0a0a0";

const MOCK_ANALYTICS = {
  totalApplications: 10, thisWeek: 2, thisMonth: 5, responseRate: 20,
  averageTimeToResponse: 14, interviewToOfferRate: 25, ghostRate: 10,
  activePipeline: 2, weeklyMomentum: 10, topSource: null,
  statusDistribution: [], dailyTrends: [], weeklyTrends: [],
  monthlyTrends: [], topCompanies: [], upcomingInterviews: [],
  pendingReminders: [], avgSalaryBySource: [], sourceEffectiveness: [],
  stageFunnel: [], weekdayActivity: [],
};

const MOCK_APPS = [
  { company: "Acme", position: "SWE", status: "Applied", applied_date: "2026-01-01", source: null, salary_range: null },
];

function makeClient(opts: {
  user?: unknown;
  appsData?: unknown;
  appsError?: unknown;
} = {}) {
  const {
    user      = { id: UID, email: "test@example.com", user_metadata: {} },
    appsData  = MOCK_APPS,
    appsError = null,
  } = opts;

  const appsChain = makeChain({ data: appsData, error: appsError });

  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    from: vi.fn().mockReturnValue(appsChain),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRL.mockReturnValue({ allowed: true, remaining: 4, resetAt: Date.now() + 86_400_000 } as never);
  mockAnalytics.mockResolvedValue({ data: MOCK_ANALYTICS as never, error: null });
  mockCreate.mockResolvedValue(makeClient() as never);
});

describe("GET /api/export/pdf-report — authentication", () => {
  it("returns 401 when user is not authenticated", async () => {
    mockCreate.mockResolvedValue(makeClient({ user: null }) as never);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockRL.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 1000 } as never);
    const res = await GET();
    expect(res.status).toBe(429);
  });
});

describe("GET /api/export/pdf-report — error handling", () => {
  it("returns 500 when getDashboardAnalytics fails", async () => {
    mockAnalytics.mockResolvedValue({ data: null, error: "DB error" } as never);
    const res = await GET();
    expect(res.status).toBe(500);
  });

  it("returns 500 when applications query fails", async () => {
    mockCreate.mockResolvedValue(
      makeClient({ appsData: null, appsError: { message: "query failed" } }) as never
    );
    const res = await GET();
    expect(res.status).toBe(500);
  });
});

describe("GET /api/export/pdf-report — success", () => {
  it("returns 200 with application/pdf content-type", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
  });

  it("returns attachment Content-Disposition with .pdf filename", async () => {
    const res = await GET();
    const disposition = res.headers.get("Content-Disposition");
    expect(disposition).toMatch(/attachment/);
    expect(disposition).toMatch(/\.pdf/);
  });

  it("sets Cache-Control: no-store to prevent proxy caching of private data", async () => {
    const res = await GET();
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("applies user_id filter to the applications query (defence-in-depth)", async () => {
    const client = makeClient();
    mockCreate.mockResolvedValue(client as never);

    await GET();

    // The chain's eq method must have been called with "user_id" scoping
    const appsChain = client.from.mock.results[0]?.value as ReturnType<typeof makeChain>;
    expect((appsChain.eq as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith("user_id", UID);
  });

  it("calls getDashboardAnalytics to build analytics section", async () => {
    await GET();
    expect(mockAnalytics).toHaveBeenCalledTimes(1);
  });
});

describe("GET /api/export/pdf-report — rate limiting", () => {
  it("passes user-scoped key to checkRateLimit", async () => {
    await GET();
    expect(mockRL).toHaveBeenCalledWith(
      `pdf-report:${UID}`,
      expect.objectContaining({ maxRequests: 5 })
    );
  });
});
