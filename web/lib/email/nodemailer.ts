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

export async function sendOTPEmail(
  email: string,
  otp: string,
  purpose: "login" | "signup" | "password_reset" | "change_password" | "delete_account" = "login"
): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = createTransporter();
    const smtpUser = process.env.SMTP_USER;

    const purposeText = {
      login: "sign in to your account",
      signup: "verify your email address",
      password_reset: "reset your password",
      change_password: "confirm your password change",
      delete_account: "confirm your account deletion request",
    };

    const purposeTitle = {
      login: "Sign In Verification",
      signup: "Email Verification",
      password_reset: "Password Reset",
      change_password: "Password Change Verification",
      delete_account: "Account Deletion Confirmation",
    };

    const mailOptions = {
      from: `"Jobnest" <${smtpUser}>`,
      to: email,
      subject: `${otp} is your Jobnest verification code`,
      text: `
Your Jobnest verification code is: ${otp}

Use this code to ${purposeText[purpose]}.

This code will expire in 10 minutes.

If you didn't request this code, you can safely ignore this email.

Best regards,
The Jobnest Team
A Nish Patel product
      `,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">${purposeTitle[purpose]}</h1>
  </div>

  <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="margin: 0 0 20px; text-align: center;">Your verification code is:</p>

    <div style="background: white; padding: 20px; border-radius: 8px; border: 2px dashed #3b82f6; text-align: center; margin: 20px 0;">
      <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1d4ed8;">${otp}</span>
    </div>

    <p style="margin: 20px 0 0; text-align: center; color: #6b7280; font-size: 14px;">
      Use this code to ${purposeText[purpose]}.<br>
      This code will expire in <strong>10 minutes</strong>.
    </p>

    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">
        If you didn't request this code, you can safely ignore this email.<br>
        Someone may have entered your email by mistake.
      </p>
    </div>

    <p style="margin: 20px 0 0; text-align: center; font-size: 12px; color: #6b7280;">
      Best regards,<br>
      <strong>The Jobnest Team</strong><br>
      <span style="font-size: 11px;">A <a href="https://nishpatel.dev" style="color: #3b82f6;">Nish Patel</a> Product</span>
    </p>
  </div>
</body>
</html>
      `,
    };

    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error("Failed to send OTP email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send email",
    };
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export async function sendDeletionScheduledEmail(
  email: string,
  scheduledDeletionAt: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = createTransporter();
    const smtpUser = process.env.SMTP_USER;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://jobnest.nishpatel.dev";
    const deletionDate = formatDate(scheduledDeletionAt);

    await transporter.sendMail({
      from: `"Jobnest" <${smtpUser}>`,
      to: email,
      subject: "Your Jobnest account has been scheduled for deletion",
      text: `
Your Jobnest account has been scheduled for permanent deletion on ${deletionDate}.

You have 30 days to change your mind. Simply sign in to your account at ${appUrl}/login and your account will be immediately restored.

If you take no action, your account and all data will be permanently deleted on ${deletionDate}.

We'll send you reminders every 7 days until then.

Best regards,
The Jobnest Team
A Nish Patel product
      `,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Account Deletion Scheduled</h1>
  </div>
  <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p>Your Jobnest account has been scheduled for permanent deletion on:</p>
    <div style="background: #fee2e2; border: 1px solid #fca5a5; padding: 16px; border-radius: 8px; text-align: center; margin: 20px 0;">
      <strong style="font-size: 18px; color: #b91c1c;">${deletionDate}</strong>
    </div>
    <p>You have <strong>30 days</strong> to change your mind. Simply sign in to your account and it will be immediately restored — no action required beyond logging in.</p>
    <div style="text-align: center; margin: 24px 0;">
      <a href="${appUrl}/login" style="background: #3b82f6; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Sign In to Cancel Deletion</a>
    </div>
    <p style="color: #6b7280; font-size: 14px;">If you take no action, your account and all associated data (applications, interviews, contacts, and more) will be <strong>permanently deleted</strong> on ${deletionDate}. This cannot be undone.</p>
    <p style="color: #6b7280; font-size: 14px;">We'll send you reminder emails every 7 days until then.</p>
    <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">
        If you didn't request this, please sign in immediately and contact our support team.
      </p>
    </div>
    <p style="margin: 20px 0 0; text-align: center; font-size: 12px; color: #6b7280;">
      Best regards,<br><strong>The Jobnest Team</strong><br>
      <span style="font-size: 11px;">A <a href="https://nishpatel.dev" style="color: #3b82f6;">Nish Patel</a> Product</span>
    </p>
  </div>
</body>
</html>
      `,
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

export async function sendDeletionReminderEmail(
  email: string,
  scheduledDeletionAt: string,
  daysRemaining: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = createTransporter();
    const smtpUser = process.env.SMTP_USER;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://jobnest.nishpatel.dev";
    const deletionDate = formatDate(scheduledDeletionAt);

    await transporter.sendMail({
      from: `"Jobnest" <${smtpUser}>`,
      to: email,
      subject: `Reminder: Your Jobnest account will be deleted in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`,
      text: `
Reminder: Your Jobnest account is scheduled for permanent deletion in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"} (${deletionDate}).

To cancel the deletion and restore your account, simply sign in at ${appUrl}/login.

If you take no action, all your data will be permanently deleted on ${deletionDate}.

Best regards,
The Jobnest Team
A Nish Patel product
      `,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #f97316 0%, #c2410c 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">⚠️ Deletion Reminder</h1>
  </div>
  <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p>This is a reminder that your Jobnest account is scheduled for permanent deletion in:</p>
    <div style="background: #ffedd5; border: 1px solid #fdba74; padding: 16px; border-radius: 8px; text-align: center; margin: 20px 0;">
      <strong style="font-size: 28px; color: #c2410c;">${daysRemaining} day${daysRemaining === 1 ? "" : "s"}</strong>
      <p style="margin: 4px 0 0; color: #7c2d12; font-size: 14px;">${deletionDate}</p>
    </div>
    <p>To restore your account, simply sign in — your data will be immediately recovered and the deletion will be cancelled.</p>
    <div style="text-align: center; margin: 24px 0;">
      <a href="${appUrl}/login" style="background: #3b82f6; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Sign In to Restore Account</a>
    </div>
    <p style="color: #6b7280; font-size: 14px;">After ${deletionDate}, your account and all data (applications, interviews, contacts, salary data, and more) will be <strong>permanently deleted</strong> and cannot be recovered.</p>
    <p style="margin: 20px 0 0; text-align: center; font-size: 12px; color: #6b7280;">
      Best regards,<br><strong>The Jobnest Team</strong><br>
      <span style="font-size: 11px;">A <a href="https://nishpatel.dev" style="color: #3b82f6;">Nish Patel</a> Product</span>
    </p>
  </div>
</body>
</html>
      `,
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

export async function sendDeletionFinalWarningEmail(
  email: string,
  scheduledDeletionAt: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = createTransporter();
    const smtpUser = process.env.SMTP_USER;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://jobnest.nishpatel.dev";
    const deletionDate = formatDate(scheduledDeletionAt);

    await transporter.sendMail({
      from: `"Jobnest" <${smtpUser}>`,
      to: email,
      subject: "Final notice: Your Jobnest account will be deleted tomorrow",
      text: `
FINAL NOTICE: Your Jobnest account is scheduled for permanent deletion on ${deletionDate}.

This is your last chance to cancel. Sign in at ${appUrl}/login within the next 24 hours to restore your account. After that, all your data will be permanently deleted and cannot be recovered.

Best regards,
The Jobnest Team
A Nish Patel product
      `,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #dc2626 0%, #7f1d1d 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <p style="color: #fca5a5; font-size: 12px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; margin: 0 0 8px;">Final Notice</p>
    <h1 style="color: white; margin: 0; font-size: 24px;">Account Deleted Tomorrow</h1>
  </div>
  <div style="background: #fff7f7; padding: 30px; border: 2px solid #dc2626; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="font-size: 16px; font-weight: 600; color: #7f1d1d; margin: 0 0 16px;">Your account will be permanently deleted on ${deletionDate}.</p>
    <p>This is your <strong>last chance</strong> to cancel. Sign in within the next 24 hours to restore your account — your data is still intact right now.</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${appUrl}/login" style="background: #dc2626; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 16px; display: inline-block;">Sign In Now — Save My Account</a>
    </div>
    <div style="background: #fee2e2; border-left: 4px solid #dc2626; padding: 12px 16px; border-radius: 0 6px 6px 0; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px; color: #7f1d1d;">
        After deletion, <strong>all your data is gone forever</strong>: applications, interviews, contacts, salary records, templates, and more. This cannot be undone.
      </p>
    </div>
    <p style="margin: 20px 0 0; text-align: center; font-size: 12px; color: #6b7280;">
      Best regards,<br><strong>The Jobnest Team</strong><br>
      <span style="font-size: 11px;">A <a href="https://nishpatel.dev" style="color: #3b82f6;">Nish Patel</a> Product</span>
    </p>
  </div>
</body>
</html>
      `,
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

export async function sendDunningEmail(
  email: string,
  amountDue: number,
  currency: string,
  nextRetryDate: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = createTransporter();
    const smtpUser = process.env.SMTP_USER;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://jobnest.nishpatel.dev";

    const formatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amountDue / 100);

    const retryNote = nextRetryDate
      ? `We'll automatically retry the charge on ${new Date(nextRetryDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}.`
      : "Please update your payment method to avoid losing Pro access.";

    await transporter.sendMail({
      from: `"Jobnest" <${smtpUser}>`,
      to: email,
      subject: `Action required: Payment of ${formatted} failed for your Jobnest subscription`,
      text: `
Your recent Jobnest Pro payment of ${formatted} was unsuccessful.

${retryNote}

To update your payment method, visit your billing portal: ${appUrl}/api/stripe/portal

If we're unable to collect payment your subscription will be cancelled and you'll be moved to the Free plan. All your data will be kept safe.

Best regards,
The Jobnest Team
A Nish Patel product
      `,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #f59e0b 0%, #b45309 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Payment Failed</h1>
  </div>
  <div style="background: #fffbeb; padding: 30px; border: 2px solid #f59e0b; border-top: none; border-radius: 0 0 12px 12px;">
    <p>Your recent Jobnest Pro payment of <strong>${formatted}</strong> was unsuccessful.</p>
    <div style="background: #fef3c7; border: 1px solid #fcd34d; padding: 16px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0; color: #92400e; font-size: 14px;">${retryNote}</p>
    </div>
    <p>To update your payment method and keep your Pro subscription active:</p>
    <div style="text-align: center; margin: 24px 0;">
      <a href="${appUrl}/api/stripe/portal" style="background: #d97706; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Update Payment Method</a>
    </div>
    <p style="color: #6b7280; font-size: 14px;">If we're unable to collect payment your Pro subscription will be cancelled and you'll be moved to the Free plan. All your data is always kept safe.</p>
    <p style="margin: 20px 0 0; text-align: center; font-size: 12px; color: #6b7280;">
      Best regards,<br><strong>The Jobnest Team</strong><br>
      <span style="font-size: 11px;">A <a href="https://nishpatel.dev" style="color: #3b82f6;">Nish Patel</a> Product</span>
    </p>
  </div>
</body>
</html>
      `,
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

export async function sendAccountReactivatedEmail(
  email: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = createTransporter();
    const smtpUser = process.env.SMTP_USER;

    await transporter.sendMail({
      from: `"Jobnest" <${smtpUser}>`,
      to: email,
      subject: "Your Jobnest account has been restored",
      text: `
Great news! Your Jobnest account has been successfully restored. Your scheduled deletion has been cancelled and all your data is intact.

Welcome back!

Best regards,
The Jobnest Team
A Nish Patel product
      `,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #22c55e 0%, #15803d 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Account Restored</h1>
  </div>
  <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p>Your Jobnest account has been successfully restored. The scheduled deletion has been cancelled and all your data is fully intact.</p>
    <div style="background: #dcfce7; border: 1px solid #86efac; padding: 16px; border-radius: 8px; text-align: center; margin: 20px 0;">
      <strong style="color: #15803d;">Welcome back!</strong>
    </div>
    <p style="color: #6b7280; font-size: 14px;">If you'd like to delete your account again in the future, you can do so from your Profile settings.</p>
    <p style="margin: 20px 0 0; text-align: center; font-size: 12px; color: #6b7280;">
      Best regards,<br><strong>The Jobnest Team</strong><br>
      <span style="font-size: 11px;">A <a href="https://nishpatel.dev" style="color: #3b82f6;">Nish Patel</a> Product</span>
    </p>
  </div>
</body>
</html>
      `,
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
    const name = displayName || "there";

    const formatDate = (iso: string) =>
      new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

    await transporter.sendMail({
      from: `"Jobnest" <${smtpUser}>`,
      to: email,
      subject: `Your weekly job search digest — ${stats.applicationsThisWeek} application${stats.applicationsThisWeek !== 1 ? "s" : ""} this week`,
      text: `
Hi ${name},

Here's your Jobnest weekly digest:

📊 This week
• Applications submitted: ${stats.applicationsThisWeek}
• Active pipeline: ${stats.totalActive}
• Upcoming interviews: ${stats.upcomingInterviews}
• Overdue reminders: ${stats.overdueReminders}

${recentApplications.length > 0 ? `Recent applications:\n${recentApplications.map(a => `• ${a.company} — ${a.position} (${a.status})`).join("\n")}` : ""}

${upcomingInterviews.length > 0 ? `Upcoming interviews:\n${upcomingInterviews.map(i => `• ${i.company} — ${i.position} on ${formatDate(i.scheduledAt)}`).join("\n")}` : ""}

Keep going — every application is a step forward.

Log in to your dashboard: ${appUrl}/dashboard

Best regards,
The Jobnest Team
      `,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9fafb;">
  <div style="background: linear-gradient(135deg, #99462a 0%, #7a3521 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 22px;">Your Weekly Digest</h1>
    <p style="color: rgba(255,255,255,0.8); margin: 6px 0 0; font-size: 14px;">Hi ${name} — here's how your search is going</p>
  </div>

  <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">

    <!-- Stats grid -->
    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 28px;">
      ${[
        { label: "Applied this week", value: stats.applicationsThisWeek, color: "#99462a" },
        { label: "Active pipeline", value: stats.totalActive, color: "#1d4ed8" },
        { label: "Upcoming interviews", value: stats.upcomingInterviews, color: "#059669" },
        { label: "Overdue reminders", value: stats.overdueReminders, color: stats.overdueReminders > 0 ? "#dc2626" : "#6b7280" },
      ].map(s => `
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; text-align: center;">
          <div style="font-size: 32px; font-weight: 800; color: ${s.color};">${s.value}</div>
          <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">${s.label}</div>
        </div>
      `).join("")}
    </div>

    <!-- Recent applications -->
    ${recentApplications.length > 0 ? `
    <h2 style="font-size: 16px; font-weight: 700; color: #1a1c1b; margin: 0 0 12px;">Recent applications</h2>
    <div style="margin-bottom: 24px;">
      ${recentApplications.map(a => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #f3f4f6;">
          <div>
            <div style="font-weight: 600; font-size: 14px; color: #1a1c1b;">${a.company}</div>
            <div style="font-size: 12px; color: #6b7280;">${a.position}</div>
          </div>
          <span style="font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 99px; background: #f4f3f1; color: #55433d;">${a.status}</span>
        </div>
      `).join("")}
    </div>
    ` : ""}

    <!-- Upcoming interviews -->
    ${upcomingInterviews.length > 0 ? `
    <h2 style="font-size: 16px; font-weight: 700; color: #1a1c1b; margin: 0 0 12px;">Upcoming interviews</h2>
    <div style="margin-bottom: 24px;">
      ${upcomingInterviews.map(i => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #f3f4f6;">
          <div>
            <div style="font-weight: 600; font-size: 14px; color: #1a1c1b;">${i.company}</div>
            <div style="font-size: 12px; color: #6b7280;">${i.position}</div>
          </div>
          <span style="font-size: 12px; color: #55433d;">${formatDate(i.scheduledAt)}</span>
        </div>
      `).join("")}
    </div>
    ` : ""}

    <!-- CTA -->
    <div style="text-align: center; padding: 20px 0 8px;">
      <p style="color: #55433d; font-size: 14px; margin: 0 0 16px; font-style: italic;">Keep going — every application is a step forward.</p>
      <a href="${appUrl}/dashboard" style="background: #99462a; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Open Dashboard →</a>
    </div>

    <!-- Footer -->
    <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
      <p style="margin: 0; font-size: 12px; color: #9ca3af;">
        You're receiving this because weekly digest is enabled in your <a href="${appUrl}/profile" style="color: #99462a;">notification preferences</a>.<br>
        To unsubscribe, turn off "Weekly digest" in your profile settings.
      </p>
      <p style="margin: 8px 0 0; font-size: 11px; color: #9ca3af;">
        A <a href="https://nishpatel.dev" style="color: #3b82f6;">Nish Patel</a> Product
      </p>
    </div>
  </div>
</body>
</html>
      `,
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
