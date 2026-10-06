import { describe, it, expect, vi, beforeEach } from "vitest";
import { deriveAnalytics, type AnalyticsApplication, type AnalyticsEvent } from "@/lib/job-search/analytics";
import { readAll } from "@/lib/job-search/read-all";
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
import { createClient } from "@/lib/supabase/server";
import { getDashboardAnalytics } from "@/services/analytics";

const NOW = new Date("2026-10-06T17:00:00Z");
const app = (id: string, status = "Applied", overrides: Partial<AnalyticsApplication> = {}): AnalyticsApplication => ({ id, status, applied_date: "2026-08-01", company: "Acme", source: "Company Website", salary_range: null, company_tier: null, ...overrides });
const event = (id: string, old_status: string, new_status: string, created_at = "2026-08-01T18:00:00Z"): AnalyticsEvent => ({ application_id: id, activity_type: "Status Changed", metadata: { old_status, new_status }, created_at });
const derive = (apps: AnalyticsApplication[], events: AnalyticsEvent[] = []) => deriveAnalytics(apps, events, NOW, "America/Chicago");

beforeEach(() => vi.clearAllMocks());

describe("historical search analytics", () => {
  it("excludes saved, preparing, future submissions, and withdrawn unsubmitted roles", () => {
    const result = derive([app("a"), app("b", "Saved"), app("c", "Preparing"), app("d", "Applied", { applied_date: "2027-01-01" }), app("e", "Withdrawn", { saved_date: "2026-08-01", submitted_at: null })]);
    expect(result.totalApplications).toBe(1);
    expect(result.savedApplications).toBe(2);
  });
  it("preserves interview stages after rejection without inferring a phone screen", () => {
    const result = derive([app("a", "Rejected")], [event("a", "Applied", "Interview"), event("a", "Interview", "Rejected")]);
    expect(result.stageFunnel.map((s) => s.count)).toEqual([1, 0, 1, 0, 0]);
  });
  it("uses resolved historical interviews and separates pending interviews", () => {
    const apps = [app("a", "Rejected"), app("b", "Rejected"), app("c", "Offer"), app("d", "Interview")];
    const logs = apps.map((a) => event(a.id, "Applied", "Interview"));
    logs.push(event("c", "Interview", "Offer"));
    const result = derive(apps, logs);
    expect(result.interviewToOfferRate).toBe(33);
    expect(result.interviewResolved).toBe(3);
    expect(result.interviewPending).toBe(1);
  });
  it("does not count an imported offer as an observed interview", () => {
    const result = derive([app("a", "Offer")]);
    expect(result.stageFunnel.find((s) => s.stage === "Interview")?.count).toBe(0);
    expect(result.interviewToOfferRate).toBeNull();
  });
  it("keeps a historically received offer after withdrawal", () => {
    const result = derive([app("a", "Withdrawn")], [event("a", "Interview", "Offer"), event("a", "Offer", "Withdrawn")]);
    expect(result.offersReceived).toBe(1);
    expect(result.responseRate).toBe(100);
  });
  it("does not treat withdrawal without a recorded reply as a reply", () => expect(derive([app("a", "Withdrawn")]).responseRate).toBe(0));
  it("counts Accepted as both an offer and a reply", () => {
    const result = derive([app("a", "Accepted"), app("b")]);
    expect(result.responseRate).toBe(50);
    expect(result.offersReceived).toBe(1);
  });
  it("includes same-day recorded replies and uses a median independent of edits", () => {
    const result = derive([app("a", "Interview", { updated_at: "2026-10-05" }), app("b", "Rejected"), app("c", "Interview")], [event("a", "Applied", "Interview"), event("b", "Applied", "Rejected", "2026-08-03T18:00:00Z"), event("c", "Applied", "Interview", "2026-09-30T18:00:00Z")]);
    expect(result.averageTimeToResponse).toBe(2);
    expect(result.responseSampleSize).toBe(3);
  });
  it("does not use a later rejection date as the unknown first response date", () => {
    const result = derive([app("a", "Rejected"), app("b", "Rejected")], [event("a", "Interview", "Rejected"), event("b", "Phone Screen", "Rejected")]);
    expect(result.averageTimeToResponse).toBeNull();
  });
  it("does not manufacture response timestamps from current status or updated_at", () => expect(derive([app("a", "Interview"), app("b", "Interview")]).averageTimeToResponse).toBeNull());
  it("separates rejection replies from positive source outcomes", () => {
    const result = derive([app("a", "Rejected"), app("b", "Interview"), app("c", "Applied", { applied_date: "2026-10-05" })]);
    expect(result.sourceEffectiveness[0]).toMatchObject({ total: 2, responded: 2, positive: 1, positiveRate: 50, excludedRecent: 1 });
    expect(result.topSource).toBeNull();
  });
  it("does not silently classify stale waiting applications as ghosted", () => {
    const result = derive(Array.from({ length: 5 }, (_, i) => app(String(i))));
    expect(result.ghostRate).toBe(0);
    expect(result.staleApplications).toBe(5);
  });
  it("uses user's local calendar date and Sunday week boundary", () => {
    const result = deriveAnalytics([app("a", "Applied", { applied_date: "2026-10-03" }), app("b", "Applied", { applied_date: "2026-10-04" })], [], new Date("2026-10-05T01:00:00Z"), "America/Chicago");
    expect(result.weekStart).toBe("2026-10-04");
    expect(result.thisWeek).toBe(1);
    expect(result.dailyTrends.at(-1)?.count).toBe(1);
  });
  it("respects Monday as an optional week start", () => {
    const result = deriveAnalytics([app("a", "Applied", { applied_date: "2026-10-04" }), app("b", "Applied", { applied_date: "2026-10-05" })], [], NOW, "America/Chicago", 1);
    expect(result.weekStart).toBe("2026-10-05");
    expect(result.thisWeek).toBe(1);
  });
  it("compares equal elapsed weekdays for momentum", () => {
    const dates = ["2026-10-05", "2026-09-28", "2026-09-21", "2026-09-14", "2026-09-07", "2026-10-02", "2026-09-25"];
    expect(derive(dates.map((d, i) => app(String(i), "Applied", { applied_date: d }))).weeklyMomentum).toBe(0);
  });
  it("counts past offers in their application cohort even if withdrawn", () => {
    const result = derive([app("a", "Withdrawn")], [event("a", "Interview", "Offer")]);
    expect(result.monthlyTrends[0].offers).toBe(1);
  });
  it("does not aggregate unnormalized free-text compensation", () => expect(derive([app("a", "Applied", { salary_range: "CAD 30/hour" })]).avgSalaryBySource).toEqual([]));
});

