import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyOrigin } from "@/lib/security/csrf";
import { hashOTP, secureCompare } from "@/lib/security/otp";
import { otpSchema } from "@/lib/validations/auth";
import { ApiError, errorResponse, successResponse, validateBody } from "@/lib/api/errors";

const schema = z.object({ otp: otpSchema });

/**
 * Verify a change_password OTP without marking it as used.
 * Used to gate the new-password fields — the OTP is consumed for real
 * only when the final change-password API call is made.
 */
export async function POST(request: NextRequest) {
  try {
    if (!verifyOrigin(request)) { throw ApiError.forbidden("Invalid request origin"); }
    const { otp } = await validateBody(request, schema);

    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user?.email) throw ApiError.unauthorized();

    const rateLimitResult = await checkRateLimit(`verify-change-otp:${user.id}`, {
      maxRequests: 10,
      windowMs: 15 * 60 * 1000,
    });
    if (!rateLimitResult.allowed) {
      const waitSeconds = Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000);
      throw ApiError.tooManyRequests(`Too many attempts. Please wait ${waitSeconds} seconds and try again.`);
    }

    const supabaseAdmin = createAdminClient();

    const { data: otpRecord, error: fetchError } = await supabaseAdmin
      .from("otp_codes")
      .select("*")
      .eq("email", user.email)
      .eq("purpose", "change_password")
      .eq("used", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !otpRecord) {
      throw ApiError.badRequest("Invalid or expired verification code. Please request a new one.");
    }

    if (otpRecord.attempts >= otpRecord.max_attempts) {
      await supabaseAdmin.from("otp_codes").update({ used: true }).eq("id", otpRecord.id);
      throw ApiError.badRequest("Too many failed attempts. Please request a new code.");
    }

    // Increment attempt counter (wrong guesses count even in pre-verify)
    await supabaseAdmin
      .from("otp_codes")
      .update({ attempts: otpRecord.attempts + 1 })
      .eq("id", otpRecord.id);

    if (!secureCompare(hashOTP(otp), otpRecord.code_hash)) {
      const remaining = otpRecord.max_attempts - (otpRecord.attempts + 1);
      throw ApiError.badRequest(`Invalid code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`);
    }

    // Valid — do NOT mark as used; the change-password route will consume it
    return successResponse({ valid: true });
  } catch (error) {
    return errorResponse(error);
  }
}
