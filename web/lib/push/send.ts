// Web Push notification sender.
// Requires: npm install web-push @types/web-push
// Env vars: VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
// Generate keys: npx web-push generate-vapid-keys

import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

if (
  process.env.VAPID_EMAIL &&
  process.env.VAPID_PUBLIC_KEY &&
  process.env.VAPID_PRIVATE_KEY
) {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  /** Deduplication tag — a new push with the same tag replaces the previous notification */
  tag?: string;
}

interface PushSub {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Sends a push notification to every registered browser/device for a user.
 * Automatically removes expired subscriptions (HTTP 410/404 from the push service).
 */
export async function sendUserPushNotifications(
  userId: string,
  payload: PushPayload,
): Promise<{ sent: number; removed: number }> {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    console.warn("[push] VAPID keys not configured — skipping push");
    return { sent: 0, removed: 0 };
  }

  const admin = createAdminClient();
  const { data: subs, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (error || !subs?.length) return { sent: 0, removed: 0 };

  let sent = 0;
  const expiredIds: string[] = [];

  await Promise.allSettled(
    (subs as PushSub[]).map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
          // 1-hour TTL: overdue-reminder pushes are only meaningful on the day they
          // fire. 24h TTL would deliver yesterday's "3 overdue" count to a user who
          // comes back online the next morning — stale and confusing.
          { TTL: 3_600 }
        );
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 410 || status === 404) {
          // Subscription is no longer valid — remove it
          expiredIds.push(sub.id);
        } else {
          console.error(`[push] sendNotification failed for sub ${sub.id}:`, err);
        }
      }
    })
  );

  if (expiredIds.length > 0) {
    await admin.from("push_subscriptions").delete().in("id", expiredIds);
  }

  return { sent, removed: expiredIds.length };
}
