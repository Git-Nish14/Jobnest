import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { verifyOrigin } from "@/lib/security/csrf";

/** DELETE /api/portfolio/github/disconnect — revoke GitHub connection and purge cached repos */
export async function DELETE(request: NextRequest) {
  try {
    if (!verifyOrigin(request)) throw ApiError.forbidden("Invalid request origin.");

    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw ApiError.unauthorized();

    const admin = createAdminClient();

    // Remove repos first (FK)
    await admin.from("github_repos").delete().eq("user_id", user.id);

    // Remove connection
    const { error: delErr } = await admin
      .from("github_connections")
      .delete()
      .eq("user_id", user.id);

    if (delErr) throw ApiError.internal("Failed to disconnect GitHub.");

    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
