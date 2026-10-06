import { describe, expect, it } from "vitest";
import { buildWeeklyPlan, type SearchAction } from "@/lib/job-search/planner";
import { readSearchPreferences, readWeeklyGoal, searchPreferencesSchema } from "@/lib/job-search/preferences";
import { calendarDate, validTimezone } from "@/lib/job-search/calendar";

const base = {
  now: new Date("2026-10-05T17:00:00Z"), timezone: "America/Chicago", goal: 8, submitted: 3,
  preferences: readSearchPreferences({ weeklyMinutes: 300, applicationMinutes: 30, preferredDays: [1, 2, 3, 4, 5], weekStartsOn: 1, paused: false }),
  commitments: [] as SearchAction[], savedRoles: Array.from({ length: 10 }, (_, i) => ({ id: `role-${i}`, company: "Acme", position: `Engineer ${i}` })),
};
const tasks = (plan: ReturnType<typeof buildWeeklyPlan>) => plan.days.flatMap((d) => d.actions);

describe("weekly plan using the existing goal", () => {
  it("schedules only remaining applications, never eight more after three submissions", () => {
    const plan = buildWeeklyPlan(base);
    expect(plan.remaining).toBe(5);
    expect(plan.plannedApplications).toBe(5);
    expect(tasks(plan).filter((t) => t.kind === "application")).toHaveLength(5);
    expect(plan.goal).toBe(8);
  });
  it("balances application blocks across chosen days", () => {
    const plan = buildWeeklyPlan(base);
    expect(plan.days.filter((d) => d.actions.some((t) => t.kind === "application"))).toHaveLength(5);
  });
  it("uses remaining capacity on Friday instead of a whole week's capacity", () => {
    const plan = buildWeeklyPlan({ ...base, now: new Date("2026-10-09T17:00:00Z") });
    expect(plan.availableMinutes).toBe(60);
    expect(plan.plannedApplications).toBe(2);
    expect(plan.shortfall).toBe(3);
    expect(plan.plannedMinutes).toBeLessThanOrEqual(60);
  });
  it("reserves preparation before optional applications", () => {
    const commitment: SearchAction = { key: "interview:test", title: "Prepare", reason: "Interview", href: "/prep", minutes: 45, dueDate: "2026-10-09", kind: "prep", required: true };
    const plan = buildWeeklyPlan({ ...base, now: new Date("2026-10-09T17:00:00Z"), commitments: [commitment] });
    expect(tasks(plan)[0].kind).toBe("prep");
    expect(plan.plannedApplications).toBe(0);
    expect(plan.plannedMinutes).toBeLessThanOrEqual(plan.availableMinutes);
  });
  it("surfaces commitments that cannot fit without overloading the plan", () => {
    const plan = buildWeeklyPlan({ ...base, preferences: { ...base.preferences, weeklyMinutes: 0 }, commitments: [{ key: "assessment:test", title: "Assessment", reason: "Due", href: "/prep", minutes: 60, dueDate: "2026-10-06", kind: "assessment", required: true }] });
    expect(plan.plannedMinutes).toBe(0);
    expect(plan.explanation).toContain("do not fit");
  });
  it("substitutes sourcing for absent saved roles without counting it as an application", () => {
    const plan = buildWeeklyPlan({ ...base, savedRoles: [] });
    expect(plan.plannedApplications).toBe(0);
    expect(plan.shortfall).toBe(5);
    expect(tasks(plan).filter((t) => t.kind === "sourcing")).toHaveLength(5);
  });
  it("stops catch-up work when the goal is met", () => {
    const plan = buildWeeklyPlan({ ...base, submitted: 10 });
    expect(plan.remaining).toBe(0);
    expect(tasks(plan).filter((t) => t.kind === "application" || t.kind === "sourcing")).toHaveLength(0);
    expect(plan.goal).toBe(8);
  });
  it("preserves the goal and proposes no work when paused", () => {
    const plan = buildWeeklyPlan({ ...base, preferences: { ...base.preferences, paused: true } });
    expect(tasks(plan)).toEqual([]);
    expect(plan.goal).toBe(8);
  });
  it("restores skipped work without increasing quota", () => {
    const plan = buildWeeklyPlan({ ...base, states: [{ task_key: "application-4", status: "dismissed", scheduled_date: null }] });
    expect(plan.plannedApplications).toBe(4);
    expect(plan.remaining).toBe(5);
  });
  it("honors a reschedule that fits remaining availability", () => {
    const plan = buildWeeklyPlan({ ...base, states: [{ task_key: "application-4", status: "pending", scheduled_date: "2026-10-07" }] });
    expect(plan.days.find((d) => d.date === "2026-10-07")?.actions.some((t) => t.key === "application-4")).toBe(true);
  });
  it("does not schedule on an unavailable day even if a saved override asks for one", () => {
    const plan = buildWeeklyPlan({ ...base, states: [{ task_key: "application-4", status: "pending", scheduled_date: "2026-10-11" }] });
    expect(plan.days.find((d) => d.date === "2026-10-11")?.actions).toEqual([]);
  });
  it("handles weeks with no selected days remaining without division errors", () => {
    const plan = buildWeeklyPlan({ ...base, now: new Date("2026-10-11T17:00:00Z") });
    expect(plan.availableMinutes).toBe(0);
    expect(plan.shortfall).toBe(5);
  });
  it("validates capacity and preferred days without accepting a separate goal", () => {
    expect(searchPreferencesSchema.safeParse({ preferredDays: [] }).success).toBe(false);
    expect(searchPreferencesSchema.safeParse({ preferredDays: [1, 1] }).success).toBe(false);
    expect(searchPreferencesSchema.safeParse({ weeklyMinutes: -1 }).success).toBe(false);
    expect(searchPreferencesSchema.safeParse({ weeklyGoal: 30 }).success).toBe(false);
    expect(readWeeklyGoal(12)).toBe(12);
    expect(readWeeklyGoal(12.5)).toBe(5);
  });
  it("computes user-local dates across UTC midnight with an invalid-zone fallback", () => {
    expect(calendarDate(new Date("2026-10-05T01:00:00Z"), "America/Chicago")).toBe("2026-10-04");
    expect(validTimezone("not-a-zone")).toBe("UTC");
  });
});
