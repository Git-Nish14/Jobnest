import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ApiError, errorResponse, successResponse, validateBody } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyOrigin } from "@/lib/security/csrf";
import { calendarDate, daysBetween, validTimezone, weekday, weekStart } from "@/lib/job-search/calendar";
import { readSearchPreferences } from "@/lib/job-search/preferences";

const schema = z.object({
  taskKey: z.string().max(120).regex(/^(weekly-review|outreach-[1-3]|application-\d{1,3}|(interview|assessment|reminder):[0-9a-f-]{36})$/),
  weekStart: z.iso.date(),
  status: z.enum(["pending", "completed", "dismissed"]),
  scheduledDate: z.iso.date().nullable(),
}).strict();

export async function PATCH(request: NextRequest) {
  try {
    if (!verifyOrigin(request)) throw ApiError.forbidden("Invalid request origin");
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw ApiError.unauthorized();
    const limit = await checkRateLimit(`plan-task:${user.id}`, { maxRequests: 60, windowMs: 60_000 });
    if (!limit.allowed) throw ApiError.tooManyRequests("Too many requests");
    const body = await validateBody(request, schema);
    const today = calendarDate(new Date(), validTimezone(user.user_metadata?.timezone));
    const preferences = readSearchPreferences(user.user_metadata?.search_preferences);
    if (body.weekStart !== weekStart(today, preferences.weekStartsOn)) throw ApiError.conflict("The week has changed. Refresh your plan.");
    if (body.scheduledDate && (body.scheduledDate < today || daysBetween(body.weekStart, body.scheduledDate) > 6 || body.scheduledDate < body.weekStart)) throw ApiError.badRequest("Choose a remaining day in this week");
    if (body.scheduledDate && !preferences.preferredDays.includes(weekday(body.scheduledDate))) throw ApiError.badRequest("Choose one of your available days");
    if (body.taskKey.startsWith("application-") && body.status === "completed") throw ApiError.badRequest("Log an actual application to make progress toward your goal");
    const { error: saveError } = await supabase.from("search_plan_tasks").upsert({
      user_id: user.id, week_start: body.weekStart, task_key: body.taskKey,
      status: body.status, scheduled_date: body.scheduledDate, updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,week_start,task_key" });
    if (saveError) throw ApiError.internal("Could not save this task. Try again.");
    return successResponse({ success: true });
  } catch (error) { return errorResponse(error); }
}
