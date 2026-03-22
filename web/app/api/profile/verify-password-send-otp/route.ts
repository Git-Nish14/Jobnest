import { NextRequest } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateOTP } from "@/lib/security/otp";
import { sendOTPEmail } from "@/lib/email/nodemailer";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { ApiError, errorResponse, successResponse, validateBody } from "@/lib/api/errors";

const schema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
});

function hashOTP(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export async function POST(request: NextRequest) {
  try {
    const { currentPassword } = await validateBody(request, schema);

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user?.email) {
      throw ApiError.unauthorized("You must be logged in to change your password");
    }

    const email = user.email;

    // Rate limit per user
    const rateLimitResult = checkRateLimit(`change-pw-otp:${user.id}`, {
      maxRequests: 3,
      windowMs: 60 * 1000,
    });

    if (!rateLimitResult.allowed) {
      throw ApiError.tooManyRequests("Too many requests. Please wait before trying again.");
    }

    // Verify current password by attempting sign-in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });

    if (signInError) {
      throw ApiError.unauthorized("Current password is incorrect");
    }

    const supabaseAdmin = createAdminClient();

    // Invalidate any existing unused OTPs for this user and purpose
    await supabaseAdmin
      .from("otp_codes")
      .update({ used: true })
      .eq("email", email)
      .eq("purpose", "change_password")
      .eq("used", false);

    // Generate and store new OTP
    const { code, expiresAt } = generateOTP();

    const { error: insertError } = await supabaseAdmin.from("otp_codes").insert({
      email,
      code_hash: hashOTP(code),
      purpose: "change_password",
      expires_at: expiresAt.toISOString(),
      attempts: 0,
      max_attempts: 5,
      used: false,
    });

    if (insertError) {
      console.error("Failed to store OTP:", insertError);
      throw ApiError.internal("Failed to generate verification code");
    }

    // Send OTP via email
    const emailResult = await sendOTPEmail(email, code, "change_password");

    if (!emailResult.success) {
      await supabaseAdmin
        .from("otp_codes")
        .delete()
        .eq("email", email)
        .eq("code_hash", hashOTP(code));

      throw ApiError.serviceUnavailable("Failed to send verification email. Please try again.");
    }

    return successResponse({
      success: true,
      message: "Verification code sent to your email",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
