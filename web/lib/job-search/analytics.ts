import type { DashboardAnalytics } from "@/types";
import { addDays, calendarDate, dateLabel, daysBetween, weekday, weekStart } from "./calendar";

export interface AnalyticsApplication {
  id: string; status: string; applied_date: string; company: string;
  source: string | null; salary_range: string | null; company_tier: string | null;
  position?: string; updated_at?: string;
  saved_date?: string | null; submitted_at?: string | null;
}
export interface AnalyticsEvent {
  application_id: string; activity_type: string; metadata: Record<string, unknown>; created_at: string;
}
export const PRE_APPLICATION = new Set(["Saved", "Preparing"]);
const RESPONSE = new Set(["Phone Screen", "Interview", "Offer", "Accepted", "Rejected"]);
const POSITIVE = new Set(["Phone Screen", "Interview", "Offer", "Accepted"]);
const CLOSED = new Set(["Rejected", "Withdrawn", "Ghosted", "Accepted"]);
const STAGES = ["Applied", "Phone Screen", "Interview", "Offer", "Accepted"];
const rate = (part: number, total: number) => total ? Math.round(part / total * 100) : 0;

export function deriveAnalytics(applications: AnalyticsApplication[], events: AnalyticsEvent[], now: Date, timezone: string, startsOn = 0): DashboardAnalytics {
  const today = calendarDate(now, timezone);
  const start = weekStart(today, startsOn);
  const submitted = applications.filter((a) => !PRE_APPLICATION.has(a.status) && a.applied_date <= today
    && !(a.status === "Withdrawn" && a.saved_date && !a.submitted_at));
  const history = new Map<string, Set<string>>();
  const firstResponse = new Map<string, string>();
  const changedApplications = new Set(events.filter((e) => e.activity_type === "Status Changed").map((e) => e.application_id));
  // Status changes are recorded dates, not verified employer response timestamps.
  for (const event of events) {
    if (event.activity_type !== "Status Changed" && event.activity_type !== "Created") continue;
    const states = [event.metadata.old_status, event.metadata.new_status, event.metadata.initial_status].filter((s): s is string => typeof s === "string");
    const reached = history.get(event.application_id) ?? new Set<string>();
    states.forEach((s) => reached.add(s));
    history.set(event.application_id, reached);
    // An old_status says it happened earlier; never pretend this log marks its first response.
    const entered = event.metadata.new_status;
    if (event.activity_type === "Status Changed" && typeof entered === "string" && RESPONSE.has(entered)
      && (event.metadata.old_status === "Applied" || PRE_APPLICATION.has(String(event.metadata.old_status)))) {
      const previous = firstResponse.get(event.application_id);
      if (!previous || event.created_at < previous) firstResponse.set(event.application_id, event.created_at);
    }
  }
  for (const app of submitted) {
    const reached = history.get(app.id) ?? new Set<string>();
    reached.add("Applied");
    reached.add(app.status);
    history.set(app.id, reached);
  }
  const has = (a: AnalyticsApplication, states: Set<string>) => [...(history.get(a.id) ?? [])].some((s) => states.has(s));
  const statusDistribution = Object.entries(applications.reduce<Record<string, number>>((counts, a) => {
    counts[a.status] = (counts[a.status] ?? 0) + 1; return counts;
  }, {})).map(([status, count]) => ({ status, count }));
  const totalApplications = submitted.length;
  const thisWeek = submitted.filter((a) => a.applied_date >= start).length;
  const thisMonth = submitted.filter((a) => a.applied_date >= `${today.slice(0, 7)}-01`).length;
  const responded = submitted.filter((a) => has(a, RESPONSE));
  const delays = submitted.flatMap((a) => {
    const response = firstResponse.get(a.id);
    if (!response) return [];
    const delay = daysBetween(a.applied_date, calendarDate(new Date(response), timezone));
    return delay >= 0 ? [delay] : [];
  }).sort((a, b) => a - b);
  const median = delays.length < 2 ? null : Math.round((delays[Math.floor((delays.length - 1) / 2)] + delays[Math.floor(delays.length / 2)]) / 2);
  const interviewed = submitted.filter((a) => history.get(a.id)?.has("Interview"));
  const resolved = interviewed.filter((a) => CLOSED.has(a.status) || has(a, new Set(["Offer", "Accepted"])));
  const offers = submitted.filter((a) => has(a, new Set(["Offer", "Accepted"])));
  const interviewOffers = resolved.filter((a) => has(a, new Set(["Offer", "Accepted"])));
  const dailyTrends = Array.from({ length: 30 }, (_, i) => {
    const day = addDays(today, i - 29);
    return { date: dateLabel(day), count: submitted.filter((a) => a.applied_date === day).length };
  });
  const weeklyTrends = Array.from({ length: 24 }, (_, i) => {
    const day = addDays(start, (i - 23) * 7);
    return { week: dateLabel(day), count: submitted.filter((a) => a.applied_date >= day && a.applied_date < addDays(day, 7)).length };
  });
  const firstMonth = submitted.map((a) => a.applied_date.slice(0, 7)).sort()[0];
  const currentMonth = new Date(`${today.slice(0, 7)}-01T12:00:00Z`);
  const first = firstMonth ? new Date(`${firstMonth}-01T12:00:00Z`) : currentMonth;
  const months = Math.min(35, (currentMonth.getUTCFullYear() - first.getUTCFullYear()) * 12 + currentMonth.getUTCMonth() - first.getUTCMonth());
  const monthlyTrends = Array.from({ length: months + 1 }, (_, i) => {
    const month = new Date(currentMonth);
    month.setUTCMonth(month.getUTCMonth() - months + i);
    const key = month.toISOString().slice(0, 7);
    const cohort = submitted.filter((a) => a.applied_date.startsWith(key));
    return { month: dateLabel(`${key}-01`, { month: "short", year: "2-digit" }), count: cohort.length,
      offers: cohort.filter((a) => has(a, new Set(["Offer", "Accepted"]))).length,
      rejections: cohort.filter((a) => a.status === "Rejected").length };
  });
  const sources = [...new Set(submitted.map((a) => a.source || "Other"))];
  const sourceEffectiveness = sources.map((source) => {
    const group = submitted.filter((a) => (a.source || "Other") === source);
    // Do not compare this week's unresolved submissions against older cohorts.
    const mature = group.filter((a) => daysBetween(a.applied_date, today) >= 30);
    const positive = mature.filter((a) => has(a, POSITIVE)).length;
    return { source, total: mature.length, responded: mature.filter((a) => has(a, RESPONSE)).length,
      responseRate: rate(mature.filter((a) => has(a, RESPONSE)).length, mature.length),
      positive, positiveRate: rate(positive, mature.length), pending: mature.filter((a) => a.status === "Applied" && !has(a, RESPONSE)).length,
      excludedRecent: group.length - mature.length };
  }).filter((s) => s.total > 0).sort((a, b) => b.positiveRate - a.positiveRate);
  const prior = [1, 2, 3, 4].map((weeks) => submitted.filter((a) => a.applied_date >= addDays(start, -7 * weeks) && a.applied_date <= addDays(today, -7 * weeks)).length);
  const average = prior.reduce((sum, n) => sum + n, 0) / 4;
  const weekdayActivity = [1, 2, 3, 4, 5, 6, 0].map((day) => ({ day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day], count: submitted.filter((a) => weekday(a.applied_date) === day).length }));
  const companies = [...new Set(submitted.map((a) => a.company))];
  const tierResponseRate = [...new Set(submitted.map((a) => a.company_tier).filter((t): t is string => !!t))].map((tier) => {
    const group = submitted.filter((a) => a.company_tier === tier && daysBetween(a.applied_date, today) >= 30);
    const replies = group.filter((a) => has(a, RESPONSE)).length;
    return { tier, total: group.length, responded: replies, responseRate: rate(replies, group.length) };
  }).filter((t) => t.total >= 5);
  const stale = submitted.filter((a) => a.status === "Applied" && !has(a, RESPONSE) && daysBetween(a.applied_date, today) > 30).length;
  return {
    totalApplications, thisWeek, thisMonth, responseRate: rate(responded.length, totalApplications),
    averageTimeToResponse: median, interviewToOfferRate: resolved.length >= 3 ? rate(interviewOffers.length, resolved.length) : null,
    ghostRate: totalApplications >= 5 ? rate(submitted.filter((a) => a.status === "Ghosted").length, totalApplications) : null,
    activePipeline: submitted.filter((a) => a.status === "Phone Screen" || a.status === "Interview").length,
    weeklyMomentum: average > 0 ? Math.min(500, Math.round((thisWeek - average) / average * 100)) : null,
    topSource: null, // Descriptive data is not strong enough to prescribe a channel.
    statusDistribution, dailyTrends, weeklyTrends, monthlyTrends, weekdayActivity, tierResponseRate, sourceEffectiveness,
    topCompanies: companies.map((company) => ({ company, count: submitted.filter((a) => a.company === company).length })).sort((a, b) => b.count - a.count).slice(0, 5),
    stageFunnel: STAGES.map((stage) => ({ stage, count: submitted.filter((a) => history.get(a.id)?.has(stage)).length })),
    avgSalaryBySource: [], // Free-text amounts are not comparable across currencies/pay periods.
    upcomingInterviews: [], pendingReminders: [],
    savedApplications: applications.filter((a) => PRE_APPLICATION.has(a.status)).length,
    offersReceived: offers.length, responseSampleSize: delays.length,
    interviewResolved: resolved.length, interviewPending: interviewed.length - resolved.length,
    historyCoverage: submitted.filter((a) => changedApplications.has(a.id)).length,
    staleApplications: stale, upcomingInterviewCount: 0, pendingReminderCount: 0, overdueReminderCount: 0,
    generatedAt: now.toISOString(), timezone, weekStart: start,
  };
}
