import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyOrigin } from "@/lib/security/csrf";
import { ApiError, errorResponse } from "@/lib/api/errors";

// POST /api/notifications/read-all — mark all unread notifications as read
export async function POST(request: NextRequest) {
  try {
    if (!verifyOrigin(request)) throw ApiError.forbidden("Invalid request origin.");

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true, read_at: now })
      .eq("user_id", user.id)
      .eq("is_read", false);

    if (error) throw ApiError.internal("Failed to mark notifications as read.");

    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err);
  }
}
