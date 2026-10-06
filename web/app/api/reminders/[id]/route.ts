import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ApiError, errorResponse, successResponse, validateBody } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyOrigin } from "@/lib/security/csrf";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("complete") }).strict(),
  z.object({ action: z.literal("reopen") }).strict(),
  z.object({ action: z.literal("snooze"), remindAt: z.iso.datetime({ offset: true }) }).strict(),
]);

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!verifyOrigin(request)) throw ApiError.forbidden("Invalid request origin");
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) throw ApiError.badRequest("Invalid reminder ID");
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw ApiError.unauthorized();
    const limit = await checkRateLimit(`reminder-action:${user.id}`, { maxRequests: 60, windowMs: 60_000 });
    if (!limit.allowed) throw ApiError.tooManyRequests("Too many requests");
    const body = await validateBody(request, schema);
    if (body.action === "snooze" && Date.parse(body.remindAt) <= Date.now()) throw ApiError.badRequest("Choose a future reminder time");
    const updates = body.action === "snooze" ? { remind_at: body.remindAt, is_completed: false, completed_at: null }
      : { is_completed: body.action === "complete", completed_at: body.action === "complete" ? new Date().toISOString() : null };
    const { data, error: saveError } = await supabase.from("reminders").update(updates)
      .eq("id", id).eq("user_id", user.id).select("id").maybeSingle();
    if (saveError) throw ApiError.internal("Could not update reminder");
    if (!data) throw ApiError.notFound("Reminder not found");
    return successResponse({ success: true });
  } catch (error) { return errorResponse(error); }
}
