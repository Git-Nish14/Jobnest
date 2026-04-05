import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { ApiError, errorResponse } from "@/lib/api/errors";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) throw ApiError.unauthorized();

    // Generous rate limit — this is polled periodically by the notification bell
    const rl = await checkRateLimit(`notifications-count:${user.id}`, {
      maxRequests: 60,
      windowMs: 60_000,
    });
    if (!rl.allowed) throw ApiError.tooManyRequests("Too many requests.");

    const now = new Date().toISOString();
    // 24 hours from now for "upcoming" interviews
    const in24h = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const [{ count: overdueCount }, { count: upcomingCount }] = await Promise.all([
      // Overdue reminders: not completed, remind_at in the past
      supabase
        .from("reminders")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_completed", false)
        .lt("remind_at", now),

      // Upcoming interviews: scheduled within the next 24 h
      supabase
        .from("interviews")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "Scheduled")
        .gte("scheduled_at", now)
        .lte("scheduled_at", in24h),
    ]);

    const overdue = overdueCount ?? 0;
    const upcoming = upcomingCount ?? 0;

    return NextResponse.json(
      {
        overdueReminders:  overdue,
        upcomingInterviews: upcoming,
        total: overdue + upcoming,
      },
      {
        headers: {
          // Cache for 30 s at CDN edge — stale-while-revalidate keeps it fresh
          "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (err) {
    return errorResponse(err);
  }
}
