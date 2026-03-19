import { NextRequest } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyOtpSchema } from "@/lib/validations/auth";
import { ApiError, errorResponse, successResponse, validateBody } from "@/lib/api/errors";

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
    // Validate input with Zod
    const { email, code, purpose, password } = await validateBody(request, verifyOtpSchema);

    // For login, password is required
    if (purpose === "login" && !password) {
      throw ApiError.badRequest("Password is required for login");
    }

    // Rate limiting for OTP verification attempts
    const rateLimitResult = checkRateLimit(`verify:${email}`, {
      maxRequests: 10,
      windowMs: 15 * 60 * 1000,
    });

    if (!rateLimitResult.allowed) {
      throw ApiError.tooManyRequests("Too many verification attempts. Please try again later.");
    }

    const supabaseAdmin = createAdminClient();

    // Find the latest valid OTP for this email and purpose
    const { data: otpRecord, error: fetchError } = await supabaseAdmin
      .from("otp_codes")
      .select("*")
      .eq("email", email)
      .eq("purpose", purpose)
      .eq("used", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !otpRecord) {
      throw ApiError.badRequest("Invalid or expired verification code. Please request a new one.");
    }

    // Check if max attempts exceeded
    if (otpRecord.attempts >= otpRecord.max_attempts) {
      // Mark as used to prevent further attempts
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

    // Verify OTP using timing-safe comparison
    const inputHash = hashOTP(code);
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

    // Handle based on purpose
    if (purpose === "login") {
      // Verify password and create session
      const supabase = await createClient();
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email,
          password: password!,
        });

      if (authError) {
        throw ApiError.unauthorized("Invalid email or password");
      }

      return successResponse({
        success: true,
        message: "Login successful",
        user: {
          id: authData.user.id,
          email: authData.user.email,
        },
      });
    }

    if (purpose === "signup") {
      // Mark email as verified in user metadata (best-effort — user may not have a session yet)
      const supabase = await createClient();
      const { data: { user: signupUser } } = await supabase.auth.getUser();

      if (signupUser) {
        await supabase.auth.updateUser({
          data: {
            email_verified: true,
            email_verified_at: new Date().toISOString(),
          },
        });
      }
      // If no session yet, the metadata will be set on next authenticated request — not a hard failure

      return successResponse({
        success: true,
        message: "Email verified successfully",
      });
    }

    if (purpose === "password_reset") {
      return successResponse({
        success: true,
        message: "Code verified. You can now reset your password.",
        reset_token: otpRecord.id, // Use OTP record ID as temporary token
      });
    }

    return successResponse({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
