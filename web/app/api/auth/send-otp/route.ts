import { NextRequest } from "next/server";
import { createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateOTP } from "@/lib/security/otp";
import { sendOTPEmail } from "@/lib/email/nodemailer";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { sendOtpSchema } from "@/lib/validations/auth";
import { ApiError, errorResponse, successResponse, validateBody } from "@/lib/api/errors";

function hashOTP(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export async function POST(request: NextRequest) {
  try {
    // Validate input with Zod
    const { email, purpose } = await validateBody(request, sendOtpSchema);

    // Rate limiting - check by email
    const rateLimitResult = checkRateLimit(`otp:${email}`, {
      maxRequests: 3,
      windowMs: 60 * 1000,
    });

    if (!rateLimitResult.allowed) {
      const waitSeconds = Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000);
      throw ApiError.tooManyRequests(`Too many requests. Please wait ${waitSeconds} seconds and try again.`);
    }

    const supabaseAdmin = createAdminClient();

    // Invalidate any existing unused OTPs for this email and purpose
    await supabaseAdmin
      .from("otp_codes")
      .update({ used: true })
      .eq("email", email)
      .eq("purpose", purpose)
      .eq("used", false);

    // Generate new OTP
    const { code, expiresAt } = generateOTP();

    // Store hashed OTP in database
    const { error: insertError } = await supabaseAdmin.from("otp_codes").insert({
      email,
      code_hash: hashOTP(code),
      purpose,
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
    const emailResult = await sendOTPEmail(email, code, purpose);

    if (!emailResult.success) {
      // Clean up the stored OTP if email fails
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
