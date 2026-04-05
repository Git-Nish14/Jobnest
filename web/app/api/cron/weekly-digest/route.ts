import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWeeklyDigestEmail } from "@/lib/email/nodemailer";

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

  const results = { sent: 0, skipped: 0, errors: [] as string[] };

  // Fetch all users who have weekly_digest enabled
  // We page through auth.users (max 1000 per page)
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
          console.log(`[cron/weekly-digest] sent to ${user.email}`);
        } else {
          results.errors.push(`${user.email}: ${result.error}`);
        }
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
