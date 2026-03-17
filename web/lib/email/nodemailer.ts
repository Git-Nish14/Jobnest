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
  purpose: "login" | "signup" | "password_reset" = "login"
): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = createTransporter();
    const smtpUser = process.env.SMTP_USER;

    const purposeText = {
      login: "sign in to your account",
      signup: "verify your email address",
      password_reset: "reset your password",
    };

    const purposeTitle = {
      login: "Sign In Verification",
      signup: "Email Verification",
      password_reset: "Password Reset",
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
A Techifive Product
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
      <span style="font-size: 11px;">A <a href="https://techifive.com" style="color: #3b82f6;">Techifive</a> Product</span>
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
