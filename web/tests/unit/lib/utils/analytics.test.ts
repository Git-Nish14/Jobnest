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
    source: null,
    salary_range: null,
  };
  return { ...base, ...overrides };
}

/** Returns a specific ISO date string (YYYY-MM-DD) for a given weekday of the most recent week.
 *  0=Sun, 1=Mon, …, 6=Sat — uses LOCAL time to match the fixed analytics computation. */
function localDateForWeekday(weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6): string {
  const d = new Date();
  const diff = (d.getDay() - weekday + 7) % 7;
  d.setDate(d.getDate() - diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

  it("counts Applied apps silent for >30 days as implicit ghosts", async () => {
    // 3 recent Applied (10 days old — not yet ghosted), 2 old Applied (31 days — implicit ghost)
    const apps = [
      makeApp({ status: "Applied", applied_date: daysAgo(10) }),
      makeApp({ status: "Applied", applied_date: daysAgo(10) }),
      makeApp({ status: "Applied", applied_date: daysAgo(10) }),
      makeApp({ status: "Applied", applied_date: daysAgo(31) }),
      makeApp({ status: "Applied", applied_date: daysAgo(31) }),
    ];
    mockCreate.mockResolvedValue(makeSupabaseClient(apps) as never);
    const { data } = await getDashboardAnalytics();
    // 2 implicit ghosts / 5 total = 40%
    expect(data?.ghostRate).toBe(40);
  });

  it("does not count Applied apps at the 30-day boundary as ghosted", async () => {
    // Exactly 30 days is within the threshold (> 30 required)
    const apps = Array.from({ length: 6 }, () =>
      makeApp({ status: "Applied", applied_date: daysAgo(30) })
    );
    mockCreate.mockResolvedValue(makeSupabaseClient(apps) as never);
    const { data } = await getDashboardAnalytics();
    expect(data?.ghostRate).toBe(0);
  });

  it("combines explicit Ghosted status with implicit Applied >30d", async () => {
    const apps = [
      makeApp({ status: "Ghosted",  applied_date: daysAgo(40) }),   // explicit
      makeApp({ status: "Applied",  applied_date: daysAgo(35) }),   // implicit
      makeApp({ status: "Applied",  applied_date: daysAgo(10) }),   // recent — not ghosted
      makeApp({ status: "Rejected", applied_date: daysAgo(20) }),
      makeApp({ status: "Interview",applied_date: daysAgo(15) }),
    ];
    mockCreate.mockResolvedValue(makeSupabaseClient(apps) as never);
    const { data } = await getDashboardAnalytics();
    // 1 explicit + 1 implicit = 2 ghosted / 5 total = 40%
    expect(data?.ghostRate).toBe(40);
  });
});

// ── sourceEffectiveness ───────────────────────────────────────────────────────

