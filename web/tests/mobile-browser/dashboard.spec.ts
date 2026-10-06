import { test, expect } from "@playwright/test";
import { readSearchPreferences } from "../../lib/job-search/preferences";
import type { TaskState } from "../../lib/job-search/planner";

for (const viewport of [{ width: 320, height: 812 }, { width: 1280, height: 900 }]) {
  test(`weekly goal, recoverable saves and task state at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const state = { goal: 8, submitted: 3, preferences: readSearchPreferences({ weeklyMinutes: 300, weekStartsOn: 1 }), states: [] as TaskState[], reminderComplete: false };
    let failGoal = true;
    await page.route("**/fixture/search-state", (route) => route.fulfill({ json: state }));
    await page.route("**/api/profile/update-weekly-goal", async (route) => {
      if (failGoal) return route.fulfill({ status: 500, json: { error: "Could not save goal" } });
      state.goal = route.request().postDataJSON().weeklyGoal;
      return route.fulfill({ json: { weeklyGoal: state.goal } });
    });
    await page.route("**/api/profile/search-preferences", async (route) => {
      state.preferences = route.request().postDataJSON(); return route.fulfill({ json: { preferences: state.preferences } });
    });
    await page.route("**/api/search-plan/tasks", async (route) => {
      const body = route.request().postDataJSON();
      state.states = [...state.states.filter((s) => s.task_key !== body.taskKey), { task_key: body.taskKey, status: body.status, scheduled_date: body.scheduledDate }];
      return route.fulfill({ json: { success: true } });
    });
    await page.route("**/api/reminders/*", async (route) => {
      state.reminderComplete = route.request().postDataJSON().action === "complete";
      return route.fulfill({ json: { success: true } });
    });
    await page.goto("/dashboard");
    await expect(page.getByText("3 / 8 applications", { exact: true })).toBeVisible();
    await expect(page.getByText(/5 applications remain toward/)).toBeVisible();
    await page.screenshot({ path: test.info().outputPath("dashboard-initial.png"), fullPage: true });
    await page.getByText("Edit goal and availability", { exact: true }).click();
    await page.getByLabel("Existing weekly goal").fill("10");
    await page.getByRole("button", { name: "Save goal", exact: true }).click();
    await expect(page.getByRole("alert")).toHaveText("Could not save goal");
    await expect(page.getByText("3 / 8 applications", { exact: true })).toBeVisible();
    failGoal = false;
    await page.getByRole("button", { name: "Save goal", exact: true }).click();
    await expect(page.getByText("3 / 10 applications", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Mark done", exact: true }).first().click();
    await expect(page.getByText("Completed or skipped suggestions (1)")).toBeVisible();
    await expect(page.getByText("3 / 10 applications", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Complete", exact: true }).click();
    await expect(page.getByText("1 overdue reminder to review.")).toHaveCount(0);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(page.getByText("1 overdue reminder to review.")).toBeVisible();
    await page.getByText("Edit goal and availability", { exact: true }).click();
    await page.getByLabel("Pause suggested work (keep my goal)", { exact: true }).check();
    await page.getByRole("button", { name: "Save availability", exact: true }).click();
    await expect(page.getByText(/Your search is paused/)).toBeVisible();
    await expect(page.getByText("3 / 10 applications", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Next actions" })).toBeVisible();
    const bounds = await page.evaluate(() => ({ width: window.innerWidth, scroll: document.documentElement.scrollWidth }));
    expect(bounds.scroll).toBeLessThanOrEqual(bounds.width);
  });
}
