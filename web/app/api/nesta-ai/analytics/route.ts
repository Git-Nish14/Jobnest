import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getUsageHistory, TOKEN_CAPS } from "@/lib/features/ai-usage";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const rl = await checkRateLimit(`nestai-analytics:${user.id}`, {
      maxRequests: 30,
      windowMs: 60_000,
    });
    if (!rl.allowed) throw ApiError.tooManyRequests();

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("plan, status")
      .eq("user_id", user.id)
      .maybeSingle();

    const isPro = sub?.plan === "pro" && sub?.status === "active";
    const plan = isPro ? "pro" : "free";
    const dailyCap = isPro ? TOKEN_CAPS.pro : TOKEN_CAPS.free;

    // Last 30 days of usage
    const rows = await getUsageHistory(user.id, 30);

    // Today's totals
    const today = new Date().toISOString().slice(0, 10);
    const todayRows = rows.filter((r) => r.date === today);
    const todayTokens = todayRows.reduce(
      (sum, r) => sum + r.input_tokens + r.output_tokens,
      0,
    );
    const todayRequests = todayRows.reduce((sum, r) => sum + r.request_count, 0);

    // All-time totals from the 30-day window
    const totalTokens = rows.reduce(
      (sum, r) => sum + r.input_tokens + r.output_tokens,
      0,
    );
    const totalRequests = rows.reduce((sum, r) => sum + r.request_count, 0);

    // Per-feature breakdown (all-time within window)
    const byFeature: Record<string, { tokens: number; requests: number }> = {};
    for (const row of rows) {
      if (!byFeature[row.feature]) byFeature[row.feature] = { tokens: 0, requests: 0 };
      byFeature[row.feature].tokens   += row.input_tokens + row.output_tokens;
      byFeature[row.feature].requests += row.request_count;
    }

    // Daily chart data (last 14 days, grouped by date)
    const last14 = new Map<string, number>();
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      last14.set(d.toISOString().slice(0, 10), 0);
    }
    for (const row of rows) {
      if (last14.has(row.date)) {
        last14.set(row.date, (last14.get(row.date) ?? 0) + row.input_tokens + row.output_tokens);
      }
    }
    const dailyChart = Array.from(last14.entries()).map(([date, tokens]) => ({
      date,
      tokens,
    }));

    return NextResponse.json({
      plan,
      today: { tokens: todayTokens, requests: todayRequests },
      cap: { daily: dailyCap, used: todayTokens, remaining: Math.max(0, dailyCap - todayTokens) },
      totals: { tokens: totalTokens, requests: totalRequests, days: 30 },
      byFeature,
      dailyChart,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
