import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Daily cron: application-age reminders for waiting applications only.
// Idempotency: [auto-cadence:dayN] marker embedded in description prevents duplicates.

const CADENCE = [
  {
    days: 7,
    title:       (c: string) => `Follow up on ${c} application`,
    description: (c: string) =>
      `It's been a week since you applied to ${c}. Review the posting and any promised response date before deciding whether to follow up. [auto-cadence:day7]`,
  },
  {
    days: 14,
    title:       (c: string) => `Second follow-up — ${c}`,
    description: (c: string) =>
      `Two weeks with no response from ${c}. Send one more brief check-in, then focus elsewhere if still nothing. [auto-cadence:day14]`,
  },
  {
    days: 21,
    title:       (c: string) => `Review status — ${c}`,
    description: (c: string) =>
      `Three weeks since you applied to ${c}. Check for missing updates before deciding whether to keep waiting or close this role. [auto-cadence:day21]`,
  },
] as const;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const results = { created: 0, skipped: 0, errors: [] as string[] };
  const pausedUsers = new Map<string, boolean>();

  for (const cadence of CADENCE) {
    const windowStart = new Date(now);
    windowStart.setDate(windowStart.getDate() - cadence.days - 1);
    const windowEnd = new Date(now);
    windowEnd.setDate(windowEnd.getDate() - cadence.days + 1);

    const { data: apps, error: appsErr } = await admin
      .from("job_applications")
      .select("id, user_id, company, status")
      .eq("status", "Applied")
      .gte("applied_date", windowStart.toISOString().slice(0, 10))
      .lte("applied_date", windowEnd.toISOString().slice(0, 10));

    if (appsErr) { results.errors.push(`day${cadence.days}: ${appsErr.message}`); continue; }

    for (const app of apps ?? []) {
      try {
        if (!pausedUsers.has(app.user_id)) {
          const { data, error } = await admin.auth.admin.getUserById(app.user_id);
          if (error || !data.user) { results.errors.push("Could not verify search preferences"); continue; }
          pausedUsers.set(app.user_id, data.user.user_metadata?.search_preferences?.paused === true);
        }
        if (pausedUsers.get(app.user_id)) { results.skipped++; continue; }
        const marker = `[auto-cadence:day${cadence.days}]`;
        const { count } = await admin
          .from("reminders")
          .select("id", { count: "exact", head: true })
          .eq("application_id", app.id)
          .ilike("description", `%${marker}%`);

        if ((count ?? 0) > 0) { results.skipped++; continue; }

        const remindAt = new Date(now);
        remindAt.setUTCHours(9, 0, 0, 0);

        const { error: insertErr } = await admin.from("reminders").insert({
          user_id:        app.user_id,
          application_id: app.id,
          type:           "Follow Up",
          title:          cadence.title(app.company),
          description:    cadence.description(app.company),
          remind_at:      remindAt.toISOString(),
          is_completed:   false,
        });

        if (insertErr) results.errors.push(`insert ${app.id}: ${insertErr.message}`);
        else results.created++;
      } catch (err) {
        results.errors.push(`app ${app.id}: ${err instanceof Error ? err.message : "unknown"}`);
      }
    }
  }

  return NextResponse.json({ ok: true, ...results });
}
