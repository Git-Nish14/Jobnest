import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { verifyOrigin } from "@/lib/security/csrf";
import { checkRateLimit } from "@/lib/security/rate-limit";

// Limit subscriptions per user: prevents a single account from turning the
// overdue-reminders cron into an unbounded push fan-out (DoS via amplification).
const MAX_SUBSCRIPTIONS_PER_USER = 10;

const subscribeSchema = z.object({
  endpoint: z.string().url().max(2048),
  p256dh:   z.string().min(1).max(512),
  auth:     z.string().min(1).max(256),
});

const unsubscribeSchema = z.object({
  endpoint: z.string().url().max(2048),
});

// POST /api/push/subscribe — save a PushSubscription for the current user
export async function POST(request: NextRequest) {
  if (!verifyOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit: 10 subscribe attempts per user per minute
  const rl = await checkRateLimit(`push-sub:${user.id}`, { maxRequests: 10, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = subscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid subscription payload." }, { status: 400 });
  }

  const { endpoint, p256dh, auth } = parsed.data;

  // Enforce per-user subscription cap before upsert.
  // The UNIQUE(user_id, endpoint) constraint means the same endpoint is an update,
  // so we check the count of DISTINCT existing endpoints to gate new registrations.
  const { count, error: countErr } = await supabase
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .neq("endpoint", endpoint); // exclude this endpoint — upsert on existing is always allowed

  if (countErr) {
    console.error("[push/subscribe] count check failed:", countErr.message);
    return NextResponse.json({ error: "Failed to check subscription count." }, { status: 500 });
  }

  if ((count ?? 0) >= MAX_SUBSCRIPTIONS_PER_USER) {
    return NextResponse.json(
      { error: `Maximum of ${MAX_SUBSCRIPTIONS_PER_USER} push subscriptions allowed per account.` },
      { status: 429 }
    );
  }

  const userAgent = request.headers.get("user-agent")?.slice(0, 512) ?? undefined;

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      { user_id: user.id, endpoint, p256dh, auth, user_agent: userAgent },
      { onConflict: "user_id,endpoint" }
    );

  if (error) {
    console.error("[push/subscribe] upsert failed:", error.message);
    return NextResponse.json({ error: "Failed to save subscription." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/push/subscribe — remove a PushSubscription for the current user
export async function DELETE(request: NextRequest) {
  if (!verifyOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = unsubscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", parsed.data.endpoint);

  return NextResponse.json({ ok: true });
}
