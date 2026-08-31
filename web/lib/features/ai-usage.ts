import { createAdminClient } from "@/lib/supabase/admin";

// Daily token caps per plan
export const TOKEN_CAPS = {
  free: 100_000,
  pro:  2_000_000,
} as const;

export type AiFeature =
  | "chat"
  | "resume_audit"
  | "interview_prep"
  | "email_draft"
  | "nestats";

/**
 * Returns the total tokens (input + output) consumed today by this user.
 * Returns null on DB error — callers MUST treat null as "cap reached" (fail-closed)
 * so a DB outage cannot be used to bypass the daily token limit.
 */
export async function getDailyTokenUsage(userId: string): Promise<number | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_daily_token_usage", {
    p_user_id: userId,
  });
  if (error) {
    console.error("[ai-usage] getDailyTokenUsage failed — failing closed:", error.message);
    return null;
  }
  return (data as number) ?? 0;
}

/**
 * Atomically increments today's usage row for the user/feature pair.
 * Fire-and-forget safe — errors are logged but not thrown.
 */
export async function recordTokenUsage(
  userId: string,
  feature: AiFeature,
  inputTokens: number,
  outputTokens: number,
  model: string,
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.rpc("increment_ai_usage", {
      p_user_id:    userId,
      p_feature:    feature,
      p_input_tok:  inputTokens,
      p_output_tok: outputTokens,
      p_model:      model,
    });
    if (error) console.error("[ai-usage] increment_ai_usage failed:", error.message);
  } catch (err) {
    console.error("[ai-usage] recordTokenUsage threw:", err);
  }
}

/**
 * Returns per-feature and total usage for the last N days.
 * Used by the analytics route.
 */
export async function getUsageHistory(
  userId: string,
  days = 30,
): Promise<UsageRow[]> {
  const admin = createAdminClient();
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await admin
    .from("ai_usage")
    .select("date, feature, input_tokens, output_tokens, request_count, model")
    .eq("user_id", userId)
    .gte("date", since.toISOString().slice(0, 10))
    .order("date", { ascending: false });

  if (error) {
    console.error("[ai-usage] getUsageHistory failed:", error.message);
    return [];
  }
  return (data ?? []) as UsageRow[];
}

export interface UsageRow {
  date: string;
  feature: string;
  input_tokens: number;
  output_tokens: number;
  request_count: number;
  model: string | null;
}
