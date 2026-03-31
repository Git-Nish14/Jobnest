import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { hashOTP, secureCompare } from "@/lib/security/otp";
import { verifyOtpSchema } from "@/lib/validations/auth";
import { ApiError, errorResponse, successResponse, validateBody } from "@/lib/api/errors";

export async function POST(request: NextRequest) {
  try {
    // Validate input with Zod
    const { email, code, purpose, password, rememberMe } = await validateBody(request, verifyOtpSchema);

    // For login, password is required
    if (purpose === "login" && !password) {
      throw ApiError.badRequest("Password is required for login");
    }

    // Rate limiting for OTP verification attempts
    const rateLimitResult = await checkRateLimit(`verify:${email}`, {
      maxRequests: 10,
      windowMs: 15 * 60 * 1000,
    });

    if (!rateLimitResult.allowed) {
      const waitSeconds = Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000);
      throw ApiError.tooManyRequests(`Too many verification attempts. Please wait ${waitSeconds} seconds and try again.`);
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

      const loginResponse = successResponse({
        success: true,
        message: "Login successful",
        user: {
          id: authData.user.id,
          email: authData.user.email,
        },
      });

      // Set remember-me companion cookie so AuthSync can enforce session-only
      // behaviour. Intentionally not HttpOnly (JS must be able to read it).
      // __Host- prefix: binds the cookie to the exact host, no Domain attribute
      // allowed, Path must be /, Secure required — prevents subdomain injection.
      const maxAge = rememberMe ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60;
      const isProduction = process.env.NODE_ENV === "production";
      // __Host- requires Secure, so only use it in production (localhost is http)
      const cookieName = isProduction ? "__Host-sb_rm" : "sb_rm";
      const secure = isProduction ? "; Secure" : "";
      loginResponse.headers.append(
        "Set-Cookie",
        `${cookieName}=${rememberMe ? "1" : "0"}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`
      );

      return loginResponse;
    }

    if (purpose === "signup") {
      // Mark email as verified if a session exists (best-effort).
      // onboarding_completed: false is set at signUp() time in the signup page
      // so it doesn't depend on a session being present here.
      try {
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
      } catch {
        // Non-critical — don't block the response
      }

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
