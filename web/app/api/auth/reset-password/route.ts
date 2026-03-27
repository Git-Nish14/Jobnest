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
      const waitSeconds = Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000);
      throw ApiError.tooManyRequests(`Too many reset attempts. Please wait ${waitSeconds} seconds and try again.`);
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

    // Find the user by email using a targeted admin API call (not a full listUsers scan).
    // listUsers() without filtering fetches only the first page (~50 users) and would
    // silently fail for users beyond page 1. Using the Supabase REST admin endpoint with
    // an email filter is O(1) and safe.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw ApiError.internal("Failed to reset password");
    }

    const userLookupRes = await fetch(
      `${supabaseUrl}/auth/v1/admin/users?filter=${encodeURIComponent(`email=eq.${email}`)}`,
      {
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
        },
      }
    );

    if (!userLookupRes.ok) {
      console.error("Failed to look up user by email:", userLookupRes.status);
      throw ApiError.internal("Failed to reset password");
    }

    const userLookupData = await userLookupRes.json();
    const user = (userLookupData.users as Array<{ id: string; email: string }> | undefined)?.[0];

    if (!user) {
      // Don't reveal whether the email exists in our system
      throw ApiError.badRequest("Password reset failed. Please try again or contact support.");
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
