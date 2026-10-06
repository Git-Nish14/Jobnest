import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchPreferencesSchema } from "@/lib/job-search/preferences";
import { ApiError, errorResponse, successResponse, validateBody } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyOrigin } from "@/lib/security/csrf";

export async function POST(request: NextRequest) {
  try {
    if (!verifyOrigin(request)) throw ApiError.forbidden("Invalid request origin");
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw ApiError.unauthorized();
    const limit = await checkRateLimit(`search-preferences:${user.id}`, { maxRequests: 20, windowMs: 60_000 });
    if (!limit.allowed) throw ApiError.tooManyRequests("Too many requests");
    const preferences = await validateBody(request, searchPreferencesSchema);
    const { error: saveError } = await supabase.auth.updateUser({ data: { search_preferences: preferences } });
    if (saveError) throw ApiError.internal("Could not save availability");
    return successResponse({ preferences });
  } catch (error) { return errorResponse(error); }
}
