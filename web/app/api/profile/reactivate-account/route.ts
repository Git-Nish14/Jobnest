import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendAccountReactivatedEmail } from "@/lib/email/nodemailer";
import { ApiError, errorResponse, successResponse } from "@/lib/api/errors";
import { verifyOrigin } from "@/lib/security/csrf";

export async function POST(request: NextRequest) {
  try {
    if (!verifyOrigin(request)) { throw ApiError.forbidden("Invalid request origin"); }

    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      throw ApiError.unauthorized("You must be logged in to reactivate your account");
    }

    const supabaseAdmin = createAdminClient();

    // Find active pending deletion for this user
    const { data: pending, error: fetchError } = await supabaseAdmin
      .from("pending_deletions")
      .select("id, email")
      .eq("user_id", user.id)
      .is("cancelled_at", null)
      .single();

    if (fetchError || !pending) {
      throw ApiError.notFound("No pending deletion found for your account");
    }

    // Mark deletion as cancelled
    const { error: updateError } = await supabaseAdmin
      .from("pending_deletions")
      .update({ cancelled_at: new Date().toISOString() })
      .eq("id", pending.id);

    if (updateError) {
      console.error("Failed to cancel deletion:", updateError);
      throw ApiError.internal("Failed to reactivate account");
    }

    // Send confirmation email (non-blocking)
    sendAccountReactivatedEmail(pending.email).catch((err) => {
      console.error("Failed to send reactivation email:", err);
    });

    return successResponse({
      success: true,
      message: "Account reactivated successfully",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
