import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyOrigin } from "@/lib/security/csrf";
import { ApiError, errorResponse } from "@/lib/api/errors";

const PAGE_SIZE = 50;

// GET /api/notifications?filter=all|unread|read&cursor=<created_at ISO>
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    await checkRateLimit(`notifications-list:${user.id}`, { maxRequests: 30, windowMs: 60_000 });

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter") ?? "all"; // all | unread | read
    const cursor = searchParams.get("cursor"); // ISO timestamp for pagination

    let query = supabase
      .from("notifications")
      .select("id, type, title, body, link, is_read, created_at, source_type, source_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE + 1); // fetch one extra to detect hasMore

    if (filter === "unread") query = query.eq("is_read", false);
    if (filter === "read")   query = query.eq("is_read", true);
    if (cursor)              query = query.lt("created_at", cursor);

    const { data, error } = await query;
    if (error) throw ApiError.internal("Failed to fetch notifications.");

    const items = data ?? [];
    const hasMore = items.length > PAGE_SIZE;
    const page = hasMore ? items.slice(0, PAGE_SIZE) : items;
    const nextCursor = hasMore ? page[page.length - 1]?.created_at ?? null : null;

    // Unread count (always the total, not just the current page)
    const { count: unreadCount } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false);

    return NextResponse.json({
      notifications: page,
      hasMore,
      nextCursor,
      unreadCount: unreadCount ?? 0,
    });
  } catch (err) {
    return errorResponse(err);
  }
}

// DELETE /api/notifications — clear all notifications for the current user
export async function DELETE(request: NextRequest) {
  try {
    if (!verifyOrigin(request)) throw ApiError.forbidden("Invalid request origin.");

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    await checkRateLimit(`notifications-clear:${user.id}`, { maxRequests: 10, windowMs: 60_000 });

    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("user_id", user.id);

    if (error) throw ApiError.internal("Failed to clear notifications.");

    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err);
  }
}
