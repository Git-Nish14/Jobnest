import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ApiError, errorResponse, successResponse, validateBody } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyOrigin } from "@/lib/security/csrf";

const schema = z.object({
  nestaiContext: z.string().max(2000, "NESTAi context must be 2000 characters or fewer").trim(),
});

export async function POST(request: NextRequest) {
  try {
    if (!verifyOrigin(request)) throw ApiError.forbidden("Invalid request origin");

    const { nestaiContext } = await validateBody(request, schema);

    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw ApiError.unauthorized();

    const rl = await checkRateLimit(`update-nestai-context:${user.id}`, {
      maxRequests: 10,
      windowMs: 60 * 1000,
    });
    if (!rl.allowed) throw ApiError.tooManyRequests("Too many requests. Please wait.");

    const { error } = await supabase.auth.updateUser({
      data: { nestai_context: nestaiContext || null },
    });

    if (error) throw ApiError.internal("Failed to update NESTAi context");

    return successResponse({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
