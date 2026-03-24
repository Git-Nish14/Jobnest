import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ApiError, errorResponse, successResponse, validateBody } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";

const schema = z.object({
  aboutMe: z.string().max(2000, "About Me must be 2000 characters or fewer").trim(),
});

export async function POST(request: NextRequest) {
  try {
    const { aboutMe } = await validateBody(request, schema);

    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) throw ApiError.unauthorized();

    const rateLimitResult = checkRateLimit(`update-about-me:${user.id}`, {
      maxRequests: 10,
      windowMs: 60 * 1000,
    });
    if (!rateLimitResult.allowed) throw ApiError.tooManyRequests("Too many requests. Please wait.");

    const { error } = await supabase.auth.updateUser({
      data: { about_me: aboutMe || null },
    });

    if (error) {
      console.error("Failed to update about_me:", error);
      throw ApiError.internal("Failed to update About Me");
    }

    return successResponse({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
