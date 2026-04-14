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
    throw new Error("Missing SMTP configuration environment variables");
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
