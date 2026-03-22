import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { ApiError, errorResponse, successResponse, validateBody } from "@/lib/api/errors";

const schema = z.object({
  displayName: z
    .string()
    .max(64, "Display name must be 64 characters or fewer")
    .transform((v) => v.trim()),
});

export async function POST(request: NextRequest) {
  try {
    const { displayName } = await validateBody(request, schema);

    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      throw ApiError.unauthorized("You must be logged in");
    }

    const rateLimitResult = checkRateLimit(`update-name:${user.id}`, {
      maxRequests: 10,
      windowMs: 60 * 1000,
    });

    if (!rateLimitResult.allowed) {
      throw ApiError.tooManyRequests("Too many requests. Please wait before trying again.");
    }

    const { error: updateError } = await supabase.auth.updateUser({
      data: { display_name: displayName },
    });

    if (updateError) {
      console.error("Failed to update display name:", updateError);
      throw ApiError.internal("Failed to update display name");
    }

    return successResponse({
      success: true,
      message: "Display name updated successfully",
      displayName,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
