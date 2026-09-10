import { createAdminClient } from "@/lib/supabase/admin";

// Daily token caps per plan
export const TOKEN_CAPS = {
  free: 100_000,
  pro:  2_000_000,
} as const;

// ── Redis-based atomic token cap ──────────────────────────────────────────────
// Uses Upstash REST API (same env vars as the doc-cache in nesta-ai/route.ts).
// Falls back to the DB-based getDailyTokenUsage check when Redis is unavailable.

function tokenCapKey(userId: string, date: string) {
  return `token-cap:${userId}:${date}`;
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function utcMidnightTs(): number {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

async function redisPipeline(commands: unknown[][]): Promise<unknown[] | null> {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(commands),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as Array<{ result: unknown }>;
    return json.map((r) => r.result);
  } catch {
    return null;
  }
}

/**
 * Atomically reserves `tokens` against the daily cap using Redis INCRBY.
 * Returns:
 *  - null  → both Redis and DB are unavailable; caller should return 503
 *  - { allowed: false, used }  → cap exceeded; reservation undone
 *  - { allowed: true,  used, midnightTs }  → reservation committed in Redis
 *
 * `midnightTs` is the Unix timestamp of the next UTC midnight; pass it to
 * `recordRedisOutputTokens` in the stream flush to update the Redis counter
 * for output tokens without recomputing the expiry.
 */
export async function checkAndReserveTokens(
  userId: string,
  cap: number,
  tokens: number,
): Promise<{ allowed: boolean; used: number; midnightTs: number } | null> {
  const date       = todayUtc();
  const key        = tokenCapKey(userId, date);
  const midnightTs = utcMidnightTs();

  // Atomic: INCRBY then EXPIREAT NX (sets TTL only if none exists yet)
  const results = await redisPipeline([
    ["INCRBY",   key, tokens],
    ["EXPIREAT", key, midnightTs, "NX"],
  ]);

  if (results !== null) {
    const newTotal = results[0] as number;
    if (newTotal > cap) {
      // Undo the reservation — cap exceeded.
      // If DECRBY fails the counter is inflated for the rest of the day (fail-safe:
      // user gets less quota, never more), but we must log it for operational visibility.
      const undone = await redisPipeline([["DECRBY", key, tokens]]);
      if (undone === null) {
        console.error("[ai-usage] DECRBY failed after cap exceeded — counter may be inflated for user:", userId);
      }
      return { allowed: false, used: newTotal - tokens, midnightTs };
    }
    return { allowed: true, used: newTotal, midnightTs };
  }

  // Redis unavailable — fall back to DB (carries TOCTOU risk but beats a 503)
  console.warn("[ai-usage] Redis unavailable; falling back to DB cap check");
  const current = await getDailyTokenUsage(userId);
  if (current === null) return null;
  if (current + tokens > cap) return { allowed: false, used: current, midnightTs };
  return { allowed: true, used: current + tokens, midnightTs };
}

/**
 * Increments the Redis daily counter for output tokens (called from stream flush).
 * Fire-and-forget — errors are logged but not thrown.
 */
export async function recordRedisOutputTokens(
  userId: string,
  outputTokens: number,
  midnightTs: number,
): Promise<void> {
  const key = tokenCapKey(userId, todayUtc());
  await redisPipeline([
    ["INCRBY",   key, outputTokens],
    ["EXPIREAT", key, midnightTs, "NX"],
  ]);
}

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
