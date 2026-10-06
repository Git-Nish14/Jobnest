import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { makeChain } from "@/tests/helpers/supabase-mock";
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/security/csrf", () => ({ verifyOrigin: vi.fn(() => true) }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: vi.fn(async () => ({ allowed: true })) }));
import { createClient } from "@/lib/supabase/server";
import { verifyOrigin } from "@/lib/security/csrf";
import { PATCH as taskPatch } from "@/app/api/search-plan/tasks/route";
import { POST as preferencesPost } from "@/app/api/profile/search-preferences/route";
import { PATCH as reminderPatch } from "@/app/api/reminders/[id]/route";

const reminderId = "11111111-1111-4111-8111-111111111111";
const request = (body: unknown, method = "PATCH") => new NextRequest("http://localhost/api/search-plan/tasks", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
let chain: ReturnType<typeof makeChain>;
let updateUser: ReturnType<typeof vi.fn>;
let from: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-06T17:00:00Z"));
  vi.mocked(verifyOrigin).mockReturnValue(true);
  chain = makeChain({ data: { id: reminderId }, error: null });
  from = vi.fn().mockReturnValue(chain);
  updateUser = vi.fn().mockResolvedValue({ error: null });
  vi.mocked(createClient).mockResolvedValue({ from, auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "owner", user_metadata: { timezone: "America/Chicago" } } }, error: null }), updateUser } } as never);
});
afterEach(() => vi.useRealTimers());
const task = { taskKey: "weekly-review", weekStart: "2026-10-04", status: "completed", scheduledDate: null };

describe("planner persistence boundaries", () => {
  it("saves only the authenticated owner's task state", async () => {
    expect((await taskPatch(request(task))).status).toBe(200);
    expect(chain.upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: "owner", week_start: "2026-10-04" }), expect.anything());
  });
  it("rejects a forged user ID", async () => expect((await taskPatch(request({ ...task, user_id: "other" }))).status).toBe(422));
  it("rejects task completion that could falsely satisfy the application goal", async () => expect((await taskPatch(request({ ...task, taskKey: "application-4" }))).status).toBe(400));
  it("rejects a stale week rather than editing the new week's plan", async () => expect((await taskPatch(request({ ...task, weekStart: "2026-09-27" }))).status).toBe(409));
  it("rejects past or unavailable reschedule days", async () => {
    expect((await taskPatch(request({ ...task, scheduledDate: "2026-10-05" }))).status).toBe(400);
    expect((await taskPatch(request({ ...task, scheduledDate: "2026-10-10" }))).status).toBe(400);
  });
  it("never overwrites the existing weekly goal when saving availability", async () => {
    expect((await preferencesPost(request({ weeklyMinutes: 180, preferredDays: [2, 4] }, "POST"))).status).toBe(200);
    expect(updateUser).toHaveBeenCalledWith({ data: { search_preferences: expect.objectContaining({ weeklyMinutes: 180 }) } });
    expect((await preferencesPost(request({ weeklyGoal: 99 }, "POST"))).status).toBe(422);
  });
  it("requires CSRF and authentication for mutations", async () => {
    vi.mocked(verifyOrigin).mockReturnValue(false);
    expect((await taskPatch(request(task))).status).toBe(403);
    vi.mocked(verifyOrigin).mockReturnValue(true);
    vi.mocked(createClient).mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) }, from } as never);
    expect((await taskPatch(request(task))).status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });
  it("surfaces a failed task save", async () => {
    chain.upsert = vi.fn().mockResolvedValue({ error: { message: "offline" } });
    expect((await taskPatch(request(task))).status).toBe(500);
  });
});

describe("reminder actions", () => {
  const params = { params: Promise.resolve({ id: reminderId }) };
  it("scopes completion to the owner and can reopen it", async () => {
    expect((await reminderPatch(request({ action: "complete" }), params)).status).toBe(200);
    expect(chain.eq).toHaveBeenCalledWith("user_id", "owner");
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ is_completed: true }));
    expect((await reminderPatch(request({ action: "reopen" }), params)).status).toBe(200);
    expect(chain.update).toHaveBeenLastCalledWith({ is_completed: false, completed_at: null });
  });
  it("rejects a snooze in the past", async () => expect((await reminderPatch(request({ action: "snooze", remindAt: "2026-10-05T12:00:00Z" }), params)).status).toBe(400));
  it("does not report success for an inaccessible reminder", async () => {
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    expect((await reminderPatch(request({ action: "complete" }), params)).status).toBe(404);
  });
});