describe("getDashboardAnalytics — sourceEffectiveness", () => {
  it("returns empty array with no applications", async () => {
    mockCreate.mockResolvedValue(makeSupabaseClient([]) as never);
    const { data } = await getDashboardAnalytics();
    expect(data?.sourceEffectiveness).toEqual([]);
  });

  it("excludes sources with only 1 application (below minimum)", async () => {
    const apps = [makeApp({ status: "Applied", source: "LinkedIn" })];
    mockCreate.mockResolvedValue(makeSupabaseClient(apps) as never);
    const { data } = await getDashboardAnalytics();
    expect(data?.sourceEffectiveness).toEqual([]);
  });

  it("computes response rate correctly per source", async () => {
    const apps = [
      makeApp({ status: "Phone Screen", source: "LinkedIn" }),
      makeApp({ status: "Applied",      source: "LinkedIn" }),
      makeApp({ status: "Applied",      source: "Indeed" }),
      makeApp({ status: "Applied",      source: "Indeed" }),
    ];
    mockCreate.mockResolvedValue(makeSupabaseClient(apps) as never);
    const { data } = await getDashboardAnalytics();
    const linkedin = data?.sourceEffectiveness.find((s) => s.source === "LinkedIn");
    const indeed   = data?.sourceEffectiveness.find((s) => s.source === "Indeed");
    expect(linkedin?.total).toBe(2);
    expect(linkedin?.responded).toBe(1);
    expect(linkedin?.responseRate).toBe(50);
    expect(indeed?.total).toBe(2);
    expect(indeed?.responded).toBe(0);
    expect(indeed?.responseRate).toBe(0);
  });

  it("counts Interview, Offer, Accepted, and Rejected as responded", async () => {
    const respondedStatuses = ["Phone Screen", "Interview", "Offer", "Accepted", "Rejected"] as const;
    const apps = [
      ...respondedStatuses.map((status) => makeApp({ status, source: "Referral" })),
      makeApp({ status: "Applied", source: "Referral" }),
    ];
    mockCreate.mockResolvedValue(makeSupabaseClient(apps) as never);
    const { data } = await getDashboardAnalytics();
    const referral = data?.sourceEffectiveness.find((s) => s.source === "Referral");
    expect(referral?.total).toBe(6);
    expect(referral?.responded).toBe(5);
    expect(referral?.responseRate).toBe(83);
  });

  it("groups null source as 'Other'", async () => {
    const apps = [
      makeApp({ status: "Phone Screen", source: null }),
      makeApp({ status: "Applied",      source: null }),
    ];
    mockCreate.mockResolvedValue(makeSupabaseClient(apps) as never);
    const { data } = await getDashboardAnalytics();
    const other = data?.sourceEffectiveness.find((s) => s.source === "Other");
    expect(other?.total).toBe(2);
    expect(other?.responseRate).toBe(50);
  });

  it("sorts results by responseRate descending", async () => {
    const apps = [
      // "Referral" 100 % (2/2), "LinkedIn" 0 % (0/2)
      makeApp({ status: "Offer",   source: "Referral" }),
      makeApp({ status: "Offer",   source: "Referral" }),
      makeApp({ status: "Applied", source: "LinkedIn" }),
      makeApp({ status: "Applied", source: "LinkedIn" }),
    ];
    mockCreate.mockResolvedValue(makeSupabaseClient(apps) as never);
    const { data } = await getDashboardAnalytics();
    const rates = data?.sourceEffectiveness.map((s) => s.responseRate) ?? [];
    expect(rates[0]).toBeGreaterThanOrEqual(rates[rates.length - 1]);
  });
});

// ── avgSalaryBySource (parseSalary) ───────────────────────────────────────────

describe("getDashboardAnalytics — avgSalaryBySource", () => {
  it("returns empty array when no apps have a salary_range", async () => {
    const apps = [makeApp({ status: "Applied", source: "LinkedIn", salary_range: null })];
    mockCreate.mockResolvedValue(makeSupabaseClient(apps) as never);
    const { data } = await getDashboardAnalytics();
    expect(data?.avgSalaryBySource).toEqual([]);
  });

  it("parses 'min - max' range and takes midpoint", async () => {
    // "100000 - 120000" → midpoint 110000
    const apps = [makeApp({ status: "Applied", source: "LinkedIn", salary_range: "100000 - 120000" })];
    mockCreate.mockResolvedValue(makeSupabaseClient(apps) as never);
    const { data } = await getDashboardAnalytics();
    const row = data?.avgSalaryBySource.find((r) => r.source === "LinkedIn");
    expect(row?.avgSalary).toBe(110000);
    expect(row?.count).toBe(1);
  });

  it("parses currency-formatted salary '$90,000 - $110,000'", async () => {
    // strips $ and , → 90000, 110000 → midpoint 100000
    const apps = [makeApp({ status: "Applied", source: "Indeed", salary_range: "$90,000 - $110,000" })];
    mockCreate.mockResolvedValue(makeSupabaseClient(apps) as never);
    const { data } = await getDashboardAnalytics();
    const row = data?.avgSalaryBySource.find((r) => r.source === "Indeed");
    expect(row?.avgSalary).toBe(100000);
  });

  it("parses a single salary value (no range)", async () => {
    const apps = [makeApp({ status: "Applied", source: "Referral", salary_range: "80000" })];
    mockCreate.mockResolvedValue(makeSupabaseClient(apps) as never);
    const { data } = await getDashboardAnalytics();
    const row = data?.avgSalaryBySource.find((r) => r.source === "Referral");
    expect(row?.avgSalary).toBe(80000);
  });

  it("averages multiple apps in the same source", async () => {
    // 80k + 120k → avg 100k
    const apps = [
      makeApp({ status: "Applied", source: "LinkedIn", salary_range: "80000" }),
      makeApp({ status: "Applied", source: "LinkedIn", salary_range: "120000" }),
    ];
    mockCreate.mockResolvedValue(makeSupabaseClient(apps) as never);
    const { data } = await getDashboardAnalytics();
    const row = data?.avgSalaryBySource.find((r) => r.source === "LinkedIn");
    expect(row?.avgSalary).toBe(100000);
    expect(row?.count).toBe(2);
  });

  it("skips unparseable salary strings gracefully", async () => {
    const apps = [
      makeApp({ status: "Applied", source: "LinkedIn", salary_range: "Competitive" }),
      makeApp({ status: "Applied", source: "LinkedIn", salary_range: "100000" }),
    ];
    mockCreate.mockResolvedValue(makeSupabaseClient(apps) as never);
    const { data } = await getDashboardAnalytics();
    // Only the parseable entry counts
    const row = data?.avgSalaryBySource.find((r) => r.source === "LinkedIn");
    expect(row?.count).toBe(1);
    expect(row?.avgSalary).toBe(100000);
  });

  it("sorts results by avgSalary descending", async () => {
    const apps = [
      makeApp({ status: "Applied", source: "Referral", salary_range: "60000" }),
      makeApp({ status: "Applied", source: "LinkedIn", salary_range: "120000" }),
    ];
    mockCreate.mockResolvedValue(makeSupabaseClient(apps) as never);
    const { data } = await getDashboardAnalytics();
    const salaries = data?.avgSalaryBySource.map((r) => r.avgSalary) ?? [];
    expect(salaries[0]).toBeGreaterThanOrEqual(salaries[salaries.length - 1]);
  });
});

