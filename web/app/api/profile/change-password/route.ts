import { NextRequest } from "next/server";
import { z } from "zod";
import { createHash, timingSafeEqual } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { passwordSchema, otpSchema } from "@/lib/validations/auth";
import { ApiError, errorResponse, successResponse, validateBody } from "@/lib/api/errors";

const schema = z.object({
  otp: otpSchema,
  newPassword: passwordSchema,
});

function hashOTP(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { otp, newPassword } = await validateBody(request, schema);

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user?.email) {
      throw ApiError.unauthorized("You must be logged in to change your password");
    }

    const email = user.email;

    // Rate limit
    const rateLimitResult = checkRateLimit(`change-pw-verify:${user.id}`, {
      maxRequests: 10,
      windowMs: 15 * 60 * 1000,
    });

    if (!rateLimitResult.allowed) {
      throw ApiError.tooManyRequests("Too many attempts. Please try again later.");
    }

    const supabaseAdmin = createAdminClient();

    // Find the valid OTP for this user and purpose
    const { data: otpRecord, error: fetchError } = await supabaseAdmin
      .from("otp_codes")
      .select("*")
      .eq("email", email)
      .eq("purpose", "change_password")
      .eq("used", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !otpRecord) {
      throw ApiError.badRequest("Invalid or expired verification code. Please request a new one.");
    }

    // Check max attempts
    if (otpRecord.attempts >= otpRecord.max_attempts) {
      await supabaseAdmin
        .from("otp_codes")
        .update({ used: true })
        .eq("id", otpRecord.id);

      throw ApiError.badRequest("Too many failed attempts. Please request a new code.");
    }

    // Increment attempt counter
    await supabaseAdmin
      .from("otp_codes")
      .update({ attempts: otpRecord.attempts + 1 })
      .eq("id", otpRecord.id);

    // Verify OTP
    const inputHash = hashOTP(otp);
    const isValid = secureCompare(inputHash, otpRecord.code_hash);

    if (!isValid) {
      const remainingAttempts = otpRecord.max_attempts - (otpRecord.attempts + 1);
      throw ApiError.badRequest(`Invalid verification code. ${remainingAttempts} attempts remaining.`);
    }

    // Mark OTP as used
    await supabaseAdmin
      .from("otp_codes")
      .update({ used: true })
      .eq("id", otpRecord.id);

    // Update the user's password using admin client
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: newPassword,
    });

    if (updateError) {
      console.error("Failed to update password:", updateError);
      throw ApiError.internal("Failed to update password");
    }

    // Record the timestamp in user metadata via admin client — the user's
    // session was invalidated by the password change above, so the regular
    // supabase.auth.updateUser() call would fail silently.
    const { error: metaError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      user_metadata: { password_changed_at: new Date().toISOString() },
    });

    if (metaError) {
      // Non-fatal — password was changed, just log the metadata failure
      console.error("Failed to record password_changed_at:", metaError);
    }

    return successResponse({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
