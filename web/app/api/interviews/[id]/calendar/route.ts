import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { interviewCalendar } from "@/lib/utils/interview-calendar";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw ApiError.unauthorized();
    const { id } = await context.params;
    if (!z.uuid().safeParse(id).success) throw ApiError.badRequest("Invalid interview identifier.");
    if (!(await checkRateLimit(`interview-calendar:${user.id}`, { maxRequests: 30, windowMs: 60_000 })).allowed) throw ApiError.tooManyRequests();
    const result = await supabase.from("interviews").select("*").eq("id", id).eq("user_id", user.id).single();
    if (result.error || !result.data) throw ApiError.notFound("Interview not found.");
    const application = await supabase.from("job_applications").select("company, position").eq("id", result.data.application_id).eq("user_id", user.id).single();
    if (application.error || !application.data) throw ApiError.notFound("Application not found.");
    return new Response(interviewCalendar(result.data, application.data), { headers: {
      "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="interview-${id}.ics"`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) { return errorResponse(error); }
}
