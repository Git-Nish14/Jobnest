import { createClient } from "@/lib/supabase/server";
import { deriveAnalytics, type AnalyticsApplication, type AnalyticsEvent } from "@/lib/job-search/analytics";
import { readAll } from "@/lib/job-search/read-all";
import { readSearchPreferences } from "@/lib/job-search/preferences";
import { validTimezone } from "@/lib/job-search/calendar";
import type { ApiResponse, DashboardAnalytics, Interview, Reminder } from "@/types";

export async function getDashboardAnalytics(): Promise<ApiResponse<DashboardAnalytics>> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { data: null, error: { message: "Not authenticated" } };
    const now = new Date();
    const preferences = readSearchPreferences(user.user_metadata?.search_preferences);
    const [applications, events, interviews, reminders] = await Promise.all([
      readAll<AnalyticsApplication>((from, to) => supabase.from("job_applications")
        .select("id,status,applied_date,company,position,source,salary_range,company_tier,updated_at,saved_date,submitted_at")
        .eq("user_id", user.id).order("id").range(from, to)),
      readAll<AnalyticsEvent>((from, to) => supabase.from("activity_logs")
        .select("application_id,activity_type,metadata,created_at")
        .eq("user_id", user.id).in("activity_type", ["Status Changed", "Created"])
        .order("created_at").order("id").range(from, to)),
      readAll<Interview>((from, to) => supabase.from("interviews")
        .select("*, job_applications(company, position)").eq("user_id", user.id)
        .gte("scheduled_at", now.toISOString()).eq("status", "Scheduled")
        .order("scheduled_at").order("id").range(from, to)),
      readAll<Reminder>((from, to) => supabase.from("reminders")
        .select("*, job_applications(company, position)").eq("user_id", user.id)
        .eq("is_completed", false).order("remind_at").order("id").range(from, to)),
    ]);
    const analytics = deriveAnalytics(applications, events, now, validTimezone(user.user_metadata?.timezone), preferences.weekStartsOn);
    analytics.upcomingInterviewCount = interviews.length;
    analytics.pendingReminderCount = reminders.length;
    analytics.overdueReminderCount = reminders.filter((r) => r.remind_at < now.toISOString()).length;
    analytics.upcomingInterviews = interviews.slice(0, 8);
    analytics.pendingReminders = reminders.slice(0, 12);
    return { data: analytics, error: null };
  } catch (error) {
    console.error("[dashboard analytics]", error instanceof Error ? error.message : "Read failed");
    return { data: null, error: { message: "Your search data could not be loaded. Please try again." } };
  }
}

export async function getApplicationTrends(period: "week" | "month" | "year" = "month"): Promise<ApiResponse<{ label: string; count: number }[]>> {
  const { data, error } = await getDashboardAnalytics();
  if (!data) return { data: null, error };
  const trends = period === "year"
    ? data.monthlyTrends.slice(-12).map((item) => ({ label: item.month, count: item.count }))
    : data.dailyTrends.slice(period === "week" ? -7 : -30).map((item) => ({ label: item.date, count: item.count }));
  return { data: trends, error: null };
}
