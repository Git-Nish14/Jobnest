import type { SearchPreferences } from "./preferences";
import { addDays, calendarDate, dateLabel, weekday, weekStart } from "./calendar";

export interface SearchAction {
  key: string; title: string; reason: string; href: string; minutes: number;
  dueDate: string; kind: "application" | "sourcing" | "prep" | "reminder" | "assessment" | "review" | "networking";
  reminderId?: string; required?: boolean;
}
export interface TaskState { task_key: string; status: "pending" | "completed" | "dismissed"; scheduled_date: string | null }
export interface WeeklyPlan {
  weekStart: string; today: string; goal: number; submitted: number; remaining: number;
  plannedApplications: number; shortfall: number; availableMinutes: number;
  plannedMinutes: number; paused: boolean; days: { date: string; label: string; actions: SearchAction[] }[];
  explanation: string;
}
export interface SavedRole { id: string; company: string; position: string }

/** Pure, explainable scheduling. It never edits a goal or claims a hiring probability. */
export function buildWeeklyPlan(input: {
  now: Date; timezone: string; goal: number; submitted: number; preferences: SearchPreferences;
  commitments: SearchAction[]; savedRoles: SavedRole[]; states?: TaskState[];
  connectionGoal?: number;
}): WeeklyPlan {
  const { preferences: prefs, goal, submitted } = input;
  const today = calendarDate(input.now, input.timezone);
  const start = weekStart(today, prefs.weekStartsOn);
  const end = addDays(start, 6);
  const dates = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const working = dates.filter((d) => d >= today && prefs.preferredDays.includes(weekday(d)));
  const remaining = Math.max(0, goal - submitted);
  // Weekly capacity is spread over selected days; elapsed days are not magically recovered.
  const weeklyDayCount = dates.filter((d) => prefs.preferredDays.includes(weekday(d))).length;
  const dailyCapacity = weeklyDayCount ? Math.floor(prefs.weeklyMinutes / weeklyDayCount) : 0;
  const capacity = new Map(working.map((d) => [d, dailyCapacity]));
  const actions = new Map(dates.map((d) => [d, [] as SearchAction[]]));
  const states = new Map((input.states ?? []).map((s) => [s.task_key, s]));
  const commitments = input.commitments.filter((a) => a.dueDate <= end).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  let unallocatedCommitments = 0;
  const add = (task: SearchAction, day: string) => {
    const state = states.get(task.key);
    if (state?.status === "completed" || state?.status === "dismissed") return;
    const proposed = state?.scheduled_date && state.scheduled_date >= today && state.scheduled_date <= end ? state.scheduled_date : day;
    const chosen = (capacity.get(proposed) ?? 0) >= task.minutes && (!task.required || proposed <= task.dueDate) ? proposed : day;
    if (!actions.has(chosen)) return;
    actions.get(chosen)!.push({ ...task, dueDate: chosen });
    capacity.set(chosen, Math.max(0, (capacity.get(chosen) ?? 0) - task.minutes));
  };
  if (!prefs.paused) {
    for (const task of commitments) {
      if (states.get(task.key)?.status === "completed" || states.get(task.key)?.status === "dismissed") continue;
      const due = task.dueDate < today ? today : task.dueDate;
      // Work before a deadline where possible, never schedule required work after it.
      const eligible = working.filter((d) => d <= due && (capacity.get(d) ?? 0) >= task.minutes);
      if (eligible.length) add(task, eligible[eligible.length - 1]);
      else { unallocatedCommitments += task.minutes; }
    }
  }
  let plannedApplications = 0;
  const pool = [...input.savedRoles];
  if (!prefs.paused) {
    for (let slot = 0; slot < remaining; slot++) {
      const eligible = working.filter((d) => (capacity.get(d) ?? 0) >= prefs.applicationMinutes);
      if (!eligible.length) break;
      // Balance application blocks over remaining days, then respect saved reschedules.
      const day = eligible.sort((a, b) => actions.get(a)!.filter((t) => t.kind === "application").length - actions.get(b)!.filter((t) => t.kind === "application").length || a.localeCompare(b))[0];
      const role = pool.shift();
      const task: SearchAction = {
        key: `application-${submitted + slot + 1}`, kind: role ? "application" : "sourcing",
        title: role ? `Apply: ${role.position} at ${role.company}` : "Find a suitable role to apply to",
        href: role ? `/applications/${role.id}` : "/applications/new?status=Saved",
        reason: role ? "A saved role you can review and prepare. Confirm submission to count it toward your goal." : "Save and review a suitable posting first. This sourcing block does not count as an application.",
        minutes: prefs.applicationMinutes, dueDate: day,
      };
      if (states.get(task.key)?.status === "dismissed") { pool.unshift(...(role ? [role] : [])); continue; }
      add(task, day);
      if (role) plannedApplications++;
    }
    const reviewDay = working.filter((d) => (capacity.get(d) ?? 0) >= 10).at(-1);
    if (reviewDay) add({ key: "weekly-review", kind: "review", title: "Review this week's progress", reason: "Update unresolved statuses and choose one useful adjustment for next week.", href: "/dashboard?view=insights", minutes: 10, dueDate: reviewDay }, reviewDay);
    const networkingBlocks = Math.min(input.connectionGoal ?? 1, 3);
    for (let i = 1; i <= networkingBlocks; i++) {
      const day = working.find((d) => (capacity.get(d) ?? 0) >= 10);
      if (!day) break;
      add({ key: `outreach-${i}`, kind: "networking", title: "Review a contact and draft outreach", reason: "Use a relevant connection to support your search. Review the draft before sending; this does not count as an application or a confirmed connection.", href: "/networking", minutes: 10, dueDate: day }, day);
    }
  }
  const days = dates.filter((d) => d >= today).map((date) => ({ date, label: dateLabel(date, { weekday: "short", month: "short", day: "numeric" }), actions: actions.get(date)! }));
  const plannedMinutes = days.reduce((sum, d) => sum + d.actions.reduce((s, a) => s + a.minutes, 0), 0);
  const availableMinutes = working.length * dailyCapacity;
  const shortfall = remaining - plannedApplications;
  return {
    weekStart: start, today, goal, submitted, remaining, plannedApplications, shortfall,
    availableMinutes, plannedMinutes, paused: prefs.paused, days,
    explanation: prefs.paused ? "Your search is paused. Your weekly goal is preserved; urgent commitments remain in Next actions."
      : remaining === 0 ? "Your application goal is met. Focus on your remaining commitments; your target stays unchanged."
      : `${remaining} applications remain toward your existing goal. Blocks follow your available days, not a claim about the best day to get hired.${unallocatedCommitments ? " Some commitments do not fit your availability; review them in Next actions." : ""}`,
  };
}
