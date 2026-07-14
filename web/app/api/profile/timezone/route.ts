import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyOrigin } from "@/lib/security/csrf";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { ApiError, errorResponse, successResponse } from "@/lib/api/errors";

export async function POST(request: NextRequest) {
  try {
    if (!verifyOrigin(request)) throw ApiError.forbidden("Invalid request origin");

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized("You must be logged in");

    const rl = await checkRateLimit(`timezone:${user.id}`, { maxRequests: 20, windowMs: 60 * 1000 });
    if (!rl.allowed) throw ApiError.tooManyRequests("Too many requests. Please wait before trying again.");

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw ApiError.badRequest("Invalid JSON");
    }

    const { timezone, utcOffsetHours } = body as { timezone?: unknown; utcOffsetHours?: unknown };

    if (typeof utcOffsetHours !== "number" || utcOffsetHours < -14 || utcOffsetHours > 14) {
      throw ApiError.badRequest("Invalid utcOffsetHours: must be a number between -14 and 14");
    }
    if (typeof timezone !== "string" || timezone.length === 0 || timezone.length > 64) {
      throw ApiError.badRequest("Invalid timezone string");
    }

    const admin = createAdminClient();
    const { data: existing } = await admin.auth.admin.getUserById(user.id);
    const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...(existing?.user?.user_metadata ?? {}),
        utc_offset_hours: utcOffsetHours,
        timezone,
      },
    });

    if (updateError) throw ApiError.internal("Failed to save timezone");

    return successResponse({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
