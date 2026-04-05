import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendOverdueReminderEmail, type OverdueReminderItem } from "@/lib/email/nodemailer";
import { createNotifications, type NotificationInput } from "@/lib/notifications/create";

export async function GET(request: NextRequest) {
  // Auth: Vercel injects Authorization: Bearer <CRON_SECRET> automatically.
  // Fail-closed — if CRON_SECRET is not configured the endpoint is locked down.
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const results = {
    notificationsCreated: 0,
    emailsSent: 0,
    skipped: 0,
    errors: [] as string[],
  };

  // Page through all users
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
      if (!user.email) { results.skipped++; continue; }

      try {
        const userId = user.id;

        // ── Fetch overdue reminders and upcoming interviews in parallel ──────
        const [{ data: overdueReminders }, { data: upcomingInterviews }] =
          await Promise.all([
            admin
              .from("reminders")
              .select("id, title, type, remind_at, job_applications(company, position)")
              .eq("user_id", userId)
              .eq("is_completed", false)
              .lt("remind_at", now.toISOString())
              .order("remind_at", { ascending: true })
              .limit(20),

            admin
              .from("interviews")
              .select("id, type, scheduled_at, job_applications(company)")
              .eq("user_id", userId)
              .eq("status", "Scheduled")
              .gte("scheduled_at", now.toISOString())
              .lte("scheduled_at", in24h.toISOString())
              .order("scheduled_at", { ascending: true }),
          ]);

        // ── Build in-app notification payloads ───────────────────────────────
        const notifInputs: NotificationInput[] = [];

        // One notification per overdue reminder (deduped by reminder.id)
        for (const r of overdueReminders ?? []) {
          const app = Array.isArray(r.job_applications)
            ? (r.job_applications[0] as { company: string; position: string } | undefined)
            : (r.job_applications as unknown as { company: string; position: string } | null);

          const daysOverdue = Math.max(
            0,
            Math.floor((now.getTime() - new Date(r.remind_at).getTime()) / 86_400_000)
          );

          notifInputs.push({
            userId,
            type: "overdue_reminder",
            title: r.title,
            body: app
              ? `${app.company}${app.position ? ` — ${app.position}` : ""} · ${daysOverdue === 0 ? "due today" : `${daysOverdue}d overdue`}`
              : `${daysOverdue === 0 ? "Due today" : `${daysOverdue}d overdue`}`,
            link: "/reminders",
            sourceType: "reminder",
            sourceId: r.id,
          });
        }

        // One notification per upcoming interview (deduped by interview.id)
        for (const iv of upcomingInterviews ?? []) {
          const app = Array.isArray(iv.job_applications)
            ? (iv.job_applications[0] as { company: string } | undefined)
            : (iv.job_applications as unknown as { company: string } | null);

          const hoursUntil = Math.max(
            0,
            Math.round((new Date(iv.scheduled_at).getTime() - now.getTime()) / 3_600_000)
          );

          notifInputs.push({
            userId,
            type: "upcoming_interview",
            title: app?.company
              ? `Interview at ${app.company}`
              : `${iv.type ?? "Interview"} scheduled`,
            body: hoursUntil < 1 ? "Starting very soon" : `In ${hoursUntil}h`,
            link: "/interviews",
            sourceType: "interview",
            sourceId: iv.id,
          });
        }

        if (notifInputs.length > 0) {
          await createNotifications(notifInputs);
          results.notificationsCreated += notifInputs.length;
        }

        // ── Send overdue reminder EMAIL only to opted-in users ───────────────
        const wantsEmail =
          user.user_metadata?.notification_prefs?.overdue_reminders === true;

        if (wantsEmail && (overdueReminders?.length ?? 0) > 0) {
          const items: OverdueReminderItem[] = (overdueReminders ?? []).map((r) => {
            const app = Array.isArray(r.job_applications)
              ? (r.job_applications[0] as { company: string; position: string } | undefined) ?? null
              : (r.job_applications as unknown as { company: string; position: string } | null);

            return {
              title:       r.title,
              type:        r.type,
              company:     app?.company,
              position:    app?.position,
              daysOverdue: Math.max(
                0,
                Math.floor((now.getTime() - new Date(r.remind_at).getTime()) / 86_400_000)
              ),
            };
          });

          const displayName: string =
            user.user_metadata?.display_name ??
            user.user_metadata?.full_name ??
            "";

          const emailResult = await sendOverdueReminderEmail(user.email, displayName, items);

          if (emailResult.success) {
            results.emailsSent++;
          } else {
            results.errors.push(`email ${user.email}: ${emailResult.error}`);
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.errors.push(`${user.email}: ${msg}`);
      }
    }

    if (users.length < perPage) break;
    page++;
  }

  console.log("[cron/overdue-reminders] done", results);
  return NextResponse.json({ success: true, ...results });
}