describe("complete and trustworthy reads", () => {
  it("reads beyond the API cap with stable nonoverlapping pages", async () => {
    const rows = Array.from({ length: 1500 }, (_, id) => ({ id }));
    const read = vi.fn((from: number, to: number) => Promise.resolve({ data: rows.slice(from, to + 1), error: null }));
    expect(await readAll(read)).toHaveLength(1500);
    expect(read.mock.calls).toEqual([[0, 499], [500, 999], [1000, 1499], [1500, 1999]]);
  });
  it("fails visibly if a later page fails instead of returning partial history", async () => {
    const read = vi.fn().mockResolvedValueOnce({ data: Array(500).fill({}), error: null }).mockResolvedValueOnce({ data: null, error: { message: "offline" } });
    await expect(readAll(read)).rejects.toThrow("offline");
  });
  it("counts all interviews/reminders while keeping previews bounded, including overdue-only work", async () => {
    const data: Record<string, unknown[]> = { job_applications: [app("a")], activity_logs: [], interviews: Array.from({ length: 9 }, (_, i) => ({ id: String(i) })), reminders: Array.from({ length: 15 }, (_, i) => ({ id: String(i), remind_at: "2020-01-01T00:00:00Z" })) };
    const chains: Record<string, Record<string, unknown>> = {};
    const supabase = { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user", user_metadata: { timezone: "America/Chicago" } } }, error: null }) }, from: vi.fn((table: string) => {
      const chain: Record<string, unknown> = {};
      for (const method of ["select", "eq", "in", "gte", "order"]) chain[method] = vi.fn().mockReturnValue(chain);
      chain.range = vi.fn((from: number, to: number) => Promise.resolve({ data: data[table].slice(from, to + 1), error: null }));
      chains[table] = chain; return chain;
    }) };
    vi.mocked(createClient).mockResolvedValue(supabase as never);
    const result = await getDashboardAnalytics();
    expect(result.data).toMatchObject({ upcomingInterviewCount: 9, pendingReminderCount: 15, overdueReminderCount: 15 });
    expect(result.data?.upcomingInterviews).toHaveLength(8);
    expect(result.data?.pendingReminders).toHaveLength(12);
    expect(chains.reminders.gte).not.toHaveBeenCalled();
    expect(chains.reminders.eq).toHaveBeenCalledWith("user_id", "user");
  });
  it("does not query other users when authentication fails", async () => {
    const from = vi.fn();
    vi.mocked(createClient).mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) }, from } as never);
    expect((await getDashboardAnalytics()).data).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });
});
