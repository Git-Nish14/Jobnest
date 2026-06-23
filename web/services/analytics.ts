import { createClient } from "@/lib/supabase/server";
import { parseSalary } from "@/lib/utils/salary-parse";
import type {
  ApiResponse,
  DashboardAnalytics,
  StatusCount,
  DailyTrend,
  WeeklyTrend,
  MonthlyTrend,
  CompanyCount,
  SourceSalary,
  SourceEffectiveness,
  StageFunnel,
  WeekdayActivity,
  Interview,
  Reminder,
} from "@/types";

export async function getDashboardAnalytics(): Promise<ApiResponse<DashboardAnalytics>> {
  try {
    const supabase = await createClient();

    // Fetch only the columns needed for analytics — avoids pulling notes/job_description
    // (which can be many KB each) for every row, cutting transfer size significantly.
    const { data: applications, error: appError } = await supabase
      .from("job_applications")
      .select("id,status,applied_date,updated_at,company,source,salary_range")
      .order("applied_date", { ascending: false });

    if (appError) {
      return {
        data: null,
        error: { message: appError.message, code: appError.code },
      };
    }

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Calculate basic stats
    const totalApplications = applications?.length || 0;
    const thisWeek = applications?.filter(
      (app) => new Date(app.applied_date) >= startOfWeek
    ).length || 0;
    const thisMonth = applications?.filter(
      (app) => new Date(app.applied_date) >= startOfMonth
    ).length || 0;

    // Status distribution
    const statusCounts: Record<string, number> = {};
    applications?.forEach((app) => {
      statusCounts[app.status] = (statusCounts[app.status] || 0) + 1;
    });

    const statusDistribution: StatusCount[] = Object.entries(statusCounts).map(
      ([status, count]) => ({ status, count })
    );

    // Response rate (got any response: Phone Screen, Interview, Offer, Rejected)
    const responses = (statusCounts["Phone Screen"] || 0) +
      (statusCounts["Interview"] || 0) +
      (statusCounts["Offer"] || 0) +
      (statusCounts["Rejected"] || 0);
    const responseRate = totalApplications > 0
      ? Math.round((responses / totalApplications) * 100)
      : 0;

    // ── Richer analytics ────────────────────────────────────────────────────

    // Average time to first response (days).
    // Proxy: updated_at − applied_date for apps that moved past Applied.
    // We cap individual values at 90 days to exclude genuine outliers (apps
    // applied long ago that the user never closed out, or where late edits to
    // notes/salary drift updated_at far from the real response date). Require
    // ≥2 data points so a single lucky/unlucky result doesn't distort the number.
    const RESPONDED = new Set(["Phone Screen", "Interview", "Offer", "Accepted", "Rejected"]);
    const respondedApps = (applications ?? []).filter((a) => RESPONDED.has(a.status));
    let averageTimeToResponse: number | null = null;
    if (respondedApps.length >= 2) {
      const delays = respondedApps
        .map((a) => {
          const applied = new Date(a.applied_date).getTime();
          const updated = new Date(a.updated_at).getTime();
          return Math.floor((updated - applied) / (1000 * 60 * 60 * 24));
        })
        .filter((d) => d > 0 && d <= 90);    // exclude same-day edits; 90-day cap limits
                                              // drift from late edits to notes/salary fields
      if (delays.length >= 1) {
        averageTimeToResponse = Math.round(
          delays.reduce((sum, d) => sum + d, 0) / delays.length
        );
      }
    }

    // Interview → Offer conversion rate.
    // Only computed when we have ≥3 apps at or past the Interview stage, so the
    // percentage isn't misleading (e.g. 1 offer from 1 interview = "100%").
    const atInterview =
      (statusCounts["Interview"] || 0) +
      (statusCounts["Offer"]     || 0) +
      (statusCounts["Accepted"]  || 0);
    const atOffer =
      (statusCounts["Offer"]    || 0) +
      (statusCounts["Accepted"] || 0);
    const interviewToOfferRate: number | null =
      atInterview >= 3 ? Math.round((atOffer / atInterview) * 100) : null;

    // Ghosting rate — percentage of all applications that went silent.
    // "Ghosted" covers both explicit status and implicit cases: Applied apps
    // that have been sitting for more than 30 days with no progression.
    // Use local date arithmetic (same as weekday logic) to avoid UTC-offset shifts.
    // Require ≥5 total applications before surfacing this metric.
    const GHOST_DAYS = 30;
    const nowMs = now.getTime();
    const implicitGhosts = (applications ?? []).filter((a) => {
      if (a.status !== "Applied" || !a.applied_date) return false;
      const [y, mo, d] = (a.applied_date as string).split("-").map(Number);
      const appliedMs = new Date(y, mo - 1, d).getTime();
      return Math.floor((nowMs - appliedMs) / (1000 * 60 * 60 * 24)) > GHOST_DAYS;
    }).length;
    const ghosted = (statusCounts["Ghosted"] || 0) + implicitGhosts;
    const ghostRate: number | null =
      totalApplications >= 5
        ? Math.round((ghosted / totalApplications) * 100)
        : null;

    // Daily trends — last 30 days
    const dailyTrends: DailyTrend[] = [];
    for (let i = 29; i >= 0; i--) {
      const day = new Date(now);
      day.setDate(now.getDate() - i);
      const dayStr = day.toISOString().split("T")[0]; // "YYYY-MM-DD"
      const count = applications?.filter((app) => app.applied_date === dayStr).length || 0;
      dailyTrends.push({
        date: day.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        count,
      });
    }

    // Weekly trends — last 24 weeks (full ~6-month history)
    const weeklyTrends: WeeklyTrend[] = [];
    for (let i = 23; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - (i * 7) - now.getDay());
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const count = applications?.filter((app) => {
        const appDate = new Date(app.applied_date);
        return appDate >= weekStart && appDate <= weekEnd;
      }).length || 0;

      weeklyTrends.push({
        week: weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        count,
      });
    }

    // Monthly trends — full account history (from first application, up to 36 months)
    const monthlyTrends: MonthlyTrend[] = [];
    const firstApp = applications?.reduce((earliest, app) => {
      const d = new Date(app.applied_date);
      return !earliest || d < earliest ? d : earliest;
    }, null as Date | null);

    const historyStart = firstApp ?? new Date(now.getFullYear(), now.getMonth() - 5, 1);
    // Clamp to 36 months max to avoid extremely large arrays
    const monthsBack = Math.min(
      (now.getFullYear() - historyStart.getFullYear()) * 12 + (now.getMonth() - historyStart.getMonth()),
      35
    );

    for (let i = monthsBack; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);

      const monthApps = applications?.filter((app) => {
        const appDate = new Date(app.applied_date);
        return appDate >= monthStart && appDate <= monthEnd;
      }) || [];

      const offers = monthApps.filter((app) => app.status === "Offer").length;
      const rejections = monthApps.filter((app) => app.status === "Rejected").length;

      monthlyTrends.push({
        month: monthStart.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        count: monthApps.length,
        offers,
        rejections,
      });
    }

    // Top companies
    const companyCounts: Record<string, number> = {};
    applications?.forEach((app) => {
      companyCounts[app.company] = (companyCounts[app.company] || 0) + 1;
    });

    const topCompanies: CompanyCount[] = Object.entries(companyCounts)
      .map(([company, count]) => ({ company, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // ── Source effectiveness ─────────────────────────────────────────────────
    const RESPONDED_SET = new Set(["Phone Screen", "Interview", "Offer", "Accepted", "Rejected"]);
    const sourceMap: Record<string, { total: number; responded: number }> = {};
    (applications ?? []).forEach((a) => {
      const src = a.source || "Other";
      if (!sourceMap[src]) sourceMap[src] = { total: 0, responded: 0 };
      sourceMap[src].total++;
      if (RESPONDED_SET.has(a.status)) sourceMap[src].responded++;
    });
    const sourceEffectiveness: SourceEffectiveness[] = Object.entries(sourceMap)
      .map(([source, { total, responded }]) => ({
        source,
        total,
        responded,
        responseRate: total > 0 ? Math.round((responded / total) * 100) : 0,
      }))
      .filter((s) => s.total >= 2)
      .sort((a, b) => b.responseRate - a.responseRate);

    // ── Average salary by source ─────────────────────────────────────────────
    const salaryBySource: Record<string, { sum: number; count: number }> = {};
    (applications ?? []).forEach((a) => {
      const mid = parseSalary(a.salary_range);
      if (!mid) return;
      const src = a.source || "Other";
      if (!salaryBySource[src]) salaryBySource[src] = { sum: 0, count: 0 };
      salaryBySource[src].sum += mid;
      salaryBySource[src].count++;
    });
    const avgSalaryBySource: SourceSalary[] = Object.entries(salaryBySource)
      .filter(([, { count }]) => count >= 1)
      .map(([source, { sum, count }]) => ({
        source,
        avgSalary: Math.round(sum / count),
        count,
      }))
      .sort((a, b) => b.avgSalary - a.avgSalary);

    // ── Stage funnel ─────────────────────────────────────────────────────────
    const FUNNEL_STAGES = ["Applied", "Phone Screen", "Interview", "Offer", "Accepted"] as const;
    const stageFunnel: StageFunnel[] = FUNNEL_STAGES.map((stage) => ({
      stage,
      count: (applications ?? []).filter((a) => {
        const idx = FUNNEL_STAGES.indexOf(a.status as typeof FUNNEL_STAGES[number]);
        return idx >= FUNNEL_STAGES.indexOf(stage);
      }).length,
    }));

    // ── Weekday activity ─────────────────────────────────────────────────────
    const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
    const dayCounts: number[] = [0, 0, 0, 0, 0, 0, 0];
    (applications ?? []).forEach((a) => {
      // applied_date is a DATE string like "2026-05-18".
      // new Date("2026-05-18") parses as UTC midnight — for users in UTC-5..UTC-8 this
      // shifts the weekday back by one day (e.g., Monday midnight UTC = Sunday evening local).
      // Construct in local time by splitting the parts so the weekday is always correct.
      const [y, m, d] = (a.applied_date as string).split("-").map(Number);
      const raw = new Date(y, m - 1, d).getDay(); // local time, 0=Sun..6=Sat
      const idx = raw === 0 ? 6 : raw - 1;        // remap to Mon=0..Sun=6
      dayCounts[idx]++;
    });
    const weekdayActivity: WeekdayActivity[] = DAYS.map((day, i) => ({ day, count: dayCounts[i] }));

    // ── Active pipeline ──────────────────────────────────────────────────────
    const activePipeline =
      (statusCounts["Phone Screen"] || 0) + (statusCounts["Interview"] || 0);

    // ── Weekly momentum ──────────────────────────────────────────────────────
    // Compare this week's application count to the trailing 4-week average.
    // weeklyTrends always has 24 entries (the loop above is fixed-size), so
    // slice(-5, -1) always yields exactly 4 weeks of prior data.
    // Capped at ±500% so a burst week doesn't render "+9800%" in the UI.
    const priorWeeks = weeklyTrends.slice(-5, -1);
    const priorAvg = priorWeeks.reduce((s, w) => s + w.count, 0) / priorWeeks.length;
    const weeklyMomentum: number | null =
      priorAvg > 0
        ? Math.min(500, Math.round(((thisWeek - priorAvg) / priorAvg) * 100))
        : null;

    // ── Top source ───────────────────────────────────────────────────────────
    // sourceEffectiveness is already sorted descending by responseRate.
    const topSource =
      sourceEffectiveness.length > 0
        ? { source: sourceEffectiveness[0].source, responseRate: sourceEffectiveness[0].responseRate }
        : null;

    // Upcoming interviews — include the parent application so the dashboard can
    // show the company name in the "Next interview" stat card footer.
    let upcomingInterviews: Interview[] = [];
    const { data: interviews } = await supabase
      .from("interviews")
      .select("*, job_applications(company, position)")
      .gte("scheduled_at", now.toISOString())
      .eq("status", "Scheduled")
      .order("scheduled_at", { ascending: true })
      .limit(5);

    if (interviews) {
      upcomingInterviews = interviews as Interview[];
    }

    // Pending reminders — select only the fields the tasks panel renders.
    let pendingReminders: Reminder[] = [];
    const { data: reminders } = await supabase
      .from("reminders")
      .select("id, title, remind_at, is_completed, application_id")
      .eq("is_completed", false)
      .gte("remind_at", now.toISOString())
      .order("remind_at", { ascending: true })
      .limit(5);

    if (reminders) {
      pendingReminders = reminders as Reminder[];
    }

    return {
      data: {
        totalApplications,
        thisWeek,
        thisMonth,
        responseRate,
        averageTimeToResponse,
        interviewToOfferRate,
        ghostRate,
        activePipeline,
        weeklyMomentum,
        topSource,
        statusDistribution,
        dailyTrends,
        weeklyTrends,
        monthlyTrends,
        topCompanies,
        upcomingInterviews,
        pendingReminders,
        avgSalaryBySource,
        sourceEffectiveness,
        stageFunnel,
        weekdayActivity,
      },
      error: null,
    };
  } catch {
    return {
      data: null,
      error: { message: "Failed to fetch analytics" },
    };
  }
}

export async function getApplicationTrends(period: "week" | "month" | "year" = "month"): Promise<ApiResponse<{ label: string; count: number }[]>> {
  try {
    const supabase = await createClient();
    const now = new Date();
    let startDate: Date;
    let groupBy: "day" | "month";

    switch (period) {
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        groupBy = "day";
        break;
      case "month":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        groupBy = "day";
        break;
      case "year":
        startDate = new Date(now.getFullYear(), 0, 1);
        groupBy = "month";
        break;
    }

    const { data: applications, error } = await supabase
      .from("job_applications")
      .select("applied_date")
      .gte("applied_date", startDate.toISOString().split("T")[0]);

    if (error) {
      return { data: null, error: { message: error.message } };
    }

    const trends: Record<string, number> = {};

    applications?.forEach((app) => {
      const date = new Date(app.applied_date);
      let key: string;

      if (groupBy === "day") {
        key = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      } else {
        key = date.toLocaleDateString("en-US", { month: "short" });
      }

      trends[key] = (trends[key] || 0) + 1;
    });

    const result = Object.entries(trends).map(([label, count]) => ({ label, count }));

    return { data: result, error: null };
  } catch {
    return { data: null, error: { message: "Failed to fetch trends" } };
  }
}