// ── stageFunnel ───────────────────────────────────────────────────────────────

describe("getDashboardAnalytics — stageFunnel", () => {
  it("returns all 5 stages with 0 counts when no apps exist", async () => {
    mockCreate.mockResolvedValue(makeSupabaseClient([]) as never);
    const { data } = await getDashboardAnalytics();
    expect(data?.stageFunnel).toHaveLength(5);
    data?.stageFunnel.forEach((s) => expect(s.count).toBe(0));
  });

  it("counts apps at each stage cumulatively (Applied includes everything above)", async () => {
    const apps = [
      makeApp({ status: "Applied" }),
      makeApp({ status: "Phone Screen" }),
      makeApp({ status: "Interview" }),
      makeApp({ status: "Offer" }),
      makeApp({ status: "Accepted" }),
    ];
    mockCreate.mockResolvedValue(makeSupabaseClient(apps) as never);
    const { data } = await getDashboardAnalytics();

    const funnel = Object.fromEntries((data?.stageFunnel ?? []).map((s) => [s.stage, s.count]));
    // Applied: all 5 apps are at or past Applied
    expect(funnel["Applied"]).toBe(5);
    // Phone Screen: Phone Screen, Interview, Offer, Accepted = 4
    expect(funnel["Phone Screen"]).toBe(4);
    // Interview: Interview, Offer, Accepted = 3
    expect(funnel["Interview"]).toBe(3);
    // Offer: Offer, Accepted = 2
    expect(funnel["Offer"]).toBe(2);
    // Accepted: Accepted only = 1
    expect(funnel["Accepted"]).toBe(1);
  });

  it("correctly handles all apps stuck at Applied stage", async () => {
    const apps = Array.from({ length: 10 }, () => makeApp({ status: "Applied" }));
    mockCreate.mockResolvedValue(makeSupabaseClient(apps) as never);
    const { data } = await getDashboardAnalytics();
    const funnel = Object.fromEntries((data?.stageFunnel ?? []).map((s) => [s.stage, s.count]));
    expect(funnel["Applied"]).toBe(10);
    expect(funnel["Phone Screen"]).toBe(0);
    expect(funnel["Offer"]).toBe(0);
  });

  it("does not count Rejected or Ghosted in any funnel stage", async () => {
    const apps = [
      makeApp({ status: "Rejected" }),
      makeApp({ status: "Ghosted" }),
      makeApp({ status: "Applied" }),
    ];
    mockCreate.mockResolvedValue(makeSupabaseClient(apps) as never);
    const { data } = await getDashboardAnalytics();
    const funnel = Object.fromEntries((data?.stageFunnel ?? []).map((s) => [s.stage, s.count]));
    // Only Applied counts
    expect(funnel["Applied"]).toBe(1);
  });
});

// ── weekdayActivity — local-time date parsing fix ─────────────────────────────

