import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWeeklyMotivationEmail } from "@/lib/email/nodemailer";

// Runs every 3h (0,3,6,9,12,15,18,21 UTC) to cover fractional timezone offsets
// (e.g. UTC+5:30 India, UTC+9:30 Adelaide). Only delivers on Wednesday in the
// user's local time (8–10am window). ISO week key dedup ensures exactly one
// email per user per week regardless of how many windows overlap.

const INACTIVE_DAYS = 30; // skip users who haven't signed in within this many days

// ISO 8601 week number. Week 1 = week containing the year's first Thursday.
// Algorithm: advance d to the Thursday of its week, then count 7-day periods
// from Jan 1 of that Thursday's year (which may differ for early-January dates).
function getIsoWeek(d: Date): number {
  // Clone to UTC midnight so we don't mutate the original
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  // Move to the Thursday of the current ISO week (ISO weeks start on Monday)
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);
  const inactiveCutoff = new Date(now.getTime() - INACTIVE_DAYS * 86_400_000);
  const results = { sent: 0, skipped: 0, errors: [] as string[] };

  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data: usersPage, error: usersErr } = await admin.auth.admin.listUsers({ page, perPage });
    if (usersErr) { results.errors.push(`listUsers p${page}: ${usersErr.message}`); break; }

    const users = usersPage?.users ?? [];
    if (users.length === 0) break;
    page++;

    for (const user of users) {
      try {
        if (!user.email) { results.skipped++; continue; }

        // ── Opt-out check ───────────────────────────────────────────────────
        if (user.user_metadata?.notification_prefs?.motivation_emails === false) {
          results.skipped++; continue;
        }

        // ── Activity check — skip long-inactive users ───────────────────────
        const lastSeen = user.last_sign_in_at ? new Date(user.last_sign_in_at) : null;
        if (!lastSeen || lastSeen < inactiveCutoff) { results.skipped++; continue; }

        // ── Timezone + local-time window filter ────────────────────────────
        const utcOffsetHours: number = user.user_metadata?.utc_offset_hours ?? 0;
        const localHour = ((now.getUTCHours() + utcOffsetHours) % 24 + 24) % 24;
        if (localHour < 8 || localHour >= 10) { results.skipped++; continue; }

        // ── Day-of-week check: only send on Wednesday in local time ─────────
        const localDateMs = now.getTime() + utcOffsetHours * 3_600_000;
        const localDate = new Date(localDateMs);
        if (localDate.getUTCDay() !== 3) { results.skipped++; continue; } // 3 = Wednesday

        // ── ISO week dedup — one email per calendar week ────────────────────
        const weekKey = `${localDate.getUTCFullYear()}-W${getIsoWeek(localDate)}`;
        if (user.user_metadata?.motivation_sent_week === weekKey) { results.skipped++; continue; }

        const userId = user.id;
        const displayName: string =
          user.user_metadata?.display_name ?? user.user_metadata?.full_name ?? "";

        // ── Fetch stats ─────────────────────────────────────────────────────
        const [
          { count: totalAppsRaw },
          { count: appsThisWeekRaw },
          { count: respondedRaw },
          { count: pipelineRaw },
          { count: offersRaw },
        ] = await Promise.all([
          admin.from("job_applications").select("id", { count: "exact", head: true }).eq("user_id", userId),
          admin.from("job_applications").select("id", { count: "exact", head: true })
            .eq("user_id", userId).gte("applied_date", sevenDaysAgo.toISOString().slice(0, 10)),
          admin.from("job_applications").select("id", { count: "exact", head: true })
            .eq("user_id", userId).in("status", ["Phone Screen", "Interview", "Offer", "Accepted", "Rejected"]),
          admin.from("job_applications").select("id", { count: "exact", head: true })
            .eq("user_id", userId).in("status", ["Phone Screen", "Interview"]),
          admin.from("job_applications").select("id", { count: "exact", head: true })
            .eq("user_id", userId).in("status", ["Offer", "Accepted"]),
        ]);

        const totalApps = totalAppsRaw ?? 0;
        // Skip users with no applications — nothing meaningful to personalize
        if (totalApps === 0) { results.skipped++; continue; }

        const appsThisWeek = appsThisWeekRaw ?? 0;
        const responded = respondedRaw ?? 0;
        const activePipeline = pipelineRaw ?? 0;
        const totalOffers = offersRaw ?? 0;
        const responseRate = totalApps > 0 ? Math.round((responded / totalApps) * 100) : 0;

        // ── Send email ──────────────────────────────────────────────────────
        const { success, error: emailErr } = await sendWeeklyMotivationEmail({
          email: user.email,
          displayName,
          totalApps,
          appsThisWeek,
          responseRate,
          activePipeline,
          totalOffers,
        });

        if (!success) {
          results.errors.push(`${user.email}: ${emailErr}`);
          continue;
        }

        // Record the week we sent so we don't double-send
        await admin.auth.admin.updateUserById(userId, {
          user_metadata: { ...user.user_metadata, motivation_sent_week: weekKey },
        });

        results.sent++;
        console.log(`[cron/weekly-motivation] sent to ${user.email} (week ${weekKey})`);
      } catch (err) {
        results.errors.push(`user ${user.id}: ${err instanceof Error ? err.message : "unknown"}`);
      }
    }

    if (users.length < perPage) break;
  }

  console.log("[cron/weekly-motivation] done", results);
  return NextResponse.json({ ok: true, ...results });
}
