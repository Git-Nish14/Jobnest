/**
 * Unit tests — getDashboardAnalytics() richer metrics
 *
 * Covers the three new computed analytics fields:
 *   averageTimeToResponse  — avg days from applied_date → updated_at for responded apps
 *   interviewToOfferRate   — (Offer+Accepted) / (Interview+Offer+Accepted) × 100
 *   ghostRate              — Ghosted / totalApplications × 100
 *
 * Each test controls the application fixture set and asserts only the metric
 * under test; other fields from the service are accepted as-is.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { getDashboardAnalytics } from "@/services/analytics";
import { createClient } from "@/lib/supabase/server";

const mockCreate = vi.mocked(createClient);

// ── Helpers ───────────────────────────────────────────────────────────────────

type AppRow = {
  id: string;
  user_id: string;
  company: string;
  position: string;
  status: string;
  applied_date: string;
  updated_at: string;
  created_at: string;
  [key: string]: unknown;
};

function makeApp(overrides: Partial<AppRow> & { status: string }): AppRow {
  const base: AppRow = {
    id: crypto.randomUUID(),
    user_id: "uid-1",
    company: "Acme",
    position: "Engineer",
    status: "Applied",
    applied_date: daysAgo(30),
    updated_at: daysAgo(20),
    created_at: daysAgo(30),
  };
  return { ...base, ...overrides };
}

/** Returns an ISO date string for N days before today */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Returns an ISO datetime string for N days before today */
function datetimeAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

/** Builds a Supabase chain that resolves the query promise with `data` */
function makeChainForApps(apps: AppRow[]) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then: (resolve: (v: { data: AppRow[]; error: null }) => void) =>
      Promise.resolve({ data: apps, error: null }).then(resolve),
  };
  return chain;
}

