/**
 * Server-side notification creation helpers.
 *
 * All writes go through the Supabase admin client (service role) because
 * there is no user-level INSERT policy on the notifications table —
 * only the server/cron should create notifications.
 *
 * The unique index `idx_notifications_source_dedup` on
 * (user_id, source_type, source_id) means we can safely use upsert
 * DO NOTHING — running the cron multiple times is always idempotent.
 */

import { createAdminClient } from "@/lib/supabase/admin";

export type NotificationType =
  | "overdue_reminder"
  | "upcoming_interview"
  | "system"
  | "account"
  | "billing";

export interface NotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  sourceType?: string;
  sourceId?: string;
}

/**
 * Upsert a batch of notifications, ignoring conflicts.
 * Notifications with a source_id are automatically deduplicated.
 * Call this from server-side code (cron, API routes, server actions) only.
 */
export async function createNotifications(inputs: NotificationInput[]): Promise<void> {
  if (inputs.length === 0) return;

  const admin = createAdminClient();

  const rows = inputs.map((n) => ({
    user_id:     n.userId,
    type:        n.type,
    title:       n.title,
    body:        n.body ?? null,
    link:        n.link ?? null,
    source_type: n.sourceType ?? null,
    source_id:   n.sourceId ?? null,
  }));

  // Upsert with ignoreDuplicates — any row that conflicts on the dedup
  // index (user_id, source_type, source_id) is silently skipped.
  // Rows with source_id = null bypass the partial index and are always inserted.
  const { error } = await admin
    .from("notifications")
    .upsert(rows, {
      onConflict: "user_id,source_type,source_id",
      ignoreDuplicates: true,
    });

  if (error) {
    // Log but never throw — notification creation is non-critical
    console.error("[notifications] createNotifications error:", error.message);
  }
}

/** Convenience wrapper for a single notification. */
export async function createNotification(input: NotificationInput): Promise<void> {
  return createNotifications([input]);
}
