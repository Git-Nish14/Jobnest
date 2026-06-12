import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { createClient } from "@/lib/supabase/server";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { verifyOrigin } from "@/lib/security/csrf";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { escapeHtml } from "@/lib/security/sanitize";
import { z } from "zod";

const feedbackSchema = z.object({
  score: z.number().int().min(0).max(10),
  comment: z.string().max(1000).trim().optional(),
});

/** NPS colour bands: 0-6 Detractor, 7-8 Passive, 9-10 Promoter */
function scoreColor(score: number): string {
  if (score <= 6) return "#ba1a1a";
  if (score <= 8) return "#d97706";
  return "#006d34";
}

function scoreBand(score: number): string {
  if (score <= 6) return "Detractor";
  if (score <= 8) return "Passive";
  return "Promoter";
}

export async function POST(request: NextRequest) {
  try {
    if (!verifyOrigin(request)) throw ApiError.forbidden("Invalid request origin.");

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    // 3 submissions per 24 h per user
    const rl = await checkRateLimit(`feedback:${user.id}`, { maxRequests: 3, windowMs: 24 * 60 * 60 * 1000 });
    if (!rl.allowed) throw ApiError.tooManyRequests("Please wait before submitting more feedback.");

    const body = await request.json();
    const parsed = feedbackSchema.safeParse(body);
    if (!parsed.success) throw ApiError.badRequest("Invalid feedback data.");

    const { score, comment } = parsed.data;
    const userEmail = user.email ?? "unknown";

    // ── 1. Persist to DB ────────────────────────────────────────────────────
    const { error: insertError } = await supabase.from("user_feedback").insert({
      user_id: user.id,
      score,
      comment: comment || null,
    });
    if (insertError) throw ApiError.internal("Failed to save feedback.");

    // ── 2. Email notification ───────────────────────────────────────────────
    // Non-fatal — if email fails we still return success so the user isn't
    // shown an error for something they can't control.
    const smtpHost    = process.env.SMTP_HOST;
    const smtpPort    = process.env.SMTP_PORT;
    const smtpUser    = process.env.SMTP_USER;
    const smtpPass    = process.env.SMTP_PASS;
    const contactEmail = process.env.CONTACT_EMAIL;

    if (smtpHost && smtpUser && smtpPass && contactEmail) {
      try {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: parseInt(smtpPort || "587") || 587,
          secure: smtpPort === "465",
          auth: { user: smtpUser, pass: smtpPass },
        });

        const safeEmail   = escapeHtml(userEmail);
        const safeComment = comment ? escapeHtml(comment) : null;
        const color       = scoreColor(score);
        const band        = scoreBand(score);

        await transporter.sendMail({
          from:    `"Jobnest Feedback" <${smtpUser}>`,
          to:      contactEmail,
          replyTo: userEmail,          // reply goes straight to the user's inbox
          subject: `[Jobnest Feedback] Score ${score}/10 (${band}) — ${userEmail}`,

          text: [
            `NPS Feedback Submission`,
            ``,
            `From:    ${userEmail}`,
            `Score:   ${score}/10 (${band})`,
            `Comment: ${comment || "—"}`,
            ``,
            `Reply to this email to respond directly to the user.`,
          ].join("\n"),

          html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;">

  <div style="background:linear-gradient(135deg,#99462a 0%,#d97757 100%);padding:28px 30px;border-radius:12px 12px 0 0;">
    <h1 style="color:white;margin:0;font-size:22px;font-weight:700;">Jobnest Feedback</h1>
    <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:14px;">A user just rated their experience</p>
  </div>

  <div style="background:#f9fafb;padding:28px 30px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">

    <!-- Score block -->
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;background:${color};color:white;border-radius:9999px;width:72px;height:72px;line-height:72px;font-size:32px;font-weight:800;text-align:center;">${score}</div>
      <p style="margin:10px 0 0;font-size:13px;font-weight:600;color:${color};text-transform:uppercase;letter-spacing:0.08em;">${band}</p>
      <p style="margin:2px 0 0;font-size:12px;color:#6b7280;">${score} out of 10</p>
    </div>

    <!-- User info -->
    <div style="background:white;border-radius:8px;border:1px solid #e5e7eb;padding:18px 20px;margin-bottom:16px;">
      <p style="margin:0 0 10px;font-size:13px;"><strong style="color:#6b7280;display:block;margin-bottom:3px;">From</strong>
        <a href="mailto:${safeEmail}" style="color:#99462a;font-weight:600;">${safeEmail}</a>
      </p>
      ${safeComment ? `<p style="margin:0;font-size:13px;"><strong style="color:#6b7280;display:block;margin-bottom:6px;">Comment</strong>
        <span style="background:#f3f4f6;display:block;padding:12px;border-radius:6px;white-space:pre-wrap;font-size:13px;">${safeComment}</span>
      </p>` : `<p style="margin:0;font-size:13px;color:#9ca3af;font-style:italic;">No comment provided.</p>`}
    </div>

    <p style="margin:0;font-size:13px;color:#6b7280;background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:12px 14px;">
      💬 <strong>Reply to this email</strong> to respond directly to <a href="mailto:${safeEmail}" style="color:#99462a;">${safeEmail}</a>.
    </p>

    <p style="margin:20px 0 0;font-size:11px;color:#9ca3af;text-align:center;">
      Jobnest Feedback System · <a href="https://jobnest.nishpatel.dev" style="color:#99462a;">jobnest.nishpatel.dev</a>
    </p>
  </div>
</body>
</html>`,
        });
      } catch (emailErr) {
        // Log but don't surface to user — DB write already succeeded
        console.error("[feedback] Email notification failed:", emailErr);
      }
    } else {
      console.warn("[feedback] SMTP not configured — email notification skipped.");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
