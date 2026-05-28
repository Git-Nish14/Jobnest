import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const NOTIFY_INTERVAL_DAYS = 5;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now   = new Date();

  const results = {
    purged:              0,
    notificationsSent:   0,
    errors:              [] as string[],
  };

  // Fetch all pending queue entries.
  // Note: application_documents has no direct FK to document_purge_queue,
  // so docs are fetched separately inside the purge branch only.
  const { data: entries, error: fetchError } = await admin
    .from("document_purge_queue")
    .select(`
      id,
      application_id,
      user_id,
      purge_at,
      last_notified_at,
      notif_count,
      job_applications ( company, position )
    `)
    .eq("status", "pending");

  if (fetchError) {
    // Don't expose raw DB error strings (schema leakage); log server-side only.
    console.error("[cron/purge-rejected-documents] fetch error:", fetchError.message);
    return NextResponse.json({ error: "Failed to fetch purge queue." }, { status: 500 });
  }

  for (const entry of entries ?? []) {
    try {
      const purgeAt = new Date(entry.purge_at);
      const app = Array.isArray(entry.job_applications)
        ? entry.job_applications[0]
        : entry.job_applications as { company: string; position: string } | null;

      // ── Branch 1: purge time has arrived → delete Storage files ──────────
      if (purgeAt <= now) {
        // Fetch ALL document versions (not just is_current) so that previously
        // replaced uploads don't silently remain in Storage after purge.
        const { data: docRows } = await admin
          .from("application_documents")
          .select("storage_path")
          .eq("application_id", entry.application_id)
          .eq("user_id", entry.user_id);

        const paths = (docRows ?? [])
          .map((d) => d.storage_path)
          .filter((p): p is string => !!p && p.startsWith(`${entry.user_id}/`));

        if (paths.length > 0) {
          const { error: storageError } = await admin.storage
            .from("documents")
            .remove(paths);

          if (storageError) {
            results.errors.push(`storage remove ${entry.application_id}: ${storageError.message}`);
            continue;
          }

          // Mark all version rows as not current (records kept, files gone)
          await admin
            .from("application_documents")
            .update({ is_current: false })
            .eq("application_id", entry.application_id)
            .eq("user_id", entry.user_id);
        }

        await admin
          .from("document_purge_queue")
          .update({ status: "purged" })
          .eq("id", entry.id);

        // Only notify if there were actual files to delete; skip if the
        // application had no uploads (avoids misleading "files deleted" message).
        if (paths.length > 0) {
          await admin.from("notifications").insert({
            user_id:     entry.user_id,
            type:        "document_purge",
            title:       `Files deleted — ${app?.company ?? "Application"}`,
            body:        `Documents for "${app?.position ?? "this role"}" were auto-deleted after 30 days.`,
            link:        `/applications/${entry.application_id}`,
            source_type: "purge_queue",
            source_id:   entry.id,
          });
        }

        results.purged++;
        continue;
      }

      // ── Branch 2: countdown active — notify every 5 days ─────────────────
      const lastNotified = entry.last_notified_at ? new Date(entry.last_notified_at) : null;
      const daysSinceNotif = lastNotified
        ? Math.floor((now.getTime() - lastNotified.getTime()) / 86_400_000)
        : NOTIFY_INTERVAL_DAYS; // treat as "never notified" → notify now

      if (daysSinceNotif < NOTIFY_INTERVAL_DAYS) continue;

      const daysLeft = Math.max(0, Math.ceil((purgeAt.getTime() - now.getTime()) / 86_400_000));

      const { error: notifError } = await admin.from("notifications").insert({
        user_id:     entry.user_id,
        type:        "document_purge",
        title:       `Documents expiring in ${daysLeft}d — ${app?.company ?? "Application"}`,
        body:        `Files for "${app?.position ?? "this role"}" will be auto-deleted in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}. Visit the application to keep or discard them.`,
        link:        `/applications/${entry.application_id}`,
        source_type: "purge_queue",
        source_id:   null, // null so duplicate index doesn't block repeat notifications
      });

      if (notifError) {
        results.errors.push(`notif ${entry.application_id}: ${notifError.message}`);
        continue;
      }

      await admin
        .from("document_purge_queue")
        .update({
          last_notified_at: now.toISOString(),
          notif_count:      (entry.notif_count ?? 0) + 1,
        })
        .eq("id", entry.id);

      results.notificationsSent++;
    } catch (err) {
      results.errors.push(`${entry.application_id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log("[cron/purge-rejected-documents] done", results);
  return NextResponse.json({ success: true, ...results });
}
