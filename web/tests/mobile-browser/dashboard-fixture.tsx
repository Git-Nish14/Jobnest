import { useEffect, useState } from "react";
import { NextActions } from "@/components/dashboard/next-actions";
import { WeeklySearchPlan } from "@/components/dashboard/weekly-search-plan";
import { readSearchPreferences, type SearchPreferences } from "@/lib/job-search/preferences";
import type { SearchAction, TaskState } from "@/lib/job-search/planner";

export const initialDashboardState = {
  goal: 8, submitted: 3, preferences: readSearchPreferences({ weeklyMinutes: 300, weekStartsOn: 1 }),
  states: [] as TaskState[], reminderComplete: false,
};
const commitments: SearchAction[] = [
  { key: "reminder:11111111-1111-4111-8111-111111111111", reminderId: "11111111-1111-4111-8111-111111111111", kind: "reminder", title: "Follow up with Acme", reason: "An overdue application reminder", href: "/applications/fixture", minutes: 10, dueDate: "2026-10-04", required: true },
  { key: "interview:22222222-2222-4222-8222-222222222222", kind: "prep", title: "Prepare for Acme interview", reason: "Behavioral interview tomorrow", href: "/prep?interview=22222222-2222-4222-8222-222222222222", minutes: 45, dueDate: "2026-10-06", required: true },
];
const roles = Array.from({ length: 8 }, (_, i) => ({ id: `role-${i}`, company: "A company with a longer name", position: "Senior engineer, infrastructure and developer experience" }));

export function DashboardFixture() {
  const [state, setState] = useState(initialDashboardState);
  useEffect(() => {
    const refresh = () => { void fetch("/fixture/search-state").then((res) => res.json()).then((next: { goal: number; submitted: number; preferences: SearchPreferences; states: TaskState[]; reminderComplete: boolean }) => setState(next)); };
    window.addEventListener("fixture:refresh", refresh);
    return () => window.removeEventListener("fixture:refresh", refresh);
  }, []);
  const actions = commitments.filter((a) => a.kind !== "reminder" || !state.reminderComplete);
  return <div className="space-y-5"><h1 className="db-headline text-3xl">Your job search</h1>
    <NextActions actions={actions} today="2026-10-05" totalReminders={state.reminderComplete ? 0 : 1} overdueCount={state.reminderComplete ? 0 : 1} />
    <WeeklySearchPlan key={JSON.stringify(state)} goal={state.goal} submitted={state.submitted} preferences={state.preferences} now="2026-10-05T17:00:00Z" timezone="America/Chicago" commitments={actions} savedRoles={roles} states={state.states} persistenceAvailable />
  </div>;
}
