import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Daily cron: auto-creates follow-up reminders at Day 7/14/21 for Applied/Phone Screen apps.
// Idempotency: [auto-cadence:dayN] marker embedded in description prevents duplicates.

const CADENCE = [
  {
    days: 7,
    title:       (c: string) => `Follow up on ${c} application`,
    description: (c: string) =>
      `It's been a week since you applied to ${c}. A short, polite check-in email can meaningfully increase your response rate. [auto-cadence:day7]`,
  },
  {
    days: 14,
    title:       (c: string) => `Second follow-up — ${c}`,
    description: (c: string) =>
      `Two weeks with no response from ${c}. Send one more brief check-in, then focus elsewhere if still nothing. [auto-cadence:day14]`,
  },
  {
    days: 21,
    title:       (c: string) => `No response from ${c} — consider marking as Ghosted`,
    description: (c: string) =>
      `Three weeks without a reply from ${c}. Consider updating the status to Ghosted or Withdrawn. [auto-cadence:day21]`,
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

  for (const cadence of CADENCE) {
    const windowStart = new Date(now);
    windowStart.setDate(windowStart.getDate() - cadence.days - 1);
    const windowEnd = new Date(now);
    windowEnd.setDate(windowEnd.getDate() - cadence.days + 1);

    const { data: apps, error: appsErr } = await admin
      .from("job_applications")
      .select("id, user_id, company, status")
      .in("status", ["Applied", "Phone Screen"])
      .gte("created_at", windowStart.toISOString())
      .lte("created_at", windowEnd.toISOString());

    if (appsErr) { results.errors.push(`day${cadence.days}: ${appsErr.message}`); continue; }

    for (const app of apps ?? []) {
      try {
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
