import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ApiError, errorResponse, successResponse, validateBody } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyOrigin } from "@/lib/security/csrf";

const schema = z.object({
  overdueReminders:   z.boolean(),
  weeklyDigest:       z.boolean(),
  reEngagementEmails: z.boolean(),
});

export async function POST(request: NextRequest) {
  try {
    if (!verifyOrigin(request)) { throw ApiError.forbidden("Invalid request origin"); }
    const prefs = await validateBody(request, schema);

    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) throw ApiError.unauthorized();

    const rateLimitResult = await checkRateLimit(`update-notifications:${user.id}`, {
      maxRequests: 10,
      windowMs: 60 * 1000,
    });
    if (!rateLimitResult.allowed) throw ApiError.tooManyRequests("Too many requests. Please wait.");

    const { error } = await supabase.auth.updateUser({
      data: {
        notification_prefs: {
          overdue_reminders:    prefs.overdueReminders,
          weekly_digest:        prefs.weeklyDigest,
          re_engagement_emails: prefs.reEngagementEmails,
        },
      },
    });

    if (error) {
      console.error("Failed to update notification prefs:", error);
      throw ApiError.internal("Failed to update notification preferences");
    }

    return successResponse({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
