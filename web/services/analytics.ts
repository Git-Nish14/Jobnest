import { createClient } from "@/lib/supabase/server";
import type {
  ApiResponse,
  DashboardAnalytics,
  StatusCount,
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
    // Require ≥5 total applications before surfacing this metric.
    const ghosted = statusCounts["Ghosted"] || 0;
    const ghostRate: number | null =
      totalApplications >= 5
        ? Math.round((ghosted / totalApplications) * 100)
        : null;

    // Weekly trends (last 8 weeks)
    const weeklyTrends: WeeklyTrend[] = [];
    for (let i = 7; i >= 0; i--) {
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

    // Monthly trends (last 6 months)
    const monthlyTrends: MonthlyTrend[] = [];
    for (let i = 5; i >= 0; i--) {
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
    // Parse "X - Y" or "X" salary_range strings into a midpoint number.
    // Step 1: strip thousands-separator commas so "$90,000" → "$90000" before
    // the general non-numeric replacement, otherwise "90,000" splits to ["90","000"]
    // and "000" (= 0) is filtered out, producing 90 instead of 90000.
    const parseSalary = (range: string | null): number | null => {
      if (!range) return null;
      const normalized = range.replace(/,/g, ""); // strip thousands separators first
      const nums = normalized.replace(/[^0-9.\-]/g, " ").trim().split(/\s+/).map(Number).filter((n) => !isNaN(n) && n > 0);
      if (nums.length === 0) return null;
      if (nums.length === 1) return nums[0];
      return (nums[0] + nums[nums.length - 1]) / 2;
    };
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
        statusDistribution,
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
