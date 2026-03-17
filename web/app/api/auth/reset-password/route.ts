import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { resetPasswordSchema } from "@/lib/validations/auth";
import { ApiError, errorResponse, successResponse, validateBody } from "@/lib/api/errors";

export async function POST(request: NextRequest) {
  try {
    // Validate input with Zod
    const { email, newPassword, resetToken } = await validateBody(request, resetPasswordSchema);

    // Rate limiting
    const rateLimitResult = checkRateLimit(`reset:${email}`, {
      maxRequests: 3,
      windowMs: 60 * 60 * 1000, // 1 hour
    });

    if (!rateLimitResult.allowed) {
      throw ApiError.tooManyRequests("Too many reset attempts. Please try again later.");
    }

    const supabaseAdmin = createAdminClient();

    // Verify the reset token is valid (it's the OTP record ID)
    const { data: otpRecord, error: fetchError } = await supabaseAdmin
      .from("otp_codes")
      .select("*")
      .eq("id", resetToken)
      .eq("email", email)
      .eq("purpose", "password_reset")
      .eq("used", true) // Must have been verified
      .single();

    if (fetchError || !otpRecord) {
      throw ApiError.badRequest("Invalid or expired reset token. Please request a new code.");
    }

    // Check if reset token is not too old (allow 10 minutes after OTP verification)
    const otpCreatedAt = new Date(otpRecord.created_at);
    const maxResetTime = new Date(otpCreatedAt.getTime() + 20 * 60 * 1000); // 20 mins total

    if (new Date() > maxResetTime) {
      throw ApiError.badRequest("Reset session expired. Please request a new code.");
    }

    // Find the user by email
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.listUsers();

    if (userError) {
      console.error("Failed to list users:", userError);
      throw ApiError.internal("Failed to reset password");
    }

    const user = userData.users.find((u) => u.email?.toLowerCase() === email);

    if (!user) {
      throw ApiError.notFound("User not found");
    }

    // Update the user's password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: newPassword,
    });

    if (updateError) {
      console.error("Failed to update password:", updateError);
      throw ApiError.internal("Failed to reset password");
    }

    // Delete the OTP record to prevent reuse
    await supabaseAdmin.from("otp_codes").delete().eq("id", resetToken);

    return successResponse({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
