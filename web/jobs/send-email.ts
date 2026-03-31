/**
 * Trigger.dev job — send transactional emails in the background.
 *
 * Moves SMTP calls off the request path so email failures don't delay
 * user-facing responses, and retries are handled automatically.
 */
import { task } from "@trigger.dev/sdk/v3";
import nodemailer from "nodemailer";

type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export const sendEmailTask = task({
  id: "send-email",
  maxDuration: 30,
  retry: { maxAttempts: 3 },

  run: async (payload: EmailPayload) => {
    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpPort = process.env.SMTP_PORT ?? "587";

    if (!smtpHost || !smtpUser || !smtpPass) {
      throw new Error("SMTP environment variables are not configured");
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort),
      secure: smtpPort === "465",
      auth: { user: smtpUser, pass: smtpPass },
    });

    const info = await transporter.sendMail({
      from: `"Jobnest" <${smtpUser}>`,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });

    return { messageId: info.messageId };
  },
});
