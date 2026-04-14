import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendReEngagementEmail } from "@/lib/email/nodemailer";

// Daily cron: emails users inactive ≥14 days. 30-day cooldown. Opt-out via notification prefs.

const INACTIVE_DAYS = 14;
const COOLDOWN_DAYS = 30;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin   = createAdminClient();
  const appUrl  = process.env.NEXT_PUBLIC_APP_URL || "https://jobnest.nishpatel.dev";
  const now     = new Date();
  const cutoff  = new Date(now.getTime() - INACTIVE_DAYS * 86_400_000);
  const cooloff = new Date(now.getTime() - COOLDOWN_DAYS * 86_400_000);
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

        if (user.user_metadata?.notification_prefs?.re_engagement_emails === false) {
          results.skipped++; continue;
        }

        const lastSeen = user.last_sign_in_at ? new Date(user.last_sign_in_at) : null;
        if (!lastSeen || lastSeen > cutoff) { results.skipped++; continue; }

        const lastSent = user.user_metadata?.re_engagement_sent_at
          ? new Date(user.user_metadata.re_engagement_sent_at)
          : null;
        if (lastSent && lastSent > cooloff) { results.skipped++; continue; }

        const [{ count: total }, { count: active }] = await Promise.all([
          admin.from("job_applications").select("id", { count: "exact", head: true }).eq("user_id", user.id),
          admin.from("job_applications").select("id", { count: "exact", head: true })
            .eq("user_id", user.id).in("status", ["Applied", "Phone Screen", "Interview"]),
        ]);

        const { success, error: emailErr } = await sendReEngagementEmail({
          email:              user.email,
          displayName:        user.user_metadata?.display_name ?? user.user_metadata?.full_name ?? "",
          appUrl,
          totalApplications:  total ?? 0,
          activeApplications: active ?? 0,
        });

        if (!success) {
          results.errors.push(`user ${user.id}: ${emailErr}`);
          continue;
        }

        await admin.auth.admin.updateUserById(user.id, {
          user_metadata: { ...user.user_metadata, re_engagement_sent_at: now.toISOString() },
        });

        results.sent++;
      } catch (err) {
        results.errors.push(`user ${user.id}: ${err instanceof Error ? err.message : "unknown"}`);
      }
    }
  }

  return NextResponse.json({ ok: true, ...results });
}
