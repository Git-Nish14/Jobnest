import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyOrigin } from "@/lib/security/csrf";
import { hashOTP, secureCompare } from "@/lib/security/otp";
import { otpSchema } from "@/lib/validations/auth";
import { sendDeletionScheduledEmail } from "@/lib/email/nodemailer";
import { ApiError, errorResponse, successResponse, validateBody } from "@/lib/api/errors";

const GRACE_PERIOD_DAYS = 30;

const schema = z.object({
  otp: otpSchema,
  reason: z.string().max(500).optional(),
});

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(request: NextRequest) {
  try {
    if (!verifyOrigin(request)) { throw ApiError.forbidden("Invalid request origin"); }
    const { otp, reason } = await validateBody(request, schema);

    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user?.email) {
      throw ApiError.unauthorized("You must be logged in to delete your account");
    }

    // Strict rate limit — max 3 attempts per hour
    const rateLimitResult = await checkRateLimit(`delete-account:${user.id}`, {
      maxRequests: 3,
      windowMs: 60 * 60 * 1000,
    });

    if (!rateLimitResult.allowed) {
      const waitSeconds = Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000);
      throw ApiError.tooManyRequests(`Too many attempts. Please wait ${waitSeconds} seconds and try again.`);
    }

    const supabaseAdmin = createAdminClient();

    // ── Verify OTP ────────────────────────────────────────────────────────
    const { data: otpRecord, error: fetchError } = await supabaseAdmin
      .from("otp_codes")
      .select("*")
      .eq("email", user.email)
      .eq("purpose", "delete_account")
      .eq("used", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !otpRecord) {
      throw ApiError.badRequest("Invalid or expired verification code. Please request a new one.");
    }

    if (otpRecord.attempts >= otpRecord.max_attempts) {
      await supabaseAdmin
        .from("otp_codes")
        .update({ used: true })
        .eq("id", otpRecord.id);
      throw ApiError.badRequest("Too many failed attempts. Please request a new code.");
    }

    await supabaseAdmin
      .from("otp_codes")
      .update({ attempts: otpRecord.attempts + 1 })
      .eq("id", otpRecord.id);

    if (!secureCompare(hashOTP(otp), otpRecord.code_hash)) {
      const remaining = otpRecord.max_attempts - (otpRecord.attempts + 1);
      throw ApiError.badRequest(`Invalid verification code. ${remaining} attempts remaining.`);
    }

    await supabaseAdmin
      .from("otp_codes")
      .update({ used: true })
      .eq("id", otpRecord.id);

    // ── Guard: no duplicate active pending deletion ───────────────────────
    // The partial unique index prevents duplicates at DB level, but check
    // here first to return a friendly error message.
    const { data: existing } = await supabaseAdmin
      .from("pending_deletions")
      .select("scheduled_deletion_at")
      .eq("user_id", user.id)
      .is("cancelled_at", null)
      .single();

    if (existing) {
      const scheduledDate = new Date(existing.scheduled_deletion_at).toLocaleDateString("en-US", {
        month: "long", day: "numeric", year: "numeric",
      });
      throw ApiError.conflict(
        `Your account is already scheduled for deletion on ${scheduledDate}. You can cancel this from your profile page.`
      );
    }

    // ── Schedule deletion ─────────────────────────────────────────────────
    const scheduledAt = new Date();
    scheduledAt.setDate(scheduledAt.getDate() + GRACE_PERIOD_DAYS);

    const { error: insertError } = await supabaseAdmin.from("pending_deletions").insert({
      user_id: user.id,
      email: user.email,
      scheduled_deletion_at: scheduledAt.toISOString(),
      reminder_count: 0,
      reason: reason ?? null,
      ip_address: getClientIp(request),
    });

    if (insertError) {
      console.error("Failed to schedule deletion:", insertError);
      throw ApiError.internal("Failed to schedule account deletion");
    }

    // ── Sign out current session ──────────────────────────────────────────
    await supabase.auth.signOut();

    // ── Confirmation email (non-blocking) ─────────────────────────────────
    sendDeletionScheduledEmail(user.email, scheduledAt.toISOString()).catch((err) =>
      console.error("Failed to send deletion scheduled email:", err)
    );

    return successResponse({
      success: true,
      message: "Account scheduled for deletion",
      scheduledDeletionAt: scheduledAt.toISOString(),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
