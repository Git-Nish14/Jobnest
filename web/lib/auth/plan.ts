/**
 * Plan enforcement helpers.
 *
 * Security design:
 *  - Always reads from the DB via the admin client (not user-supplied JWT claims)
 *    so the plan cannot be spoofed by a forged access token.
 *  - Fails CLOSED: any DB error → treat as "free" (never accidentally grant Pro).
 *  - Caching is intentionally skipped here — the caller is an API route that runs
 *    once per request; adding a cache would risk serving stale plan data.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError } from "@/lib/api/errors";

export type Plan = "free" | "pro";

/**
 * Returns the current billing plan for a user.
 * Always returns "free" on any error — fail closed.
 */
export async function getUserPlan(userId: string): Promise<Plan> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("subscriptions")
      .select("plan, status")
      .eq("user_id", userId)
      .maybeSingle();

    if (data?.plan === "pro" && data?.status === "active") return "pro";
    return "free";
  } catch {
    // Fail closed — treat unknown as free
    return "free";
  }
}

/**
 * Throws ApiError 402 if the user is not on the Pro plan.
 *
 * Usage in any API route:
 *   await requirePro(user.id, "Advanced analytics");
 */
export async function requirePro(userId: string, featureName?: string): Promise<void> {
  const plan = await getUserPlan(userId);
  if (plan !== "pro") {
    const feature = featureName ? `"${featureName}" is a` : "This is a";
    throw ApiError.paymentRequired(
      `${feature} Pro feature. Upgrade at /pricing to unlock it.`
    );
  }
}
