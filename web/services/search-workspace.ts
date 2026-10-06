import { createClient } from "@/lib/supabase/server";
import { readAll } from "@/lib/job-search/read-all";
import { calendarDate } from "@/lib/job-search/calendar";
import type { SearchAction, SavedRole, TaskState } from "@/lib/job-search/planner";
import type { DashboardAnalytics, JobApplication } from "@/types";

function related(value: unknown): { company?: string; position?: string } {
  const row = Array.isArray(value) ? value[0] : value;
  return row && typeof row === "object" ? row as { company?: string; position?: string } : {};
}

export async function getSearchWorkspace(userId: string, stats: DashboardAnalytics) {
  const supabase = await createClient();
  const [recent, saved, assessments, state] = await Promise.all([
    supabase.from("job_applications").select("*").eq("user_id", userId)
      .order("updated_at", { ascending: false }).order("id").limit(6),
    supabase.from("job_applications").select("id,company,position").eq("user_id", userId)
      .in("status", ["Saved", "Preparing"]).order("created_at").order("id").limit(100),
    readAll<{ id: string; title: string; deadline: string | null; status: string; job_applications: unknown }>((from, to) =>
      supabase.from("assessments").select("id,title,deadline,status,job_applications(company,position)")
        .eq("user_id", userId).in("status", ["Pending", "In Progress"])
        .order("id").range(from, to)),
    supabase.from("search_plan_tasks").select("task_key,status,scheduled_date").eq("user_id", userId)
      .eq("week_start", stats.weekStart!),
  ]);
  if (recent.error || saved.error) throw new Error("Application workspace could not be loaded");
  const timezone = stats.timezone ?? "UTC";
  const actions: SearchAction[] = stats.pendingReminders.map((r) => ({
    key: `reminder:${r.id}`, kind: "reminder", title: r.title,
    reason: `${r.remind_at < stats.generatedAt! ? "Overdue" : "Upcoming"} reminder${related((r as unknown as { job_applications: unknown }).job_applications).company ? ` for ${related((r as unknown as { job_applications: unknown }).job_applications).company}` : ""}.`,
    href: r.application_id ? `/applications/${r.application_id}` : "/reminders",
    minutes: 10, dueDate: calendarDate(new Date(r.remind_at), timezone), reminderId: r.id, required: true,
  }));
  for (const interview of stats.upcomingInterviews) {
    const parent = related((interview as unknown as { job_applications: unknown }).job_applications);
    actions.push({ key: `interview:${interview.id}`, kind: "prep", title: `Prepare: ${parent.company ?? "upcoming interview"} (${interview.type})`,
      reason: `Interview ${new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(interview.scheduled_at))} · ${timezone}. Review the role and your examples.`,
      href: `/prep?application=${interview.application_id}&interview=${interview.id}`,
      minutes: 45, dueDate: calendarDate(new Date(interview.scheduled_at), timezone), required: true });
  }
  for (const assessment of assessments) {
    if (!assessment.deadline) continue;
    actions.push({ key: `assessment:${assessment.id}`, kind: "assessment", title: `Assessment: ${assessment.title}`,
      reason: `Due ${assessment.deadline.slice(0, 10)}. Check the remaining work and reserve time.`,
      href: "/prep?tab=assessments", minutes: 60,
      dueDate: /^\d{4}-\d{2}-\d{2}$/.test(assessment.deadline) ? assessment.deadline : calendarDate(new Date(assessment.deadline), timezone), required: true });
  }
  actions.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.key.localeCompare(b.key));
  return {
    recent: (recent.data ?? []) as JobApplication[], savedRoles: (saved.data ?? []) as SavedRole[],
    actions, states: (state.data ?? []) as TaskState[], persistenceAvailable: !state.error,
  };
}
