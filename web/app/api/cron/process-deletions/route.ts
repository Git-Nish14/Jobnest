import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  sendDeletionReminderEmail,
  sendDeletionFinalWarningEmail,
} from "@/lib/email/nodemailer";

// Reminder every 7 days; final warning when ≤ 1 day remains
const REMINDER_INTERVAL_DAYS = 7;
const FINAL_WARNING_THRESHOLD_HOURS = 26; // slightly over 24h so the cron window is safe

export async function GET(request: NextRequest) {
  // Verify caller — Vercel Cron sets Authorization: Bearer <CRON_SECRET> automatically
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabaseAdmin = createAdminClient();
  const now = new Date();

  const results = {
    permanentlyDeleted: 0,
    finalWarningsSent: 0,
    remindersSent: 0,
    errors: [] as string[],
  };

  // ── 1. Permanently delete accounts whose grace period has expired ─────────
  const { data: dueForDeletion, error: fetchDueError } = await supabaseAdmin
    .from("pending_deletions")
    .select("id, user_id, email")
    .is("cancelled_at", null)
    .lte("scheduled_deletion_at", now.toISOString());

  if (fetchDueError) {
    console.error("[cron] fetch due-for-deletion failed:", fetchDueError);
    results.errors.push("fetch-due: " + fetchDueError.message);
  } else {
    for (const record of dueForDeletion ?? []) {
      try {
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(record.user_id);

        if (deleteError) {
          // Don't stop the loop — log and continue with other users
          console.error(`[cron] deleteUser failed for ${record.user_id}:`, deleteError);
          results.errors.push(`deleteUser ${record.email}: ${deleteError.message}`);
          continue;
        }

        // Remove the pending_deletions row now that auth.users is gone
        await supabaseAdmin.from("pending_deletions").delete().eq("id", record.id);

        results.permanentlyDeleted++;
        console.log(`[cron] permanently deleted ${record.email}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.errors.push(`delete ${record.email}: ${msg}`);
      }
    }
  }

  // ── 2. Fetch all still-active, not-yet-due pending deletions ─────────────
  const { data: activePending, error: fetchActiveError } = await supabaseAdmin
    .from("pending_deletions")
    .select(
      "id, email, created_at, scheduled_deletion_at, last_reminder_sent_at, final_warning_sent_at, reminder_count"
    )
    .is("cancelled_at", null)
    .gt("scheduled_deletion_at", now.toISOString());

  if (fetchActiveError) {
    console.error("[cron] fetch active pending failed:", fetchActiveError);
    results.errors.push("fetch-active: " + fetchActiveError.message);
    return NextResponse.json({ success: false, ...results });
  }

  for (const record of activePending ?? []) {
    const scheduledAt = new Date(record.scheduled_deletion_at);
    const hoursRemaining =
      (scheduledAt.getTime() - now.getTime()) / (1000 * 60 * 60);
    const daysRemaining = Math.max(1, Math.ceil(hoursRemaining / 24));

    // ── 2a. Final 24-hour warning (sent once, never repeated) ────────────
    if (
      hoursRemaining <= FINAL_WARNING_THRESHOLD_HOURS &&
      !record.final_warning_sent_at
    ) {
      const result = await sendDeletionFinalWarningEmail(
        record.email,
        record.scheduled_deletion_at
      );

      if (result.success) {
        await supabaseAdmin
          .from("pending_deletions")
          .update({ final_warning_sent_at: now.toISOString() })
          .eq("id", record.id);

        results.finalWarningsSent++;
        console.log(`[cron] final warning → ${record.email} (${daysRemaining}d left)`);
      } else {
        results.errors.push(`final-warning ${record.email}: ${result.error}`);
      }

      // Skip the regular reminder check for this record — final warning takes priority
      continue;
    }

    // ── 2b. 7-day recurring reminders ────────────────────────────────────
    // Bug fix: compare against created_at for the first reminder, not a
    // hard-coded "always send if null" fallback — prevents sending a reminder
    // on day 0 right after the initial scheduled-deletion email.
    const referenceDate = record.last_reminder_sent_at
      ? new Date(record.last_reminder_sent_at)
      : new Date(record.created_at);

    const daysSinceReference = Math.floor(
      (now.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceReference < REMINDER_INTERVAL_DAYS) continue;

    const result = await sendDeletionReminderEmail(
      record.email,
      record.scheduled_deletion_at,
      daysRemaining
    );

    if (result.success) {
      await supabaseAdmin
        .from("pending_deletions")
        .update({
          last_reminder_sent_at: now.toISOString(),
          reminder_count: (record.reminder_count ?? 0) + 1,
        })
        .eq("id", record.id);

      results.remindersSent++;
      console.log(`[cron] reminder → ${record.email} (${daysRemaining}d left)`);
    } else {
      results.errors.push(`reminder ${record.email}: ${result.error}`);
    }
  }

  console.log("[cron] process-deletions done", results);
  return NextResponse.json({ success: true, ...results });
}
