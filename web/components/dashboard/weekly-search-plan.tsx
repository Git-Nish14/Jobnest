"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { buildWeeklyPlan, type SearchAction, type SavedRole, type TaskState } from "@/lib/job-search/planner";
import type { SearchPreferences } from "@/lib/job-search/preferences";
import { weekday } from "@/lib/job-search/calendar";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function WeeklySearchPlan({ goal, submitted, preferences, now, timezone, commitments, savedRoles, states, persistenceAvailable, hasSavedPreferences = true, connectionGoal }: {
  goal: number; submitted: number; preferences: SearchPreferences; now: string; timezone: string;
  commitments: SearchAction[]; savedRoles: SavedRole[]; states: TaskState[]; persistenceAvailable: boolean;
  hasSavedPreferences?: boolean;
  connectionGoal?: number;
}) {
  const router = useRouter();
  const [goalDraft, setGoalDraft] = useState(String(goal));
  const [draft, setDraft] = useState(preferences);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const plan = buildWeeklyPlan({ now: new Date(now), timezone, goal, submitted, preferences, commitments, savedRoles, states, connectionGoal });
  const completed = states.filter((s) => s.status !== "pending");
  async function save(url: string, body: unknown) {
    setBusy(true); setError(null);
    try {
      const response = await fetch(url, { method: url.includes("/tasks") ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!response.ok) { const result = await response.json(); throw new Error(result.error ?? "Could not save. Please try again."); }
      router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save"); }
    finally { setBusy(false); }
  }
  function saveTask(taskKey: string, status: TaskState["status"], scheduledDate: string | null = null) {
    if (scheduledDate) {
      const task = plan.days.flatMap((d) => d.actions).find((a) => a.key === taskKey);
      const day = plan.days.find((d) => d.date === scheduledDate);
      const used = day?.actions.filter((a) => a.key !== taskKey).reduce((sum, a) => sum + a.minutes, 0) ?? 0;
      const capacity = Math.floor(preferences.weeklyMinutes / preferences.preferredDays.length);
      if (!task || !preferences.preferredDays.includes(weekday(scheduledDate)) || used + task.minutes > capacity) {
        setError("That day does not have enough available time. Move another task or edit your availability first.");
        return;
      }
    }
    return save("/api/search-plan/tasks", { taskKey, status, scheduledDate, weekStart: plan.weekStart });
  }
  return <section id="weekly-plan" aria-labelledby="weekly-plan-title" className="db-content-card min-w-0">
    <div className="flex flex-wrap justify-between items-start gap-3">
      <div><h2 id="weekly-plan-title" className="db-headline text-2xl">Your weekly plan</h2><p className="text-xs text-muted-foreground mt-1">Week of {plan.weekStart} · {timezone}</p></div>
      <span className="rounded-full bg-muted px-3 py-1.5 text-sm font-semibold">{submitted} / {goal} applications</span>
    </div>
    <div className="h-2 rounded-full bg-muted mt-4 overflow-hidden" role="progressbar" aria-label="Weekly application goal" aria-valuemin={0} aria-valuemax={goal} aria-valuenow={Math.min(submitted, goal)}><div className="h-full bg-[#99462a] dark:bg-[#ccff00]" style={{ width: `${Math.min(100, submitted / goal * 100)}%` }} /></div>
    <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{plan.explanation}</p>
    {!hasSavedPreferences && <p className="text-xs text-muted-foreground mt-2">This preview uses suggested availability: 300 minutes per week, Monday–Friday, 30 minutes per application. Edit and save your actual availability below.</p>}
    <p className="text-xs text-muted-foreground mt-2">{plan.plannedMinutes} min planned / {plan.availableMinutes} min available on remaining days. Estimates include preparation and reminders; only submissions count toward your application goal.</p>
    {!plan.paused && plan.shortfall > 0 && <p className="text-sm mt-3 rounded-xl p-3 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200" role="status">{plan.plannedApplications} applications can be scheduled from saved roles; {plan.shortfall} still need suitable roles or more available time. Review your availability or edit your existing goal. Your target has not changed.</p>}
    {!persistenceAvailable && <p role="status" className="text-xs text-muted-foreground mt-3">Task saving is unavailable. Availability and your goal can still be saved; try task actions again after the planning database is available.</p>}
    {error && <p role="alert" className="text-sm text-red-600 mt-3">{error}</p>}
    <details className="mt-4 rounded-xl border border-border p-3">
      <summary className="cursor-pointer font-semibold text-sm min-h-8">Edit goal and availability</summary>
      <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); void save("/api/profile/update-weekly-goal", { weeklyGoal: Number(goalDraft) }); }}>
        <label className="text-sm">Existing weekly goal<input type="number" min={1} max={100} required value={goalDraft} onChange={(e) => setGoalDraft(e.target.value)} className="block w-24 border border-border rounded-lg p-2 mt-1 bg-background" /></label>
        <button type="submit" disabled={busy} className="db-btn-page-primary min-h-10 text-sm">Save goal</button>
      </form>
      <form className="mt-5 space-y-4" onSubmit={(event) => { event.preventDefault(); void save("/api/profile/search-preferences", draft); }}>
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="text-sm">Minutes per week<input type="number" min={0} max={10080} required value={draft.weeklyMinutes} onChange={(e) => setDraft({ ...draft, weeklyMinutes: Number(e.target.value) })} className="block w-full border border-border rounded-lg p-2 mt-1 bg-background" /></label>
          <label className="text-sm">Minutes per application<input type="number" min={5} max={240} required value={draft.applicationMinutes} onChange={(e) => setDraft({ ...draft, applicationMinutes: Number(e.target.value) })} className="block w-full border border-border rounded-lg p-2 mt-1 bg-background" /></label>
          <label className="text-sm">Week starts on<select value={draft.weekStartsOn} onChange={(e) => setDraft({ ...draft, weekStartsOn: Number(e.target.value) as 0 | 1 })} className="block w-full border border-border rounded-lg p-2 mt-1 bg-background"><option value={0}>Sunday</option><option value={1}>Monday</option></select></label>
        </div>
        <fieldset><legend className="text-sm mb-2">Available days</legend><div className="flex flex-wrap gap-x-4 gap-y-2">{DAY_NAMES.map((day, index) => <label key={day} className="flex items-center gap-2 text-sm min-h-9"><input type="checkbox" checked={draft.preferredDays.includes(index)} onChange={(e) => setDraft({ ...draft, preferredDays: e.target.checked ? [...draft.preferredDays, index].sort() : draft.preferredDays.filter((d) => d !== index) })} />{day}</label>)}</div></fieldset>
        <label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={draft.paused} onChange={(e) => setDraft({ ...draft, paused: e.target.checked })} />Pause suggested work (keep my goal)</label>
        <button type="submit" disabled={busy || draft.preferredDays.length === 0} className="db-btn-page-primary min-h-10 text-sm">Save availability</button>
        <p className="text-xs text-muted-foreground">Capacity is shared across your chosen days. Elapsed days do not add extra work to the days remaining.</p>
      </form>
    </details>
    {!plan.paused && <div className="mt-5 space-y-3">{plan.days.filter((day) => day.actions.length > 0).map((day) => <details key={day.date} open={day.date === plan.today} className="border border-border rounded-xl p-3 min-w-0">
      <summary className="font-semibold text-sm cursor-pointer min-h-11">{day.label}<span className="block text-xs font-normal text-muted-foreground mt-1">{day.actions.length} task{day.actions.length === 1 ? "" : "s"} · {day.actions.reduce((sum, task) => sum + task.minutes, 0)} min</span></summary><ul className="grid gap-4 md:grid-cols-3 mt-3">{day.actions.map((task) => <li key={task.key}>
        <Link href={task.href} className="font-medium text-sm hover:underline">{task.title}</Link><p className="text-xs text-muted-foreground mt-1 leading-relaxed">{task.reason}</p><p className="text-xs text-muted-foreground mt-1">{task.minutes} min estimate</p>
        {task.kind !== "reminder" && <div className="flex flex-wrap gap-2 mt-2">
          {task.kind === "prep" || task.kind === "review" || task.kind === "networking" ? <button type="button" disabled={busy || !persistenceAvailable} onClick={() => void saveTask(task.key, "completed")} className="text-xs db-link-primary min-h-11">Mark done</button> : null}
          <button type="button" disabled={busy || !persistenceAvailable} onClick={() => void saveTask(task.key, "dismissed")} className="text-xs text-muted-foreground min-h-11">Skip suggestion</button>
          <label className="text-xs text-muted-foreground">Move to<select aria-label={`Reschedule ${task.title}`} disabled={busy || !persistenceAvailable} value={day.date} onChange={(e) => void saveTask(task.key, "pending", e.target.value)} className="block bg-background border border-border rounded-md p-1 min-h-11 max-w-full">{plan.days.filter((d) => preferences.preferredDays.includes(weekday(d.date)) && (!task.required || d.date <= commitments.find((c) => c.key === task.key)!.dueDate)).map((d) => <option key={d.date} value={d.date}>{d.label}</option>)}</select></label>
        </div>}
      </li>)}</ul>
    </details>)}</div>}
    {completed.length > 0 && <details className="mt-4"><summary className="text-sm cursor-pointer">Completed or skipped suggestions ({completed.length})</summary><ul className="mt-2 space-y-2">{completed.map((state) => <li key={state.task_key} className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">{state.task_key === "weekly-review" ? "Weekly review" : state.task_key.startsWith("application-") ? "Application block" : state.task_key.startsWith("interview:") ? "Interview preparation" : "Assessment reminder"} · {state.status}<button type="button" disabled={busy || !persistenceAvailable} className="db-link-primary min-h-9" onClick={() => void saveTask(state.task_key, "pending")}>Restore</button></li>)}</ul></details>}
  </section>;
}
