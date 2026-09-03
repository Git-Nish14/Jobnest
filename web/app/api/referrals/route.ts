import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { verifyOrigin } from "@/lib/security/csrf";
import { checkRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/**
 * GET /api/referrals
 * Returns (or lazily creates) the authenticated user's referral code + stats.
 */
export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const rl = await checkRateLimit(`referrals-get:${user.id}`, {
      maxRequests: 20,
      windowMs: 60_000,
    });
    if (!rl.allowed) throw ApiError.tooManyRequests();

    const admin = createAdminClient();

    // Atomic upsert — safe against concurrent first-requests (e.g. two tabs opening
    // simultaneously). ON CONFLICT DO NOTHING means a second concurrent insert simply
    // becomes a no-op instead of a 500-inducing unique-constraint violation.
    const { error: upsertErr } = await admin
      .from("user_referral_codes")
      .upsert({ user_id: user.id }, { onConflict: "user_id", ignoreDuplicates: true });

    if (upsertErr) {
      throw ApiError.internal("Could not create referral code.");
    }

    // The row is now guaranteed to exist — fetch it.
    const { data: codeRow, error: fetchErr } = await admin
      .from("user_referral_codes")
      .select("code, click_count, signup_count, converted_count, created_at")
      .eq("user_id", user.id)
      .single();

    if (fetchErr || !codeRow) {
      throw ApiError.internal("Could not load referral code.");
    }

    // Fetch referral events for this user's code (capped to prevent unbounded read)
    const { data: events } = await admin
      .from("user_referral_events")
      .select("status, reward_granted, created_at")
      .eq("referrer_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://jobnest.nishpatel.dev";

    return NextResponse.json({
      code:       codeRow.code,
      referralUrl: `${appUrl}/signup?ref=${codeRow.code}`,
      stats: {
        clicks:    codeRow.click_count,
        signups:   codeRow.signup_count,
        converted: codeRow.converted_count,
      },
      events: (events ?? []).map((e) => ({
        status:        e.status,
        rewardGranted: e.reward_granted,
        joinedAt:      e.created_at,
      })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * POST /api/referrals/track  (called via the body field action:"track_click")
 * Increments the click counter for a referral code (public — no auth required).
 * Rate-limited by IP to prevent click-farming.
 */
export async function POST(request: NextRequest) {
  try {
    if (!verifyOrigin(request)) throw ApiError.forbidden("Invalid request origin.");

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";

    const rl = await checkRateLimit(`ref-click:${ip}`, {
      maxRequests: 20,
      windowMs: 60_000,
    });
    if (!rl.allowed) throw ApiError.tooManyRequests();

    const body = await request.json().catch(() => ({})) as { code?: string };
    const code = typeof body.code === "string" ? body.code.trim().toLowerCase() : null;

    if (!code || !/^[0-9a-f]{8}$/.test(code)) {
      throw ApiError.badRequest("Invalid referral code.");
    }

    const admin = createAdminClient();

    // Atomic increment — ignore errors (unknown code = no-op, never leaks)
    // @ts-expect-error — increment_referral_clicks is a custom RPC not in generated types
    await admin.rpc("increment_referral_clicks", { p_code: code }).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