function makeSupabaseClient(apps: AppRow[]) {
  return {
    from: vi.fn((table: string) => {
      if (table === "job_applications") return makeChainForApps(apps);
      // interviews and reminders return empty arrays for simplicity
      return makeChainForApps([]);
    }),
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

// ── averageTimeToResponse ─────────────────────────────────────────────────────

describe("getDashboardAnalytics — averageTimeToResponse", () => {
  it("returns null when fewer than 2 apps have a responded status", async () => {
    const apps = [
      makeApp({ status: "Applied" }),
      makeApp({ status: "Phone Screen", applied_date: daysAgo(20), updated_at: datetimeAgo(10) }),
    ];
    mockCreate.mockResolvedValue(makeSupabaseClient(apps) as never);
    const { data } = await getDashboardAnalytics();
    // Only 1 responded app — below the ≥2 threshold
    expect(data?.averageTimeToResponse).toBeNull();
  });

  it("computes average days when ≥2 apps have responded statuses", async () => {
    // App A: 10-day response, App B: 20-day response → avg 15
    const apps = [
      makeApp({ status: "Phone Screen", applied_date: daysAgo(30), updated_at: datetimeAgo(20) }),
      makeApp({ status: "Rejected",     applied_date: daysAgo(40), updated_at: datetimeAgo(20) }),
      makeApp({ status: "Applied" }),
    ];
    mockCreate.mockResolvedValue(makeSupabaseClient(apps) as never);
    const { data } = await getDashboardAnalytics();
    // App A: 30−20 = 10 days, App B: 40−20 = 20 days → avg 15
    expect(data?.averageTimeToResponse).toBe(15);
  });

  it("includes all responded status variants in the computation", async () => {
    // Every app: applied 10 days ago, updated 5 days ago → 5-day response each → avg 5
    const apps = [
      makeApp({ status: "Phone Screen", applied_date: daysAgo(10), updated_at: datetimeAgo(5) }),
      makeApp({ status: "Interview",    applied_date: daysAgo(10), updated_at: datetimeAgo(5) }),
      makeApp({ status: "Offer",        applied_date: daysAgo(10), updated_at: datetimeAgo(5) }),
      makeApp({ status: "Accepted",     applied_date: daysAgo(10), updated_at: datetimeAgo(5) }),
      makeApp({ status: "Rejected",     applied_date: daysAgo(10), updated_at: datetimeAgo(5) }),
    ];
    mockCreate.mockResolvedValue(makeSupabaseClient(apps) as never);
    const { data } = await getDashboardAnalytics();
    expect(data?.averageTimeToResponse).toBe(5);
  });

  it("excludes Ghosted apps from the response-time average", async () => {
    const apps = [
      makeApp({ status: "Ghosted",      applied_date: daysAgo(90), updated_at: datetimeAgo(5) }),
      makeApp({ status: "Phone Screen", applied_date: daysAgo(10), updated_at: datetimeAgo(5) }),
      makeApp({ status: "Rejected",     applied_date: daysAgo(20), updated_at: datetimeAgo(10) }),
    ];
    mockCreate.mockResolvedValue(makeSupabaseClient(apps) as never);
    const { data } = await getDashboardAnalytics();
    // Ghosted excluded → only Phone Screen (5d) + Rejected (10d) = avg 7–8
    expect(data?.averageTimeToResponse).toBeGreaterThan(0);
    expect(data?.averageTimeToResponse).toBeLessThan(20);
  });

  it("excludes apps where updated_at equals applied_date (same-day edits)", async () => {
    const today = daysAgo(0);
    const apps = [
      // same-day edit: 0 days → excluded
      makeApp({ status: "Rejected", applied_date: today, updated_at: new Date().toISOString() }),
      makeApp({ status: "Phone Screen", applied_date: daysAgo(10), updated_at: datetimeAgo(5) }),
      makeApp({ status: "Interview",    applied_date: daysAgo(20), updated_at: datetimeAgo(10) }),
    ];
    mockCreate.mockResolvedValue(makeSupabaseClient(apps) as never);
    const { data } = await getDashboardAnalytics();
    // Only the two valid apps count: 5d + 10d = avg 7–8
    expect(data?.averageTimeToResponse).toBeGreaterThan(0);
    expect(data?.averageTimeToResponse).toBeLessThanOrEqual(10);
  });

  it("caps individual response times at 90 days to exclude late-edit outliers", async () => {
    const apps = [
      // Outlier: 120-day gap (user edited notes months after applying — updated_at drifted)
      makeApp({ status: "Rejected", applied_date: daysAgo(120), updated_at: datetimeAgo(0) }),
      makeApp({ status: "Phone Screen", applied_date: daysAgo(10), updated_at: datetimeAgo(5) }),
      makeApp({ status: "Interview",    applied_date: daysAgo(10), updated_at: datetimeAgo(5) }),
    ];
    mockCreate.mockResolvedValue(makeSupabaseClient(apps) as never);
    const { data } = await getDashboardAnalytics();
    // The 120-day outlier exceeds the 90-day cap so it is excluded entirely.
    // Only the two 5-day apps count → avg 5.
    expect(data?.averageTimeToResponse).toBe(5);
  });
});

// ── interviewToOfferRate ──────────────────────────────────────────────────────

describe("getDashboardAnalytics — interviewToOfferRate", () => {
  it("returns null when fewer than 3 apps have reached interview stage", async () => {
    const apps = [
      makeApp({ status: "Interview" }),
      makeApp({ status: "Offer" }),
      makeApp({ status: "Applied" }),
    ];
    mockCreate.mockResolvedValue(makeSupabaseClient(apps) as never);
    const { data } = await getDashboardAnalytics();
    // Interview(1) + Offer(1) = 2 → below threshold of 3
    expect(data?.interviewToOfferRate).toBeNull();
  });

  it("returns 0% when nobody reached offer stage yet", async () => {
    const apps = [
      makeApp({ status: "Interview" }),
      makeApp({ status: "Interview" }),
      makeApp({ status: "Interview" }),
    ];
    mockCreate.mockResolvedValue(makeSupabaseClient(apps) as never);
    const { data } = await getDashboardAnalytics();
    expect(data?.interviewToOfferRate).toBe(0);
  });

  it("computes correctly for 1 offer out of 4 interviews", async () => {
    const apps = [
      makeApp({ status: "Interview" }),
      makeApp({ status: "Interview" }),
      makeApp({ status: "Interview" }),
      makeApp({ status: "Offer" }),
    ];
    mockCreate.mockResolvedValue(makeSupabaseClient(apps) as never);
    const { data } = await getDashboardAnalytics();
    // 1 offer / 4 total-at-interview = 25%
    expect(data?.interviewToOfferRate).toBe(25);
  });

  it("counts Accepted status as an offer in the numerator", async () => {
    const apps = [
      makeApp({ status: "Interview" }),
      makeApp({ status: "Interview" }),
      makeApp({ status: "Offer" }),
      makeApp({ status: "Accepted" }),
    ];
    mockCreate.mockResolvedValue(makeSupabaseClient(apps) as never);
    const { data } = await getDashboardAnalytics();
    // (Offer + Accepted) = 2, denominator = 4 → 50%
    expect(data?.interviewToOfferRate).toBe(50);
  });

  it("returns 100% when all interviews led to offers", async () => {
    const apps = [
      makeApp({ status: "Offer" }),
      makeApp({ status: "Offer" }),
      makeApp({ status: "Accepted" }),
    ];
    mockCreate.mockResolvedValue(makeSupabaseClient(apps) as never);
    const { data } = await getDashboardAnalytics();
    expect(data?.interviewToOfferRate).toBe(100);
  });

  it("ignores non-interview-stage statuses in the denominator", async () => {
    const apps = [
      makeApp({ status: "Applied" }),
      makeApp({ status: "Rejected" }),
      makeApp({ status: "Interview" }),
      makeApp({ status: "Interview" }),
      makeApp({ status: "Offer" }),
    ];
    mockCreate.mockResolvedValue(makeSupabaseClient(apps) as never);
    const { data } = await getDashboardAnalytics();
    // denominator = Interview(2) + Offer(1) = 3; numerator = Offer(1) → 33%
    expect(data?.interviewToOfferRate).toBe(33);
  });
});

// ── ghostRate ─────────────────────────────────────────────────────────────────

describe("getDashboardAnalytics — ghostRate", () => {
  it("returns null when fewer than 5 total applications exist", async () => {
    const apps = [
      makeApp({ status: "Applied" }),
      makeApp({ status: "Ghosted" }),
      makeApp({ status: "Applied" }),
    ];
    mockCreate.mockResolvedValue(makeSupabaseClient(apps) as never);
    const { data } = await getDashboardAnalytics();
    expect(data?.ghostRate).toBeNull();
  });

  it("returns 0% when no applications are ghosted", async () => {
    const apps = Array.from({ length: 6 }, () => makeApp({ status: "Applied" }));
    mockCreate.mockResolvedValue(makeSupabaseClient(apps) as never);
    const { data } = await getDashboardAnalytics();
    expect(data?.ghostRate).toBe(0);
  });

  it("computes ghostRate as percentage of total applications", async () => {
    const apps = [
      makeApp({ status: "Applied" }),
      makeApp({ status: "Applied" }),
      makeApp({ status: "Applied" }),
      makeApp({ status: "Ghosted" }),
      makeApp({ status: "Ghosted" }),
    ];
    mockCreate.mockResolvedValue(makeSupabaseClient(apps) as never);
    const { data } = await getDashboardAnalytics();
    // 2 ghosted / 5 total = 40%
    expect(data?.ghostRate).toBe(40);
  });

  it("returns 100% when all applications are ghosted", async () => {
    const apps = Array.from({ length: 5 }, () => makeApp({ status: "Ghosted" }));
    mockCreate.mockResolvedValue(makeSupabaseClient(apps) as never);
    const { data } = await getDashboardAnalytics();
    expect(data?.ghostRate).toBe(100);
  });
});
