import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { APPLICATION_STATUSES } from "@/config/constants";
import { ApiError, errorResponse, successResponse, validateBody } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";

const schema = z.object({
  status: z.enum(APPLICATION_STATUSES as unknown as [string, ...string[]]),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) throw ApiError.badRequest("Application ID is required");

    const { status } = await validateBody(request, schema);

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const rl = await checkRateLimit(`app-status:${user.id}`, {
      maxRequests: 60,
      windowMs: 60_000,
    });
    if (!rl.allowed) throw ApiError.tooManyRequests("Too many requests.");

    const { error } = await supabase
      .from("job_applications")
      .update({ status })
      .eq("id", id)
      .eq("user_id", user.id); // explicit user_id guard alongside RLS

    if (error) {
      console.error("[api/applications/status] update failed:", error.message, error.code);
      throw ApiError.internal("Failed to update application status");
    }

    return successResponse({ success: true, status });
  } catch (err) {
    return errorResponse(err);
  }
}
