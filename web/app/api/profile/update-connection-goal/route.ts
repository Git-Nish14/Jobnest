import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ApiError, errorResponse, successResponse, validateBody } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyOrigin } from "@/lib/security/csrf";

const schema = z.object({
  weeklyConnectionGoal: z.number().int().min(1).max(50),
});

export async function POST(request: NextRequest) {
  try {
    if (!verifyOrigin(request)) throw ApiError.forbidden("Invalid request origin");

    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw ApiError.unauthorized();

    const rl = await checkRateLimit(`update-connection-goal:${user.id}`, {
      maxRequests: 20,
      windowMs: 60_000,
    });
    if (!rl.allowed) throw ApiError.tooManyRequests("Too many requests. Please wait.");

    const body = await validateBody(request, schema);

    const { error } = await supabase.auth.updateUser({
      data: { weekly_connection_goal: body.weeklyConnectionGoal },
    });

    if (error) {
      console.error("Failed to update connection goal:", error);
      throw ApiError.internal("Failed to update connection goal");
    }

    return successResponse({ weeklyConnectionGoal: body.weeklyConnectionGoal });
  } catch (error) {
    return errorResponse(error);
  }
}
