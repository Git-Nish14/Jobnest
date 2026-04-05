import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyOrigin } from "@/lib/security/csrf";
import { ApiError, errorResponse } from "@/lib/api/errors";

// PATCH /api/notifications/[id] — toggle is_read or set explicitly
// Body: { is_read: boolean }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!verifyOrigin(request)) throw ApiError.forbidden("Invalid request origin.");

    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const body = await request.json().catch(() => ({}));
    // Accept explicit is_read or toggle if omitted
    const isRead: boolean = typeof body.is_read === "boolean" ? body.is_read : true;

    const { error } = await supabase
      .from("notifications")
      .update({
        is_read: isRead,
        read_at: isRead ? new Date().toISOString() : null,
      })
      .eq("id", id)
      .eq("user_id", user.id); // RLS enforces this too, but be explicit

    if (error) throw ApiError.internal("Failed to update notification.");

    return NextResponse.json({ success: true, is_read: isRead });
  } catch (err) {
    return errorResponse(err);
  }
}

// DELETE /api/notifications/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!verifyOrigin(request)) throw ApiError.forbidden("Invalid request origin.");

    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw ApiError.internal("Failed to delete notification.");

    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err);
  }
}
