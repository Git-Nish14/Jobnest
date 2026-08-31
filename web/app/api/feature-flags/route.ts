import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { resolveFlags } from "@/lib/features/flags";

export const dynamic = "force-dynamic";

/**
 * GET /api/feature-flags
 * Returns a map of { flagName: boolean } for the authenticated user.
 * Resolved using plan membership + deterministic rollout bucket.
 */
export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("plan, status")
      .eq("user_id", user.id)
      .maybeSingle();

    const plan = sub?.plan === "pro" && sub?.status === "active" ? "pro" : "free";
    const flags = await resolveFlags(user.id, plan);

    return NextResponse.json({ flags }, {
      headers: {
        // no-store: flags are user-specific; stale cached flags could
        // expose a feature to a user who was removed from the rollout,
        // or hide a security-relevant flag disable from taking effect.
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
