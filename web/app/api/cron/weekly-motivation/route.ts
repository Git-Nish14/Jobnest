import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkSmtpConfig, sendWeeklyMotivationEmail } from "@/lib/email/nodemailer";

// Runs once per week: Wednesday 09:00 UTC (cron: "0 9 * * 3").
// Hobby-plan compatible — Vercel Hobby limits crons to once per day;
// a weekly Wednesday schedule is well within that bound.
//
// ISO week dedup (motivation_sent_week in user_metadata) guarantees exactly
// one email per user per calendar week even if the cron is accidentally
// triggered more than once (e.g. during a redeploy).

const INACTIVE_DAYS = 30;

// ISO 8601 week number. Week 1 = week containing the year's first Thursday.
function getIsoWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
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

  // Fail fast if SMTP is not configured — avoids silent per-user failures
  const smtpCheck = checkSmtpConfig();
  if (!smtpCheck.ok) {
    console.error("[cron/weekly-motivation] SMTP config missing:", smtpCheck.error);
    return NextResponse.json({ error: smtpCheck.error }, { status: 500 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);
  const inactiveCutoff = new Date(now.getTime() - INACTIVE_DAYS * 86_400_000);
  const results = { sent: 0, skipped: 0, errors: [] as string[] };

  // ISO week key from the current UTC date — used for dedup
  const weekKey = `${now.getUTCFullYear()}-W${getIsoWeek(now)}`;

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

        // ── ISO week dedup — one email per calendar week ────────────────────
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
        // Skip users with no applications — nothing meaningful to personalise
        if (totalApps === 0) { results.skipped++; continue; }

        const appsThisWeek = appsThisWeekRaw ?? 0;
        const responded    = respondedRaw ?? 0;
        const activePipeline = pipelineRaw ?? 0;
        const totalOffers  = offersRaw ?? 0;
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
          console.error(`[cron/weekly-motivation] email failed for ${user.email}:`, emailErr);
          results.errors.push(`${user.email}: ${emailErr}`);
          continue;
        }

        // Record the week so a re-triggered cron never double-sends
        await admin.auth.admin.updateUserById(userId, {
          user_metadata: { ...user.user_metadata, motivation_sent_week: weekKey },
        });

        results.sent++;
        console.log(`[cron/weekly-motivation] sent to ${user.email} (week ${weekKey})`);
      } catch (err) {
        console.error(`[cron/weekly-motivation] unexpected error for user ${user.id}:`, err);
        results.errors.push(`user ${user.id}: ${err instanceof Error ? err.message : "unknown"}`);
      }
    }

    if (users.length < perPage) break;
  }

  if (results.errors.length > 0) {
    console.error("[cron/weekly-motivation] completed with errors:", results);
  } else {
    console.log("[cron/weekly-motivation] done", results);
  }
  return NextResponse.json({ ok: results.errors.length === 0, ...results });
}
