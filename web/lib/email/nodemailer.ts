import nodemailer from "nodemailer";

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

function getEmailConfig(): EmailConfig {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpHost || !smtpUser || !smtpPass) {
    throw new Error("Missing SMTP configuration environment variables (SMTP_HOST, SMTP_USER, SMTP_PASS)");
  }

  return {
    host: smtpHost,
    port: parseInt(smtpPort || "587"),
    secure: smtpPort === "465",
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  };
}

/**
 * Synchronously checks whether the SMTP env vars are present.
 * Does NOT open a TCP connection — use this at cron startup to fail fast
 * before the user loop begins, so the error appears in Vercel function logs
 * immediately rather than buried in per-user error entries.
 */
export function checkSmtpConfig(): { ok: true } | { ok: false; error: string } {
  try {
    getEmailConfig();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown SMTP config error" };
  }
}

function createTransporter() {
  const config = getEmailConfig();
  return nodemailer.createTransport(config);
}

// Read once at module load — safe for server-side code
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://jobnest.nishpatel.dev";

// ── Security: HTML-escape any user-controlled string before embedding in email HTML
function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

// ── Shared email shell ────────────────────────────────────────────────────────
// Design goals:
//  • Works in Gmail (web + mobile), Apple Mail, Outlook.com, Outlook desktop
//  • No display:flex — Gmail strips class-based flex; Outlook (Word engine) ignores it
//  • All layout via display:inline-block or table — widest email-client support
//  • <style> block kept as progressive enhancement for modern clients
//  • Solid-color fallbacks before every gradient (Outlook ignores gradients)
//  • Dark-mode via @media (prefers-color-scheme: dark) — Apple Mail + Outlook.com
function emailHtml({
  previewText,
  headerBg,
  headerContent,
  bodyContent,
  footerExtra = "",
}: {
  previewText: string;
  headerBg: { solid: string; gradient: string };
  headerContent: string;
  bodyContent: string;
  footerExtra?: string;
}): string {
  const logoUrl = `${APP_URL}/new_logo_1.png`;
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <title>Jobnest</title>
  <style>
    :root { color-scheme: light dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0; padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f4f3f1;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { border: 0; display: block; max-width: 100%; -ms-interpolation-mode: bicubic; }
    a { color: #99462a; }
    .otp-code { font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #99462a; font-family: 'Courier New', Courier, monospace; }
    .btn-link { display: inline-block; padding: 13px 28px; border-radius: 99px; font-weight: 700; font-size: 15px; text-decoration: none; }
    .btn-primary  { background-color: #99462a; color: #ffffff !important; }
    .btn-danger   { background-color: #dc2626; color: #ffffff !important; }
    .btn-amber    { background-color: #d97706; color: #ffffff !important; }
    .btn-green    { background-color: #16a34a; color: #ffffff !important; }
    .callout { border-radius: 8px; padding: 14px 18px; margin: 16px 0; font-size: 14px; line-height: 1.5; }
    .callout-red    { background-color: #fee2e2; border: 1px solid #fca5a5; color: #7f1d1d; }
    .callout-orange { background-color: #ffedd5; border: 1px solid #fdba74; color: #7c2d12; }
    .callout-amber  { background-color: #fef3c7; border: 1px solid #fcd34d; color: #92400e; }
    .callout-green  { background-color: #dcfce7; border: 1px solid #86efac; color: #14532d; }

    @media (prefers-color-scheme: dark) {
      body, .bg-outer { background-color: #111210 !important; }
      .card-body { background-color: #1a1c1b !important; color: #e5e7eb !important; }
      .card-footer { background-color: #111210 !important; border-top-color: #2d2f2e !important; }
      .footer-link { color: #9ca3af !important; }
      .footer-copy { color: #6b7280 !important; }
      .otp-inner { background-color: #2d2f2e !important; border-color: #ccff00 !important; }
      .otp-code { color: #ccff00 !important; }
      p, td { color: #d1d5db !important; }
      h1, h2, .heading { color: #f9fafb !important; }
      .muted { color: #9ca3af !important; }
      .callout-red    { background-color: #3b0e0e !important; border-color: #7f1d1d !important; color: #fca5a5 !important; }
      .callout-orange { background-color: #3b1c0e !important; border-color: #7c2d12 !important; color: #fdba74 !important; }
      .callout-amber  { background-color: #3b2e0e !important; border-color: #92400e !important; color: #fcd34d !important; }
      .callout-green  { background-color: #0e3b1c !important; border-color: #14532d !important; color: #86efac !important; }
      .stat-cell { background-color: #2d2f2e !important; border-color: #3d3f3e !important; }
      .stat-label { color: #9ca3af !important; }
    }
  </style>
</head>
<body>
  <!-- Preheader / preview text (hidden in inbox preview) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:#f4f3f1;">${esc(previewText)}&nbsp;&zwnj;&hairsp;&zwnj;&hairsp;&zwnj;&hairsp;&zwnj;</div>

  <!-- Outer wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="bg-outer" style="background-color:#f4f3f1;">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <!-- Card -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">

          <!-- Header -->
          <tr>
            <td style="background-color:${headerBg.solid};background:${headerBg.gradient};border-radius:16px 16px 0 0;padding:28px 36px 24px;">
              <!-- Logo row: inline-block for Outlook compatibility (flex is stripped) -->
              <div style="margin-bottom:18px;">
                <img src="${logoUrl}" alt="Jobnest" width="32" height="32"
                  style="display:inline-block;vertical-align:middle;border-radius:8px;width:32px;height:32px;" />
                <span style="display:inline-block;vertical-align:middle;margin-left:10px;font-size:20px;font-weight:700;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Jobnest</span>
              </div>
              ${headerContent}
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td class="card-body" style="background-color:#ffffff;padding:32px 36px;color:#1a1c1b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
              ${bodyContent}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="card-footer" style="background-color:#f4f3f1;border-top:1px solid #e5e7eb;border-radius:0 0 16px 16px;padding:22px 36px;">
              <!-- Footer links: inline-block instead of flex for Outlook -->
              <div style="margin-bottom:12px;">
                <a href="${APP_URL}/dashboard" class="footer-link" style="display:inline-block;margin-right:14px;color:#55433d;text-decoration:none;font-size:12px;">Dashboard</a>
                <a href="${APP_URL}/pricing"   class="footer-link" style="display:inline-block;margin-right:14px;color:#55433d;text-decoration:none;font-size:12px;">Pricing</a>
                <a href="${APP_URL}/privacy"   class="footer-link" style="display:inline-block;margin-right:14px;color:#55433d;text-decoration:none;font-size:12px;">Privacy</a>
                <a href="${APP_URL}/contact"   class="footer-link" style="display:inline-block;color:#55433d;text-decoration:none;font-size:12px;">Contact</a>
              </div>
              ${footerExtra}
              <p class="footer-copy" style="margin:0;font-size:11px;color:#9ca3af;line-height:1.5;">
                &copy; ${year} Jobnest &mdash; a <a href="https://nishpatel.dev" style="color:#99462a;text-decoration:none;">Nish Patel</a> product.<br>
                You received this because an action was taken on your account.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ── OTP email ─────────────────────────────────────────────────────────────────
export async function sendOTPEmail(
  email: string,
  otp: string,
  purpose: "login" | "signup" | "password_reset" | "change_password" | "delete_account" = "login"
): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = createTransporter();
    const smtpUser = process.env.SMTP_USER;

    const purposeText: Record<typeof purpose, string> = {
      login:           "sign in to your account",
      signup:          "verify your email address",
      password_reset:  "reset your password",
      change_password: "confirm your password change",
      delete_account:  "confirm your account deletion request",
    };

    const purposeTitle: Record<typeof purpose, string> = {
      login:           "Sign In Verification",
      signup:          "Email Verification",
      password_reset:  "Password Reset",
      change_password: "Password Change Verification",
      delete_account:  "Account Deletion Confirmation",
    };

    const isDanger = purpose === "delete_account";
    const headerBg = isDanger
      ? { solid: "#7f1d1d", gradient: "linear-gradient(135deg,#7f1d1d 0%,#991b1b 100%)" }
      : { solid: "#99462a", gradient: "linear-gradient(135deg,#99462a 0%,#7a3521 100%)" };

    const html = emailHtml({
      previewText: `${otp} is your Jobnest verification code`,
      headerBg,
      headerContent: `<h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${purposeTitle[purpose]}</h1>`,
      bodyContent: `
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">Use the code below to ${purposeText[purpose]}.</p>

        <div class="otp-inner" style="background-color:#f4f3f1;border:2px dashed #99462a;border-radius:12px;text-align:center;padding:22px 20px;margin:20px 0;">
          <div class="otp-code" style="font-size:36px;font-weight:800;letter-spacing:10px;color:#99462a;font-family:'Courier New',Courier,monospace;">${esc(otp)}</div>
        </div>

        <p class="muted" style="margin:0 0 12px;font-size:13px;color:#6b7280;line-height:1.5;">
          This code expires in <strong>10 minutes</strong>. Do not share it with anyone.
        </p>
        <p class="muted" style="margin:20px 0 0;font-size:13px;color:#6b7280;line-height:1.5;">
          If you didn&apos;t request this code, you can safely ignore this email — someone may have entered your email address by mistake.
        </p>
      `,
    });

    await transporter.sendMail({
      from: `"Jobnest" <${smtpUser}>`,
      to: email,
      subject: `${otp} is your Jobnest verification code`,
      text: `Your Jobnest verification code is: ${otp}\n\nUse this code to ${purposeText[purpose]}.\n\nThis code will expire in 10 minutes. Do not share it with anyone.\n\nIf you didn't request this, you can safely ignore this email.\n\nThe Jobnest Team`,
      html,
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to send OTP email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send email",
    };
  }
}

// ── Deletion scheduled email ──────────────────────────────────────────────────
export async function sendDeletionScheduledEmail(
  email: string,
  scheduledDeletionAt: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = createTransporter();
    const smtpUser = process.env.SMTP_USER;
    const deletionDate = formatDate(scheduledDeletionAt);

    const html = emailHtml({
      previewText: `Your Jobnest account is scheduled for deletion on ${deletionDate}`,
      headerBg: { solid: "#7f1d1d", gradient: "linear-gradient(135deg,#7f1d1d 0%,#991b1b 100%)" },
      headerContent: `
        <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Account Deletion Scheduled</h1>
        <p style="margin:6px 0 0;color:rgba(255,255,255,0.75);font-size:14px;">You have 30 days to change your mind.</p>
      `,
      bodyContent: `
        <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151;">Your Jobnest account has been scheduled for permanent deletion on:</p>

        <div class="callout callout-red" style="background-color:#fee2e2;border:1px solid #fca5a5;border-radius:8px;padding:14px 18px;margin:16px 0;text-align:center;">
          <strong style="font-size:18px;color:#7f1d1d;">${esc(deletionDate)}</strong>
        </div>

        <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151;">
          You have <strong>30 days</strong> to change your mind. Simply sign in to your account and the deletion will be immediately cancelled &mdash; no extra steps needed.
        </p>

        <!-- Table-based button for Outlook compatibility -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;">
          <tr>
            <td style="border-radius:99px;background-color:#99462a;">
              <a href="${APP_URL}/login" class="btn-link btn-primary" style="display:inline-block;padding:13px 28px;border-radius:99px;font-weight:700;font-size:15px;text-decoration:none;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Sign In to Cancel Deletion</a>
            </td>
          </tr>
        </table>

        <p class="muted" style="margin:0 0 12px;font-size:13px;color:#6b7280;line-height:1.5;">
          If you take no action, your account and all associated data &mdash; applications, interviews, contacts, salary records, documents, and more &mdash; will be <strong>permanently deleted</strong> on ${esc(deletionDate)}. This cannot be undone.
        </p>
        <p class="muted" style="margin:0 0 12px;font-size:13px;color:#6b7280;line-height:1.5;">We&apos;ll send reminder emails every 7 days until then.</p>

        <div class="callout callout-amber" style="background-color:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:14px 18px;margin:20px 0;font-size:14px;color:#92400e;">
          If you did not request this deletion, please sign in immediately and contact our support team.
        </div>
      `,
    });

    await transporter.sendMail({
      from: `"Jobnest" <${smtpUser}>`,
      to: email,
      subject: "Your Jobnest account has been scheduled for deletion",
      text: `Your Jobnest account has been scheduled for permanent deletion on ${deletionDate}.\n\nYou have 30 days to cancel. Sign in at ${APP_URL}/login to restore your account.\n\nIf you take no action, all your data will be permanently deleted on ${deletionDate}.\n\nThe Jobnest Team`,
      html,
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to send deletion scheduled email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send email",
    };
  }
}

// ── Deletion reminder email ───────────────────────────────────────────────────
export async function sendDeletionReminderEmail(
  email: string,
  scheduledDeletionAt: string,
  daysRemaining: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = createTransporter();
    const smtpUser = process.env.SMTP_USER;
    const deletionDate = formatDate(scheduledDeletionAt);
    const plural = daysRemaining === 1 ? "" : "s";

    const html = emailHtml({
      previewText: `Your Jobnest account will be deleted in ${daysRemaining} day${plural}`,
      headerBg: { solid: "#c2410c", gradient: "linear-gradient(135deg,#c2410c 0%,#9a3412 100%)" },
      headerContent: `
        <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Deletion Reminder</h1>
        <p style="margin:6px 0 0;color:rgba(255,255,255,0.75);font-size:14px;">Your account is still scheduled for deletion.</p>
      `,
      bodyContent: `
        <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151;">This is a reminder that your Jobnest account is scheduled for permanent deletion in:</p>

        <div class="callout callout-orange" style="background-color:#ffedd5;border:1px solid #fdba74;border-radius:8px;padding:14px 18px;margin:16px 0;text-align:center;">
          <span style="font-size:32px;font-weight:800;color:#7c2d12;">${daysRemaining} day${plural}</span>
          <p style="margin:4px 0 0;font-size:13px;color:#7c2d12;">${esc(deletionDate)}</p>
        </div>

        <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151;">
          To restore your account, simply sign in &mdash; your data will be immediately recovered and the deletion cancelled.
        </p>

        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;">
          <tr>
            <td style="border-radius:99px;background-color:#99462a;">
              <a href="${APP_URL}/login" class="btn-link btn-primary" style="display:inline-block;padding:13px 28px;border-radius:99px;font-weight:700;font-size:15px;text-decoration:none;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Sign In to Restore Account</a>
            </td>
          </tr>
        </table>

        <p class="muted" style="margin:0;font-size:13px;color:#6b7280;line-height:1.5;">
          After ${esc(deletionDate)}, your account and all data (applications, interviews, contacts, salary records, templates, and more) will be <strong>permanently deleted</strong> and cannot be recovered.
        </p>
      `,
    });

    await transporter.sendMail({
      from: `"Jobnest" <${smtpUser}>`,
      to: email,
      subject: `Reminder: Your Jobnest account will be deleted in ${daysRemaining} day${plural}`,
      text: `Reminder: Your Jobnest account is scheduled for permanent deletion in ${daysRemaining} day${plural} (${deletionDate}).\n\nTo cancel the deletion, sign in at ${APP_URL}/login.\n\nThe Jobnest Team`,
      html,
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to send deletion reminder email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send email",
    };
  }
}

// ── Deletion final warning email ──────────────────────────────────────────────
export async function sendDeletionFinalWarningEmail(
  email: string,
  scheduledDeletionAt: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = createTransporter();
    const smtpUser = process.env.SMTP_USER;
    const deletionDate = formatDate(scheduledDeletionAt);

    const html = emailHtml({
      previewText: `Final notice: Your Jobnest account will be deleted tomorrow`,
      headerBg: { solid: "#7f1d1d", gradient: "linear-gradient(135deg,#7f1d1d 0%,#450a0a 100%)" },
      headerContent: `
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#fca5a5;">Final Notice</p>
        <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Account Deleted Tomorrow</h1>
      `,
      bodyContent: `
        <p style="margin:0 0 14px;font-size:16px;font-weight:600;line-height:1.5;color:#7f1d1d;">Your account will be permanently deleted on ${esc(deletionDate)}.</p>

        <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151;">
          This is your <strong>last chance</strong> to cancel. Sign in within the next 24&nbsp;hours to restore your account &mdash; your data is still intact right now.
        </p>

        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0;">
          <tr>
            <td style="border-radius:99px;background-color:#dc2626;">
              <a href="${APP_URL}/login" class="btn-link btn-danger" style="display:inline-block;padding:14px 32px;border-radius:99px;font-weight:700;font-size:16px;text-decoration:none;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Sign In Now &mdash; Save My Account</a>
            </td>
          </tr>
        </table>

        <div class="callout callout-red" style="background-color:#fee2e2;border:1px solid #fca5a5;border-radius:8px;padding:14px 18px;margin:20px 0;font-size:14px;line-height:1.5;color:#7f1d1d;">
          After deletion, <strong>all your data is gone forever</strong>: applications, interviews, contacts, salary records, templates, NESTAi history, and more. This cannot be undone.
        </div>
      `,
    });

    await transporter.sendMail({
      from: `"Jobnest" <${smtpUser}>`,
      to: email,
      subject: "Final notice: Your Jobnest account will be deleted tomorrow",
      text: `FINAL NOTICE: Your Jobnest account is scheduled for permanent deletion on ${deletionDate}.\n\nThis is your last chance. Sign in at ${APP_URL}/login within 24 hours to save your account.\n\nThe Jobnest Team`,
      html,
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to send final warning email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send email",
    };
  }
}

// ── Dunning email ─────────────────────────────────────────────────────────────
export async function sendDunningEmail(
  email: string,
  amountDue: number,
  currency: string,
  nextRetryDate: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = createTransporter();
    const smtpUser = process.env.SMTP_USER;

    const formatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amountDue / 100);

    const retryNote = nextRetryDate
      ? `We'll automatically retry the charge on ${new Date(nextRetryDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}.`
      : "Please update your payment method to avoid losing Pro access.";

    const html = emailHtml({
      previewText: `Action required: Your Jobnest Pro payment of ${formatted} failed`,
      headerBg: { solid: "#b45309", gradient: "linear-gradient(135deg,#b45309 0%,#92400e 100%)" },
      headerContent: `
        <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Payment Failed</h1>
        <p style="margin:6px 0 0;color:rgba(255,255,255,0.75);font-size:14px;">Action required to keep your Pro subscription.</p>
      `,
      bodyContent: `
        <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151;">
          Your recent Jobnest Pro payment of <strong>${esc(formatted)}</strong> was unsuccessful.
        </p>

        <div class="callout callout-amber" style="background-color:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:14px 18px;margin:16px 0;font-size:14px;line-height:1.5;color:#92400e;">
          ${esc(retryNote)}
        </div>

        <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151;">To keep your Pro subscription active, update your payment method:</p>

        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;">
          <tr>
            <td style="border-radius:99px;background-color:#d97706;">
              <a href="${APP_URL}/api/stripe/portal" class="btn-link btn-amber" style="display:inline-block;padding:13px 28px;border-radius:99px;font-weight:700;font-size:15px;text-decoration:none;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Update Payment Method</a>
            </td>
          </tr>
        </table>

        <p class="muted" style="margin:0;font-size:13px;color:#6b7280;line-height:1.5;">
          If we&apos;re unable to collect payment, your Pro subscription will be cancelled and you&apos;ll move to the Free plan. All your data is always kept safe.
        </p>
      `,
    });

    await transporter.sendMail({
      from: `"Jobnest" <${smtpUser}>`,
      to: email,
      subject: `Action required: Payment of ${formatted} failed for your Jobnest subscription`,
      text: `Your recent Jobnest Pro payment of ${formatted} was unsuccessful.\n\n${retryNote}\n\nUpdate your payment method: ${APP_URL}/api/stripe/portal\n\nThe Jobnest Team`,
      html,
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to send dunning email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send email",
    };
  }
}

// ── Account reactivated email ─────────────────────────────────────────────────
export async function sendAccountReactivatedEmail(
  email: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = createTransporter();
    const smtpUser = process.env.SMTP_USER;

    const html = emailHtml({
      previewText: "Great news — your Jobnest account has been restored",
      headerBg: { solid: "#15803d", gradient: "linear-gradient(135deg,#15803d 0%,#14532d 100%)" },
      headerContent: `
        <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Account Restored</h1>
        <p style="margin:6px 0 0;color:rgba(255,255,255,0.75);font-size:14px;">Welcome back to Jobnest!</p>
      `,
      bodyContent: `
        <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151;">
          Your Jobnest account has been successfully restored. The scheduled deletion has been cancelled and all your data is fully intact.
        </p>

        <div class="callout callout-green" style="background-color:#dcfce7;border:1px solid #86efac;border-radius:8px;padding:14px 18px;margin:16px 0;font-size:15px;font-weight:600;color:#14532d;text-align:center;">
          Welcome back! Everything is exactly as you left it.
        </div>

        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;">
          <tr>
            <td style="border-radius:99px;background-color:#16a34a;">
              <a href="${APP_URL}/dashboard" class="btn-link btn-green" style="display:inline-block;padding:13px 28px;border-radius:99px;font-weight:700;font-size:15px;text-decoration:none;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Go to Dashboard</a>
            </td>
          </tr>
        </table>

        <p class="muted" style="margin:0;font-size:13px;color:#6b7280;line-height:1.5;">
          If you&apos;d like to delete your account again in the future, you can do so from your Profile settings.
        </p>
      `,
    });

    await transporter.sendMail({
      from: `"Jobnest" <${smtpUser}>`,
      to: email,
      subject: "Your Jobnest account has been restored",
      text: `Your Jobnest account has been successfully restored. All your data is intact.\n\nWelcome back!\n\nGo to your dashboard: ${APP_URL}/dashboard\n\nThe Jobnest Team`,
      html,
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to send account reactivated email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send email",
    };
  }
}

// ── Overdue reminder alert email ──────────────────────────────────────────────
export interface OverdueReminderItem {
  title: string;
  type: string;
  company?: string;
  position?: string;
  daysOverdue: number;
}

export async function sendOverdueReminderEmail(
  email: string,
  displayName: string,
  reminders: OverdueReminderItem[]
): Promise<{ success: boolean; error?: string }> {
  if (reminders.length === 0) return { success: true };

  try {
    const transporter = createTransporter();
    const smtpUser = process.env.SMTP_USER;
    const name = esc(displayName || "there");
    const count = reminders.length;

    const reminderRows = reminders.map(r => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;vertical-align:middle;">
          <div style="font-weight:600;font-size:14px;color:#1a1c1b;">${esc(r.title)}</div>
          ${r.company ? `<div style="font-size:12px;color:#6b7280;">${esc(r.company)}${r.position ? ` — ${esc(r.position)}` : ""}</div>` : ""}
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;text-align:right;white-space:nowrap;vertical-align:middle;">
          <span style="font-size:12px;font-weight:600;padding:3px 10px;border-radius:99px;background-color:#fee2e2;color:#dc2626;">
            ${r.daysOverdue === 0 ? "Due today" : `${r.daysOverdue}d overdue`}
          </span>
        </td>
      </tr>
    `).join("");

    const html = emailHtml({
      previewText: `You have ${count} overdue reminder${count !== 1 ? "s" : ""} that need your attention`,
      headerBg: { solid: "#dc2626", gradient: "linear-gradient(135deg,#dc2626 0%,#b91c1c 100%)" },
      headerContent: `
        <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
          Overdue Reminder${count !== 1 ? "s" : ""}
        </h1>
        <p style="margin:6px 0 0;color:rgba(255,255,255,0.75);font-size:14px;">
          Hi ${name} &mdash; ${count} item${count !== 1 ? "s need" : " needs"} your attention.
        </p>
      `,
      bodyContent: `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
          ${reminderRows}
        </table>

        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;">
          <tr>
            <td style="border-radius:99px;background-color:#99462a;">
              <a href="${APP_URL}/reminders" class="btn-link btn-primary" style="display:inline-block;padding:13px 28px;border-radius:99px;font-weight:700;font-size:15px;text-decoration:none;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Review &amp; Complete Reminders</a>
            </td>
          </tr>
        </table>
      `,
      footerExtra: `
        <p style="font-size:12px;color:#9ca3af;margin:0 0 10px;line-height:1.5;">
          You&apos;re receiving this because overdue reminder alerts are enabled in your
          <a href="${APP_URL}/profile" style="color:#99462a;text-decoration:none;">notification preferences</a>.
          Turn off &ldquo;Overdue reminder alerts&rdquo; in your profile to unsubscribe.
        </p>
      `,
    });

    await transporter.sendMail({
      from: `"Jobnest" <${smtpUser}>`,
      to: email,
      subject: `Action needed: ${count} overdue reminder${count !== 1 ? "s" : ""} on Jobnest`,
      text: `Hi ${displayName || "there"},\n\nYou have ${count} overdue reminder${count !== 1 ? "s" : ""}:\n\n${reminders.map(r => `• ${r.title}${r.company ? ` (${r.company})` : ""} — ${r.daysOverdue === 0 ? "due today" : `${r.daysOverdue}d overdue`}`).join("\n")}\n\nReview them at ${APP_URL}/reminders\n\nThe Jobnest Team`,
      html,
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to send overdue reminder email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send email",
    };
  }
}

// ── Weekly digest email ───────────────────────────────────────────────────────
export interface WeeklyDigestData {
  email: string;
  displayName: string;
  appUrl: string;
  stats: {
    applicationsThisWeek: number;
    totalActive: number;
    upcomingInterviews: number;
    overdueReminders: number;
  };
  recentApplications: { company: string; position: string; status: string }[];
  upcomingInterviews: { company: string; position: string; scheduledAt: string }[];
}

export async function sendWeeklyDigestEmail(
  data: WeeklyDigestData
): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = createTransporter();
    const smtpUser = process.env.SMTP_USER;
    const { email, displayName, appUrl, stats, recentApplications, upcomingInterviews } = data;
    // Escape user-controlled display name before embedding in HTML
    const name = esc(displayName || "there");

    const fmtDate = (iso: string) =>
      new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

    // Stats grid — use <table> for reliable multi-column layout in all email clients
    const statItems = [
      { label: "Applied this week", value: stats.applicationsThisWeek, color: "#99462a" },
      { label: "Active pipeline",   value: stats.totalActive,          color: "#1d4ed8" },
      { label: "Upcoming interviews", value: stats.upcomingInterviews, color: "#059669" },
      { label: "Overdue reminders", value: stats.overdueReminders,     color: stats.overdueReminders > 0 ? "#dc2626" : "#6b7280" },
    ];

    const statsGrid = `
      <table role="presentation" width="100%" cellpadding="6" cellspacing="0" border="0" style="margin-bottom:24px;">
        <tr>
          ${statItems.map(s => `
            <td class="stat-cell" width="25%" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px 8px;text-align:center;vertical-align:top;">
              <div style="font-size:28px;font-weight:800;color:${s.color};line-height:1;">${s.value}</div>
              <div class="stat-label" style="font-size:11px;color:#6b7280;margin-top:4px;line-height:1.3;">${s.label}</div>
            </td>
          `).join("")}
        </tr>
      </table>`;

    const recentAppsHtml = recentApplications.length > 0 ? `
      <h2 style="margin:0 0 10px;font-size:15px;font-weight:700;color:#1a1c1b;">Recent applications</h2>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
        ${recentApplications.map(a => `
          <tr>
            <td style="padding:9px 0;border-bottom:1px solid #f3f4f6;vertical-align:middle;">
              <div style="font-weight:600;font-size:14px;color:#1a1c1b;">${esc(a.company)}</div>
              <div style="font-size:12px;color:#6b7280;">${esc(a.position)}</div>
            </td>
            <td style="padding:9px 0;border-bottom:1px solid #f3f4f6;text-align:right;white-space:nowrap;vertical-align:middle;">
              <span style="font-size:12px;font-weight:600;padding:3px 10px;border-radius:99px;background-color:#f4f3f1;color:#55433d;">${esc(a.status)}</span>
            </td>
          </tr>
        `).join("")}
      </table>
    ` : "";

    const interviewsHtml = upcomingInterviews.length > 0 ? `
      <h2 style="margin:0 0 10px;font-size:15px;font-weight:700;color:#1a1c1b;">Upcoming interviews</h2>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
        ${upcomingInterviews.map(i => `
          <tr>
            <td style="padding:9px 0;border-bottom:1px solid #f3f4f6;vertical-align:middle;">
              <div style="font-weight:600;font-size:14px;color:#1a1c1b;">${esc(i.company)}</div>
              <div style="font-size:12px;color:#6b7280;">${esc(i.position)}</div>
            </td>
            <td style="padding:9px 0;border-bottom:1px solid #f3f4f6;text-align:right;white-space:nowrap;vertical-align:middle;">
              <span style="font-size:12px;color:#55433d;">${esc(fmtDate(i.scheduledAt))}</span>
            </td>
          </tr>
        `).join("")}
      </table>
    ` : "";

    const html = emailHtml({
      previewText: `Hi ${displayName || "there"} — ${stats.applicationsThisWeek} application${stats.applicationsThisWeek !== 1 ? "s" : ""} this week`,
      headerBg: { solid: "#99462a", gradient: "linear-gradient(135deg,#99462a 0%,#7a3521 100%)" },
      headerContent: `
        <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Your Weekly Digest</h1>
        <p style="margin:6px 0 0;color:rgba(255,255,255,0.75);font-size:14px;">Hi ${name} &mdash; here&apos;s how your job search is going</p>
      `,
      bodyContent: `
        ${statsGrid}
        ${recentAppsHtml}
        ${interviewsHtml}
        <p style="color:#55433d;font-size:14px;font-style:italic;text-align:center;margin:16px 0;">Keep going &mdash; every application is a step forward.</p>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0;">
          <tr>
            <td style="border-radius:99px;background-color:#99462a;">
              <a href="${appUrl}/dashboard" class="btn-link btn-primary" style="display:inline-block;padding:13px 28px;border-radius:99px;font-weight:700;font-size:15px;text-decoration:none;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Open Dashboard &rarr;</a>
            </td>
          </tr>
        </table>
      `,
      footerExtra: `
        <p style="font-size:12px;color:#9ca3af;margin:0 0 10px;line-height:1.5;">
          You&apos;re receiving this because weekly digest is enabled in your
          <a href="${appUrl}/profile" style="color:#99462a;text-decoration:none;">notification preferences</a>.
          To unsubscribe, turn off &ldquo;Weekly digest&rdquo; in your profile settings.
        </p>
      `,
    });

    await transporter.sendMail({
      from: `"Jobnest" <${smtpUser}>`,
      to: email,
      subject: `Your weekly job search digest — ${stats.applicationsThisWeek} application${stats.applicationsThisWeek !== 1 ? "s" : ""} this week`,
      text: `Hi ${displayName || "there"},\n\nHere's your Jobnest weekly digest:\n\nApplied this week: ${stats.applicationsThisWeek}\nActive pipeline: ${stats.totalActive}\nUpcoming interviews: ${stats.upcomingInterviews}\nOverdue reminders: ${stats.overdueReminders}\n\nLog in: ${appUrl}/dashboard\n\nThe Jobnest Team`,
      html,
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to send weekly digest email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send email",
    };
  }
}

// ── Application milestone email (100, 200, 300…) ─────────────────────────────
function appMilestoneMessage(n: number): string {
  if (n === 100) return `A century of persistence. Logging 100 applications sets you apart &mdash; the ones who land great roles aren&rsquo;t always the most talented; they&rsquo;re the most consistent.`;
  if (n === 200) return `200 and counting. While most people give up after a few dozen, you&rsquo;ve kept showing up. That resilience separates people who get what they want from everyone else.`;
  if (n === 300) return `300 applications. You&rsquo;re in rare company &mdash; most people never get here. Your commitment is extraordinary, and it will pay off.`;
  if (n === 400) return `400 applications. You&rsquo;ve turned job searching into a discipline. That kind of systematic effort always pays off.`;
  if (n === 500) return `Half a thousand. You are one of the most determined job seekers on Jobnest. The right opportunity is closer than you think.`;
  if (n >= 500)  return `${n.toLocaleString("en-US")} applications. Your persistence is unmatched &mdash; keep going.`;
  return `${n.toLocaleString("en-US")} applications. Each one is a step closer to the role you deserve. You&rsquo;re doing the work.`;
}

export async function sendApplicationMilestoneEmail(
  email: string,
  displayName: string,
  milestone: number,
  stats: { responseRate: number; activePipeline: number; totalOffers: number },
): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = createTransporter();
    const smtpUser = process.env.SMTP_USER;
    const name = esc(displayName || "there");
    const msg = appMilestoneMessage(milestone);
    const n = milestone.toLocaleString("en-US");

    const statCells = [
      stats.responseRate  > 0 ? `<td class="stat-cell" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px 8px;text-align:center;vertical-align:top;"><div style="font-size:24px;font-weight:800;color:#99462a;line-height:1;">${stats.responseRate}%</div><div class="stat-label" style="font-size:11px;color:#6b7280;margin-top:4px;">Response rate</div></td>` : "",
      stats.activePipeline > 0 ? `<td class="stat-cell" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px 8px;text-align:center;vertical-align:top;"><div style="font-size:24px;font-weight:800;color:#1d4ed8;line-height:1;">${stats.activePipeline}</div><div class="stat-label" style="font-size:11px;color:#6b7280;margin-top:4px;">Active pipeline</div></td>` : "",
      stats.totalOffers   > 0 ? `<td class="stat-cell" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px 8px;text-align:center;vertical-align:top;"><div style="font-size:24px;font-weight:800;color:#16a34a;line-height:1;">${stats.totalOffers}</div><div class="stat-label" style="font-size:11px;color:#6b7280;margin-top:4px;">Offer${stats.totalOffers !== 1 ? "s" : ""} received</div></td>` : "",
    ].filter(Boolean);

    const html = emailHtml({
      previewText: `You've logged ${n} applications — that's incredible persistence!`,
      headerBg: { solid: "#99462a", gradient: "linear-gradient(135deg,#99462a 0%,#c2540a 50%,#7a3521 100%)" },
      headerContent: `
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.65);">Milestone Reached</p>
        <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${n} Applications &#127881;</h1>
        <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">Hi ${name} &mdash; you&rsquo;ve hit a remarkable milestone.</p>
      `,
      bodyContent: `
        <div style="text-align:center;padding:28px 0 20px;">
          <div style="display:inline-block;background:linear-gradient(135deg,#99462a,#c2540a);border-radius:20px;padding:22px 40px;">
            <div style="font-size:52px;font-weight:900;color:#ffffff;line-height:1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${n}</div>
            <div style="font-size:13px;font-weight:600;color:rgba(255,255,255,0.8);margin-top:6px;letter-spacing:1px;text-transform:uppercase;">Applications</div>
          </div>
        </div>

        <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#374151;">${msg}</p>

        ${statCells.length > 0 ? `
        <table role="presentation" width="100%" cellpadding="6" cellspacing="0" border="0" style="margin:20px 0;">
          <tr>${statCells.join("")}</tr>
        </table>` : ""}

        <p style="color:#55433d;font-size:14px;font-style:italic;text-align:center;margin:20px 0;">
          &ldquo;The secret to getting ahead is getting started &mdash; and you&rsquo;ve been started for a while now.&rdquo;
        </p>

        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:20px auto;">
          <tr>
            <td style="border-radius:99px;background-color:#99462a;">
              <a href="${APP_URL}/dashboard" class="btn-link btn-primary" style="display:inline-block;padding:13px 28px;border-radius:99px;font-weight:700;font-size:15px;text-decoration:none;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">View Your Dashboard &rarr;</a>
            </td>
          </tr>
        </table>
      `,
      footerExtra: `
        <p style="font-size:12px;color:#9ca3af;margin:0 0 10px;line-height:1.5;">
          You received this milestone celebration automatically. To opt out, visit your
          <a href="${APP_URL}/profile" style="color:#99462a;text-decoration:none;">notification preferences</a>.
        </p>
      `,
    });

    await transporter.sendMail({
      from: `"Jobnest" <${smtpUser}>`,
      to: email,
      subject: `🎉 ${n} applications — you're making it happen!`,
      text: `Hi ${displayName || "there"},\n\nYou've submitted ${n} job applications — that's an incredible milestone!\n\nView your dashboard: ${APP_URL}/dashboard\n\nThe Jobnest Team`,
      html,
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to send application milestone email:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to send email" };
  }
}

// ── Offer milestone email (10, 20, 30…) ──────────────────────────────────────
function offerMilestoneContent(count: number, totalApps: number): { headline: string; body: string } {
  const rate = totalApps > 0 ? Math.round((count / totalApps) * 100) : 0;
  const rateStr = rate > 0 ? ` A ${rate}% offer rate from ${totalApps} applications is genuinely impressive.` : "";
  if (count === 10) return {
    headline: "10 offers. You&rsquo;re doing something right.",
    body: `Getting 10 offers puts you well ahead of the average job seeker.${rateStr} Your resume is landing, your interviews are converting, and the market sees your value.`,
  };
  if (count === 20) return {
    headline: "20 offers. Companies are competing for you.",
    body: `With 20 offers received, you&rsquo;re not just job searching &mdash; you&rsquo;re being recruited.${rateStr} You have real leverage. Be selective and pick the role that genuinely excites you.`,
  };
  if (count === 30) return {
    headline: "30 offers &mdash; an extraordinary pipeline.",
    body: `Thirty companies have made you an offer. That is remarkable by any measure.${rateStr} You&rsquo;ve cracked the code. Trust the process and choose wisely.`,
  };
  return {
    headline: `${count} offers &mdash; incredible.`,
    body: `${count} companies have extended you an offer. That is an extraordinary achievement.${rateStr} You are one of Jobnest&rsquo;s most successful job seekers.`,
  };
}

export async function sendOfferMilestoneEmail(
  email: string,
  displayName: string,
  offerCount: number,
  totalApps: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = createTransporter();
    const smtpUser = process.env.SMTP_USER;
    const name = esc(displayName || "there");
    const { headline, body } = offerMilestoneContent(offerCount, totalApps);
    const offerRate = totalApps > 0 ? Math.round((offerCount / totalApps) * 100) : 0;

    const html = emailHtml({
      previewText: `${offerCount} offers received — companies are choosing you!`,
      headerBg: { solid: "#15803d", gradient: "linear-gradient(135deg,#15803d 0%,#059669 50%,#14532d 100%)" },
      headerContent: `
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.65);">Offer Milestone &#127942;</p>
        <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${headline}</h1>
        <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">Hi ${name} &mdash; this calls for a proper celebration.</p>
      `,
      bodyContent: `
        <div style="text-align:center;padding:28px 0 20px;">
          <div style="display:inline-block;background:linear-gradient(135deg,#15803d,#059669);border-radius:20px;padding:22px 40px;">
            <div style="font-size:52px;font-weight:900;color:#ffffff;line-height:1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${offerCount}</div>
            <div style="font-size:13px;font-weight:600;color:rgba(255,255,255,0.85);margin-top:6px;letter-spacing:1px;text-transform:uppercase;">Offers Received</div>
          </div>
        </div>

        <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#374151;">${body}</p>

        ${totalApps > 0 ? `
        <table role="presentation" width="100%" cellpadding="6" cellspacing="0" border="0" style="margin:20px 0;">
          <tr>
            <td class="stat-cell" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:16px 8px;text-align:center;vertical-align:top;">
              <div style="font-size:28px;font-weight:800;color:#15803d;line-height:1;">${offerCount}</div>
              <div class="stat-label" style="font-size:11px;color:#6b7280;margin-top:4px;">Offers received</div>
            </td>
            ${offerRate > 0 ? `
            <td width="4%" style="padding:0;">&nbsp;</td>
            <td class="stat-cell" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:16px 8px;text-align:center;vertical-align:top;">
              <div style="font-size:28px;font-weight:800;color:#99462a;line-height:1;">${offerRate}%</div>
              <div class="stat-label" style="font-size:11px;color:#6b7280;margin-top:4px;">Offer rate</div>
            </td>
            ` : ""}
          </tr>
        </table>
        ` : ""}

        <p style="color:#15803d;font-size:14px;font-weight:600;font-style:italic;text-align:center;margin:20px 0;">
          You&rsquo;re not just searching for a job &mdash; you&rsquo;re being chosen.
        </p>

        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:20px auto;">
          <tr>
            <td style="border-radius:99px;background-color:#15803d;">
              <a href="${APP_URL}/salary" class="btn-link btn-green" style="display:inline-block;padding:13px 28px;border-radius:99px;font-weight:700;font-size:15px;text-decoration:none;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Compare Your Offers &rarr;</a>
            </td>
          </tr>
        </table>
      `,
      footerExtra: `
        <p style="font-size:12px;color:#9ca3af;margin:0 0 10px;line-height:1.5;">
          You received this milestone celebration based on your offer count. To opt out, visit your
          <a href="${APP_URL}/profile" style="color:#99462a;text-decoration:none;">notification preferences</a>.
        </p>
      `,
    });

    await transporter.sendMail({
      from: `"Jobnest" <${smtpUser}>`,
      to: email,
      subject: `🏆 ${offerCount} offers received — companies are choosing you!`,
      text: `Hi ${displayName || "there"},\n\nYou've received ${offerCount} job offers — that's an incredible achievement!\n\nCompare your offers: ${APP_URL}/salary\n\nThe Jobnest Team`,
      html,
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to send offer milestone email:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to send email" };
  }
}

// ── Weekly motivation email ───────────────────────────────────────────────────
export interface WeeklyMotivationData {
  email: string;
  displayName: string;
  totalApps: number;
  appsThisWeek: number;
  responseRate: number;
  activePipeline: number;
  totalOffers: number;
}

const MOTIVATION_QUOTES = [
  "The people who get things done show up consistently &mdash; not when conditions are perfect.",
  "Rejection is not failure. It&rsquo;s data. What can you improve?",
  "Your next great opportunity doesn&rsquo;t know how many times you&rsquo;ve been turned down.",
  "The job search is a numbers game &mdash; but the numbers only work if you keep playing.",
  "Every &lsquo;no&rsquo; is a redirect, not a dead end.",
  "Persistence beats talent when talent doesn&rsquo;t persist.",
  "The search ends with the right fit. You&rsquo;re narrowing it down every day.",
];

function weeklyMotivationInsight(d: WeeklyMotivationData): string {
  if (d.totalOffers > 0 && d.appsThisWeek > 0)
    return `You have ${d.totalOffers} offer${d.totalOffers !== 1 ? "s" : ""} in hand and added ${d.appsThisWeek} application${d.appsThisWeek !== 1 ? "s" : ""} this week &mdash; building real leverage.`;
  if (d.totalOffers > 0)
    return `With ${d.totalOffers} offer${d.totalOffers !== 1 ? "s" : ""} received, you have real options. You&rsquo;re not just searching &mdash; you&rsquo;re being chosen.`;
  if (d.activePipeline >= 5)
    return `${d.activePipeline} active conversations &mdash; phone screens, interviews, live opportunities. That&rsquo;s a strong pipeline. Results are coming.`;
  if (d.responseRate >= 25)
    return `A ${d.responseRate}% response rate puts you in the top tier of Jobnest users. Your applications are converting.`;
  if (d.appsThisWeek >= 5)
    return `${d.appsThisWeek} applications this week. That&rsquo;s real momentum &mdash; the kind that creates breakthroughs.`;
  if (d.appsThisWeek >= 1)
    return `You added ${d.appsThisWeek} application${d.appsThisWeek !== 1 ? "s" : ""} this week. Consistency is everything in a job search &mdash; you&rsquo;re building it.`;
  if (d.totalApps >= 50)
    return `${d.totalApps} total applications on Jobnest. Persistence like this always pays off eventually.`;
  return `Every application you send is a vote for the future you want. You&rsquo;re putting in the work &mdash; that&rsquo;s what counts.`;
}

export async function sendWeeklyMotivationEmail(
  data: WeeklyMotivationData
): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = createTransporter();
    const smtpUser = process.env.SMTP_USER;
    const { email, displayName, totalApps, appsThisWeek, responseRate, activePipeline, totalOffers } = data;
    const name = esc(displayName || "there");
    const insight = weeklyMotivationInsight(data);

    // Week-number-indexed rotating quote (deterministic per week)
    const weekNum = Math.floor(Date.now() / (7 * 86_400_000));
    const quote = MOTIVATION_QUOTES[weekNum % MOTIVATION_QUOTES.length];

    const statsGrid = `
      <table role="presentation" width="100%" cellpadding="6" cellspacing="0" border="0" style="margin-bottom:20px;">
        <tr>
          <td class="stat-cell" width="25%" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px 6px;text-align:center;vertical-align:top;">
            <div style="font-size:26px;font-weight:800;color:#99462a;line-height:1;">${totalApps}</div>
            <div class="stat-label" style="font-size:10px;color:#6b7280;margin-top:4px;line-height:1.3;">Total applications</div>
          </td>
          <td class="stat-cell" width="25%" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px 6px;text-align:center;vertical-align:top;">
            <div style="font-size:26px;font-weight:800;color:#0ea5e9;line-height:1;">${appsThisWeek}</div>
            <div class="stat-label" style="font-size:10px;color:#6b7280;margin-top:4px;line-height:1.3;">This week</div>
          </td>
          <td class="stat-cell" width="25%" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px 6px;text-align:center;vertical-align:top;">
            <div style="font-size:26px;font-weight:800;color:#7c3aed;line-height:1;">${responseRate}%</div>
            <div class="stat-label" style="font-size:10px;color:#6b7280;margin-top:4px;line-height:1.3;">Response rate</div>
          </td>
          <td class="stat-cell" width="25%" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px 6px;text-align:center;vertical-align:top;">
            <div style="font-size:26px;font-weight:800;color:#059669;line-height:1;">${activePipeline}</div>
            <div class="stat-label" style="font-size:10px;color:#6b7280;margin-top:4px;line-height:1.3;">Active pipeline</div>
          </td>
        </tr>
      </table>`;

    const offersCallout = totalOffers > 0 ? `
      <div class="callout callout-green" style="background-color:#dcfce7;border:1px solid #86efac;border-radius:8px;padding:14px 18px;margin:16px 0;font-size:14px;font-weight:600;color:#14532d;">
        &#127942; You&rsquo;ve received ${totalOffers} offer${totalOffers !== 1 ? "s" : ""} &mdash; you&rsquo;re in demand.
      </div>` : "";

    const milestoneNudge = totalApps > 0 && totalApps < 100 ? `
      <div style="margin:16px 0;">
        <div style="font-size:12px;color:#6b7280;margin-bottom:6px;">Progress to 100-application milestone</div>
        <div style="background:#f3f4f6;border-radius:99px;height:8px;overflow:hidden;">
          <div style="background:linear-gradient(90deg,#99462a,#c2540a);height:8px;width:${Math.min(totalApps, 100)}%;border-radius:99px;"></div>
        </div>
        <div style="font-size:12px;color:#6b7280;margin-top:4px;">${totalApps}/100 &mdash; ${100 - totalApps} to go</div>
      </div>` : "";

    const html = emailHtml({
      previewText: `Hi ${displayName || "there"} — here's your weekly Jobnest motivation`,
      headerBg: { solid: "#99462a", gradient: "linear-gradient(135deg,#99462a 0%,#7a3521 100%)" },
      headerContent: `
        <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Keep Going, ${name}</h1>
        <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;line-height:1.5;">${insight}</p>
      `,
      bodyContent: `
        ${statsGrid}
        ${offersCallout}
        ${milestoneNudge}

        <div style="border-left:3px solid #dbc1b9;padding:12px 16px;margin:20px 0;background:#faf9f7;border-radius:0 8px 8px 0;">
          <p style="margin:0;font-size:14px;font-style:italic;color:#55433d;line-height:1.6;">&ldquo;${quote}&rdquo;</p>
        </div>

        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0;">
          <tr>
            <td style="border-radius:99px;background-color:#99462a;">
              <a href="${APP_URL}/dashboard" class="btn-link btn-primary" style="display:inline-block;padding:13px 28px;border-radius:99px;font-weight:700;font-size:15px;text-decoration:none;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Open Dashboard &rarr;</a>
            </td>
          </tr>
        </table>
      `,
      footerExtra: `
        <p style="font-size:12px;color:#9ca3af;margin:0 0 10px;line-height:1.5;">
          You&rsquo;re receiving this weekly motivation because you&rsquo;re an active Jobnest user.
          To opt out, go to <a href="${APP_URL}/profile" style="color:#99462a;text-decoration:none;">Notification preferences</a>
          and turn off &ldquo;Weekly motivation&rdquo;.
        </p>
      `,
    });

    await transporter.sendMail({
      from: `"Jobnest" <${smtpUser}>`,
      to: email,
      subject: `Keep going, ${displayName || "there"} — your job search is working`,
      text: `Hi ${displayName || "there"},\n\n${insight.replace(/&[a-z]+;|&#\d+;/g, "")}\n\nTotal applications: ${totalApps} | This week: ${appsThisWeek} | Response rate: ${responseRate}% | Pipeline: ${activePipeline}\n\nView your dashboard: ${APP_URL}/dashboard\n\nThe Jobnest Team`,
      html,
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to send weekly motivation email:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to send email" };
  }
}

// ── Re-engagement email ───────────────────────────────────────────────────────

export async function sendReEngagementEmail({
  email,
  displayName,
  appUrl,
  totalApplications,
  activeApplications,
}: {
  email: string;
  displayName: string;
  appUrl: string;
  totalApplications: number;
  activeApplications: number;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = createTransporter();
    const smtpUser = process.env.SMTP_USER;
    const name = esc(displayName || "there");

    const html = emailHtml({
      previewText: "Your job search is waiting — pick up where you left off.",
      headerBg: { solid: "#99462a", gradient: "linear-gradient(135deg,#99462a 0%,#6b2f1a 100%)" },
      headerContent: `
        <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Your job search is waiting</h1>
        <p style="margin:6px 0 0;color:rgba(255,255,255,0.75);font-size:14px;">Pick up where you left off</p>
      `,
      bodyContent: `
        <h2 style="font-size:22px;font-weight:700;color:#1a1c1b;margin:0 0 12px;">
          Your job search is waiting, ${name}.
        </h2>
        <p style="margin:0 0 20px;color:#55433d;line-height:1.6;">
          It's been a while since you logged in to Jobnest. Your applications are still there —
          let's keep the momentum going.
        </p>
        ${totalApplications > 0 ? `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
          <tr>
            <td width="50%" style="padding-right:8px;">
              <div style="background:#f4f3f1;border:1px solid #dbc1b9;border-radius:12px;padding:16px;text-align:center;">
                <div style="font-size:28px;font-weight:800;color:#99462a;">${totalApplications}</div>
                <div style="font-size:12px;color:#55433d;margin-top:4px;">Total applications</div>
              </div>
            </td>
            <td width="50%" style="padding-left:8px;">
              <div style="background:#f4f3f1;border:1px solid #dbc1b9;border-radius:12px;padding:16px;text-align:center;">
                <div style="font-size:28px;font-weight:800;color:#1d4ed8;">${activeApplications}</div>
                <div style="font-size:12px;color:#55433d;margin-top:4px;">Active pipeline</div>
              </div>
            </td>
          </tr>
        </table>
        ` : ""}
        <p style="margin:0 0 24px;color:#55433d;line-height:1.6;">
          Even 10 minutes a day — following up on an application, logging an interview, or
          running an ATS scan — can meaningfully improve your results.
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="border-radius:100px;background:#99462a;">
              <a href="${appUrl}/dashboard"
                 style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:100px;font-family:system-ui,sans-serif;">
                Return to dashboard →
              </a>
            </td>
          </tr>
        </table>
      `,
      footerExtra: `
        <p style="font-size:12px;color:#9ca3af;margin:0 0 10px;line-height:1.5;">
          You received this because you haven&apos;t logged in for 14+ days.
          To opt out of re-engagement emails, go to
          <a href="${appUrl}/profile" style="color:#99462a;text-decoration:none;">Notification preferences</a>
          and turn off &ldquo;Re-engagement emails&rdquo;.
        </p>
      `,
    });

    await transporter.sendMail({
      from: `"Jobnest" <${smtpUser}>`,
      to: email,
      subject: `Your job search is waiting, ${name} — pick up where you left off`,
      text: `Hi ${name},\n\nIt's been a while since you logged in to Jobnest. Your ${totalApplications} applications are still there.\n\nReturn to your dashboard: ${appUrl}/dashboard\n\nThe Jobnest Team`,
      html,
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to send re-engagement email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send email",
    };
  }
}
