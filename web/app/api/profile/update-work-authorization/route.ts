import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ApiError, errorResponse, successResponse, validateBody } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyOrigin } from "@/lib/security/csrf";
import { WORK_AUTHORIZATION_OPTIONS } from "@/config";

const schema = z.object({
  workAuthorization: z
    .enum(WORK_AUTHORIZATION_OPTIONS, { message: "Please select a valid work authorization status" })
    .nullable(),
  optStartDate: z.string().date("Invalid date format — use YYYY-MM-DD").nullable().optional(),
  stemExtension: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    if (!verifyOrigin(request)) { throw ApiError.forbidden("Invalid request origin"); }
    const { workAuthorization, optStartDate, stemExtension } = await validateBody(request, schema);

    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw ApiError.unauthorized();

    const rateLimitResult = await checkRateLimit(`update-work-auth:${user.id}`, {
      maxRequests: 10,
      windowMs: 60 * 1000,
    });
    if (!rateLimitResult.allowed) throw ApiError.tooManyRequests("Too many requests. Please wait.");

    // Build metadata update — only include OPT fields when relevant
    const metadataUpdate: Record<string, unknown> = {
      work_authorization: workAuthorization ?? null,
    };

    if (workAuthorization === "OPT (F-1)") {
      metadataUpdate.opt_start_date = optStartDate ?? null;
      metadataUpdate.stem_extension = stemExtension ?? false;
    } else {
      // Clear OPT fields when switching away from OPT
      metadataUpdate.opt_start_date = null;
      metadataUpdate.stem_extension = false;
    }

    const { error } = await supabase.auth.updateUser({ data: metadataUpdate });

    if (error) {
      console.error("Failed to update work_authorization:", error);
      throw ApiError.internal("Failed to update work authorization");
    }

    return successResponse({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
