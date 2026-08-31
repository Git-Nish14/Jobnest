import { createAdminClient } from "@/lib/supabase/admin";

export type FlagName =
  | "pricing_cta_variant_b"
  | "ai_usage_dashboard"
  | "referral_program"
  | "rag_semantic_search";

export interface FeatureFlag {
  flag_name: string;
  enabled: boolean;
  enabled_for_plans: string[];
  rollout_percentage: number;
}

export interface ResolvedFlags {
  [flagName: string]: boolean;
}

/**
 * Stable, deterministic hash of (userId + flagName) → integer 0–99.
 * Same user always gets the same variant for a given flag.
 */
function rolloutBucket(userId: string, flagName: string): number {
  const input = `${userId}:${flagName}`;
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i);
    hash = hash >>> 0; // keep as unsigned 32-bit
  }
  return hash % 100;
}

/**
 * Fetch all feature flags and resolve which ones are active for this user.
 * Falls back to all-disabled if the DB is unreachable.
 */
export async function resolveFlags(
  userId: string,
  plan: "free" | "pro",
): Promise<ResolvedFlags> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("feature_flags")
      .select("flag_name, enabled, enabled_for_plans, rollout_percentage");

    if (error || !data) return {};

    const result: ResolvedFlags = {};

    for (const flag of data as FeatureFlag[]) {
      if (!flag.enabled) { result[flag.flag_name] = false; continue; }

      // Plan gate: if the flag restricts plans, the user's plan must be listed
      const planOk =
        flag.enabled_for_plans.length === 0 ||
        flag.enabled_for_plans.includes(plan);

      if (!planOk) { result[flag.flag_name] = false; continue; }

      // Rollout gate: deterministic bucket assignment
      result[flag.flag_name] =
        rolloutBucket(userId, flag.flag_name) < flag.rollout_percentage;
    }

    return result;
  } catch {
    return {};
  }
}

/**
 * Lightweight cookie-based variant for anonymous visitors (no DB needed).
 * Returns 'a' or 'b'. Sets the cookie if it doesn't exist.
 *
 * Call server-side in a Next.js Route Handler or page:
 *   const variant = await getAnonymousVariant(cookieStore, 'pricing_hero');
 */
export function getAnonymousVariant(
  cookieValue: string | undefined,
): "a" | "b" {
  if (cookieValue === "a" || cookieValue === "b") return cookieValue;
  // Deterministically assign — if no cookie, default to 'a'
  // (actual randomisation happens when the cookie is first set by the client)
  return "a";
}
