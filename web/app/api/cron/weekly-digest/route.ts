import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWeeklyDigestEmail } from "@/lib/email/nodemailer";

// Returns "YYYY-WNN" ISO week string so we can dedup one digest per user per week.
function getISOWeek(d: Date): string {
  const day = d.getUTCDay() || 7; // Mon=1 … Sun=7
  const thursday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 4 - day));
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${thursday.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

// Returns true when the current moment is Saturday 21:xx in the given IANA timezone.
// The cron fires every hour on Saturday and Sunday UTC; this gates each user to
// exactly their local Saturday 9 PM slot.
// Uses numeric weekday (0=Sun…6=Sat) rather than locale-formatted strings to
// avoid dependence on ICU abbreviation tables (which differ across Node versions).
function isSaturday9pmInTz(tz: string): boolean {
  try {
    const now = new Date();
    // weekday: 0=Sun,1=Mon,...,6=Sat via numeric day-of-week derived from locale parts
    const dateParts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "long",
      hour: "numeric",
      hour12: false,
    }).formatToParts(now);
    const weekday = dateParts.find(p => p.type === "weekday")?.value; // "Saturday"
    const hour = parseInt(dateParts.find(p => p.type === "hour")?.value ?? "-1", 10);
    return weekday === "Saturday" && hour === 21;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://jobnest.nishpatel.dev";
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneDayAhead = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const thisWeek = getISOWeek(now);

  const results = { sent: 0, skipped: 0, errors: [] as string[] };

  // Fetch all users who have weekly_digest enabled.
  // We page through auth.users (max 1000 per page).
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data: usersPage, error: usersError } = await admin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (usersError) {
      results.errors.push(`listUsers page ${page}: ${usersError.message}`);
      break;
    }

    const users = usersPage?.users ?? [];
    if (users.length === 0) break;

    for (const user of users) {
      try {
        // Check opt-in preference
        const weeklyDigest = user.user_metadata?.notification_prefs?.weekly_digest;
        if (!weeklyDigest) { results.skipped++; continue; }
        if (!user.email) { results.skipped++; continue; }

        // Per-user timezone gate: only send when it is Saturday 21:xx in their local time.
        // Falls back to UTC for users whose timezone has not been synced yet.
        const userTz = (user.user_metadata?.timezone as string | undefined) ?? "UTC";
        if (!isSaturday9pmInTz(userTz)) { results.skipped++; continue; }

        // ISO-week dedup: at most one attempt per calendar week per user.
        // Stamp is set to thisWeek on success or "attempted:thisWeek" on SMTP failure
        // so that broken addresses are not retried every hour for the rest of the night.
        const sentStamp: string | undefined = user.user_metadata?.digest_sent_week;
        if (sentStamp === thisWeek || sentStamp === `attempted:${thisWeek}`) {
          results.skipped++; continue;
        }

        const userId = user.id;

        // Fetch data in parallel
        const [
          { data: appsThisWeek },
          { data: totalActive },
          { data: upcomingInterviews },
          { data: overdueReminders },
          { data: recentApps },
          { data: interviews },
        ] = await Promise.all([
          admin
            .from("job_applications")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId)
            .gte("applied_date", oneWeekAgo.toISOString().slice(0, 10)),
          admin
            .from("job_applications")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId)
            .not("status", "in", '("Rejected","Withdrawn","Accepted")'),
          admin
            .from("interviews")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId)
            .eq("status", "Scheduled")
            .gte("scheduled_at", now.toISOString())
            .lte("scheduled_at", oneDayAhead.toISOString()),
          admin
            .from("reminders")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId)
            .eq("is_completed", false)
            .lt("remind_at", now.toISOString()),
          admin
            .from("job_applications")
            .select("company, position, status")
            .eq("user_id", userId)
            .gte("applied_date", oneWeekAgo.toISOString().slice(0, 10))
            .order("applied_date", { ascending: false })
            .limit(5),
          admin
            .from("interviews")
            .select("company:job_applications(company), position:job_applications(position), scheduled_at")
            .eq("user_id", userId)
            .eq("status", "Scheduled")
            .gte("scheduled_at", now.toISOString())
            .order("scheduled_at", { ascending: true })
            .limit(3),
        ]);

        const stats = {
          applicationsThisWeek: (appsThisWeek as unknown as { count: number } | null)?.count ?? 0,
          totalActive: (totalActive as unknown as { count: number } | null)?.count ?? 0,
          upcomingInterviews: (upcomingInterviews as unknown as { count: number } | null)?.count ?? 0,
          overdueReminders: (overdueReminders as unknown as { count: number } | null)?.count ?? 0,
        };

        const result = await sendWeeklyDigestEmail({
          email: user.email,
          displayName: user.user_metadata?.display_name ?? user.user_metadata?.full_name ?? "",
          appUrl,
          stats,
          recentApplications: (recentApps ?? []) as { company: string; position: string; status: string }[],
          upcomingInterviews: (interviews ?? []).map((i: unknown) => {
            const row = i as { company: { company: string }; position: { position: string }; scheduled_at: string };
            return {
              company: row.company?.company ?? "",
              position: row.position?.position ?? "",
              scheduledAt: row.scheduled_at,
            };
          }),
        });

        if (result.success) {
          results.sent++;
          console.log(`[cron/weekly-digest] sent to ${user.email} (tz: ${userTz})`);
        } else {
          results.errors.push(`${user.email}: ${result.error}`);
          console.warn(`[cron/weekly-digest] failed for ${user.email}: ${result.error}`);
        }
        // Stamp regardless of send success/failure so the hourly cron does not
        // retry broken addresses every hour for the rest of Saturday night.
        // "sent" = delivered, "attempted:YYYY-WNN" = tried but SMTP failed.
        await admin.auth.admin.updateUserById(user.id, {
          user_metadata: {
            digest_sent_week: result.success ? thisWeek : `attempted:${thisWeek}`,
          },
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.errors.push(`${user.email}: ${msg}`);
      }
    }

    if (users.length < perPage) break;
    page++;
  }

  console.log("[cron/weekly-digest] done", results);
  return NextResponse.json({ success: true, ...results });
}