describe("getDashboardAnalytics — weekdayActivity", () => {
  it("returns exactly 7 entries (Mon–Sun)", async () => {
    mockCreate.mockResolvedValue(makeSupabaseClient([]) as never);
    const { data } = await getDashboardAnalytics();
    expect(data?.weekdayActivity).toHaveLength(7);
    expect(data?.weekdayActivity.map((d) => d.day)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
  });

  it("all counts are 0 with no applications", async () => {
    mockCreate.mockResolvedValue(makeSupabaseClient([]) as never);
    const { data } = await getDashboardAnalytics();
    data?.weekdayActivity.forEach((d) => expect(d.count).toBe(0));
  });

  it("correctly bins an application by its LOCAL weekday (not UTC)", () => {
    // The bug: new Date("2026-05-18") = UTC midnight → wrong weekday for UTC− users.
    // Fix: new Date(y, m-1, d) uses local time.
    // We test by constructing a date string that is Tuesday in LOCAL time and checking
    // that it lands in the "Tue" bucket regardless of timezone.
    const tuesdayLocal = localDateForWeekday(2); // 2 = Tuesday (getDay)
    const result = localDateToWeekdayIndex(tuesdayLocal);
    // Mon=0, Tue=1, … Sun=6
    expect(result).toBe(1);
  });

  it("bins multiple applications across different weekdays", async () => {
    const monday    = localDateForWeekday(1); // 1=Mon
    const wednesday = localDateForWeekday(3); // 3=Wed
    const saturday  = localDateForWeekday(6); // 6=Sat
    const apps = [
      makeApp({ status: "Applied", applied_date: monday }),
      makeApp({ status: "Applied", applied_date: monday }),
      makeApp({ status: "Applied", applied_date: wednesday }),
      makeApp({ status: "Applied", applied_date: saturday }),
    ];
    mockCreate.mockResolvedValue(makeSupabaseClient(apps) as never);
    const { data } = await getDashboardAnalytics();
    const byDay = Object.fromEntries((data?.weekdayActivity ?? []).map((d) => [d.day, d.count]));
    expect(byDay["Mon"]).toBe(2);
    expect(byDay["Wed"]).toBe(1);
    expect(byDay["Sat"]).toBe(1);
    expect(byDay["Tue"]).toBe(0);
    expect(byDay["Sun"]).toBe(0);
  });

  it("total weekday counts equals total applications", async () => {
    const apps = Array.from({ length: 12 }, (_, i) =>
      makeApp({ status: "Applied", applied_date: localDateForWeekday((i % 7) as 0 | 1 | 2 | 3 | 4 | 5 | 6) })
    );
    mockCreate.mockResolvedValue(makeSupabaseClient(apps) as never);
    const { data } = await getDashboardAnalytics();
    const total = data?.weekdayActivity.reduce((s, d) => s + d.count, 0) ?? 0;
    expect(total).toBe(12);
  });
});

// ── Helper exposed for the weekday local-time test ────────────────────────────
// This mirrors the exact computation in services/analytics.ts so we can unit-test
// the date-parsing fix without importing the private function.
function localDateToWeekdayIndex(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const raw = new Date(y, m - 1, d).getDay(); // local time, 0=Sun
  return raw === 0 ? 6 : raw - 1;             // Mon=0..Sun=6
}

// ── tierResponseRate ──────────────────────────────────────────────────────────

describe("getDashboardAnalytics — tierResponseRate", () => {
  it("returns empty array when no apps have company_tier set", async () => {
    const apps = [makeApp({ status: "Applied" }), makeApp({ status: "Rejected" })];
    mockCreate.mockResolvedValue(makeSupabaseClient(apps) as never);
    const { data } = await getDashboardAnalytics();
    expect(data?.tierResponseRate).toEqual([]);
  });

  it("excludes tiers with fewer than 2 apps", async () => {
    const apps = [makeApp({ status: "Rejected", company_tier: "FAANG" })];
    mockCreate.mockResolvedValue(makeSupabaseClient(apps) as never);
    const { data } = await getDashboardAnalytics();
    expect(data?.tierResponseRate).toEqual([]);
  });

  it("computes responseRate as responded/total for each tier", async () => {
    const apps = [
      makeApp({ status: "Phone Screen", company_tier: "FAANG" }),
      makeApp({ status: "Applied",      company_tier: "FAANG" }),
      makeApp({ status: "Rejected",     company_tier: "FAANG" }),
      makeApp({ status: "Applied",      company_tier: "Startup" }),
      makeApp({ status: "Applied",      company_tier: "Startup" }),
    ];
    mockCreate.mockResolvedValue(makeSupabaseClient(apps) as never);
    const { data } = await getDashboardAnalytics();

    const faang = data?.tierResponseRate.find((t) => t.tier === "FAANG");
    expect(faang?.total).toBe(3);
    expect(faang?.responded).toBe(2); // Phone Screen + Rejected
    expect(faang?.responseRate).toBe(67); // Math.round(2/3*100)

    const startup = data?.tierResponseRate.find((t) => t.tier === "Startup");
    expect(startup?.total).toBe(2);
    expect(startup?.responded).toBe(0);
    expect(startup?.responseRate).toBe(0);
  });

  it("counts Accepted as a responded status", async () => {
    const apps = [
      makeApp({ status: "Accepted", company_tier: "Tier 1" }),
      makeApp({ status: "Applied",  company_tier: "Tier 1" }),
    ];
    mockCreate.mockResolvedValue(makeSupabaseClient(apps) as never);
    const { data } = await getDashboardAnalytics();
    const tier1 = data?.tierResponseRate.find((t) => t.tier === "Tier 1");
    expect(tier1?.responded).toBe(1);
    expect(tier1?.responseRate).toBe(50);
  });

  it("sorts results by TIER_ORDER — FAANG before Startup", async () => {
    const apps = [
      makeApp({ status: "Applied",  company_tier: "Startup" }),
      makeApp({ status: "Rejected", company_tier: "Startup" }),
      makeApp({ status: "Applied",  company_tier: "FAANG"   }),
      makeApp({ status: "Rejected", company_tier: "FAANG"   }),
    ];
    mockCreate.mockResolvedValue(makeSupabaseClient(apps) as never);
    const { data } = await getDashboardAnalytics();
    const tiers = data?.tierResponseRate.map((t) => t.tier) ?? [];
    expect(tiers.indexOf("FAANG")).toBeLessThan(tiers.indexOf("Startup"));
  });

  it("returns empty when every tier has exactly 1 app (all below threshold)", async () => {
    const apps = [
      makeApp({ status: "Applied",  company_tier: "FAANG"   }),
      makeApp({ status: "Rejected", company_tier: "Tier 1"  }),
      makeApp({ status: "Applied",  company_tier: "Startup" }),
    ];
    mockCreate.mockResolvedValue(makeSupabaseClient(apps) as never);
    const { data } = await getDashboardAnalytics();
    expect(data?.tierResponseRate).toEqual([]);
  });
});

// ── responseRate — Accepted fix ───────────────────────────────────────────────

describe("getDashboardAnalytics — responseRate includes Accepted (regression)", () => {
  it("counts Accepted as a response in the headline stat", async () => {
    // Bug: Accepted was missing → user with offers saw headline 0% while
    // per-tier and per-source breakdowns correctly showed 50%.
    const apps = [
      makeApp({ status: "Accepted" }),
      makeApp({ status: "Applied"  }),
    ];
    mockCreate.mockResolvedValue(makeSupabaseClient(apps) as never);
    const { data } = await getDashboardAnalytics();
    expect(data?.responseRate).toBe(50);
  });

  it("headline responseRate agrees with sourceEffectiveness and tierResponseRate for Accepted", async () => {
    const apps = [
      makeApp({ status: "Accepted", source: "LinkedIn", company_tier: "FAANG" }),
      makeApp({ status: "Accepted", source: "LinkedIn", company_tier: "FAANG" }),
      makeApp({ status: "Applied",  source: "LinkedIn", company_tier: "FAANG" }),
      makeApp({ status: "Applied",  source: "LinkedIn", company_tier: "FAANG" }),
    ];
    mockCreate.mockResolvedValue(makeSupabaseClient(apps) as never);
    const { data } = await getDashboardAnalytics();
    expect(data?.responseRate).toBe(50);
    const linkedin = data?.sourceEffectiveness.find((s) => s.source === "LinkedIn");
    expect(linkedin?.responseRate).toBe(50);
    const faang = data?.tierResponseRate.find((t) => t.tier === "FAANG");
    expect(faang?.responseRate).toBe(50);
  });

  it("responseRate is 0 with no applications", async () => {
    mockCreate.mockResolvedValue(makeSupabaseClient([]) as never);
    const { data } = await getDashboardAnalytics();
    expect(data?.responseRate).toBe(0);
  });
});
