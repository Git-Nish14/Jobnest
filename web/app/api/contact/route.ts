import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

const contactSchema = {
  name: { min: 2, message: "Name must be at least 2 characters" },
  email: { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Invalid email address" },
  subject: { min: 5, message: "Subject must be at least 5 characters" },
  message: { min: 10, message: "Message must be at least 10 characters" },
};

function validateInput(data: Record<string, string>) {
  const errors: Record<string, string> = {};

  if (!data.name || data.name.length < contactSchema.name.min) {
    errors.name = contactSchema.name.message;
  }

  if (!data.email || !contactSchema.email.pattern.test(data.email)) {
    errors.email = contactSchema.email.message;
  }

  if (!data.subject || data.subject.length < contactSchema.subject.min) {
    errors.subject = contactSchema.subject.message;
  }

  if (!data.message || data.message.length < contactSchema.message.min) {
    errors.message = contactSchema.message.message;
  }

  return Object.keys(errors).length > 0 ? errors : null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, subject, message } = body;

    // Validate input
    const validationErrors = validateInput({ name, email, subject, message });
    if (validationErrors) {
      return NextResponse.json(
        { error: "Validation failed", details: validationErrors },
        { status: 400 }
      );
    }

    // Check for required environment variables
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const contactEmail = process.env.CONTACT_EMAIL;

    if (!smtpHost || !smtpUser || !smtpPass || !contactEmail) {
      console.error("Missing email configuration environment variables");
      return NextResponse.json(
        { error: "Email service not configured. Please try again later." },
        { status: 503 }
      );
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort || "587"),
      secure: smtpPort === "465",
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    // Email content
    const mailOptions = {
      from: `"Jobnest Contact" <${smtpUser}>`,
      to: contactEmail,
      replyTo: email,
      subject: `[Jobnest Contact] ${subject}`,
      text: `
Name: ${name}
Email: ${email}
Subject: ${subject}

Message:
${message}
      `,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; border-radius: 12px 12px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">New Contact Form Submission</h1>
  </div>

  <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb;">
      <p style="margin: 0 0 15px;"><strong style="color: #6b7280;">Name:</strong><br>${name}</p>
      <p style="margin: 0 0 15px;"><strong style="color: #6b7280;">Email:</strong><br><a href="mailto:${email}" style="color: #3b82f6;">${email}</a></p>
      <p style="margin: 0 0 15px;"><strong style="color: #6b7280;">Subject:</strong><br>${subject}</p>
      <p style="margin: 0;"><strong style="color: #6b7280;">Message:</strong></p>
      <div style="background: #f3f4f6; padding: 15px; border-radius: 6px; margin-top: 10px; white-space: pre-wrap;">${message}</div>
    </div>

    <p style="margin: 20px 0 0; font-size: 12px; color: #9ca3af; text-align: center;">
      This message was sent from the Jobnest contact form.<br>
      <a href="https://techifive.com" style="color: #3b82f6;">Techifive</a> Product
    </p>
  </div>
</body>
</html>
      `,
    };

    // Send email
    await transporter.sendMail(mailOptions);

    // Send confirmation email to user
    const confirmationOptions = {
      from: `"Jobnest" <${smtpUser}>`,
      to: email,
      subject: "We received your message - Jobnest",
      text: `
Hi ${name},

Thank you for contacting Jobnest! We've received your message and will get back to you as soon as possible.

Here's a copy of your message:

Subject: ${subject}

${message}

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
    <h1 style="color: white; margin: 0; font-size: 24px;">Thank You for Reaching Out!</h1>
  </div>

  <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="margin: 0 0 20px;">Hi ${name},</p>

    <p style="margin: 0 0 20px;">Thank you for contacting Jobnest! We've received your message and will get back to you as soon as possible, typically within 24-48 hours.</p>

    <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin: 20px 0;">
      <p style="margin: 0 0 10px;"><strong>Your message:</strong></p>
      <p style="margin: 0 0 10px; color: #6b7280;"><em>Subject: ${subject}</em></p>
      <div style="background: #f3f4f6; padding: 15px; border-radius: 6px; white-space: pre-wrap; font-size: 14px;">${message}</div>
    </div>

    <p style="margin: 0;">Best regards,<br><strong>The Jobnest Team</strong><br><span style="font-size: 12px; color: #6b7280;">A <a href="https://techifive.com" style="color: #3b82f6;">Techifive</a> Product</span></p>
  </div>

  <p style="margin: 20px 0 0; font-size: 12px; color: #9ca3af; text-align: center;">
    This is an automated confirmation email. Please do not reply directly to this message.<br>
    © ${new Date().getFullYear()} <a href="https://techifive.com" style="color: #3b82f6;">Techifive</a>. All rights reserved.
  </p>
</body>
</html>
      `,
    };

    await transporter.sendMail(confirmationOptions);

    return NextResponse.json({ success: true, message: "Message sent successfully" });
  } catch (error) {
    console.error("Contact form error:", error);
    return NextResponse.json(
      { error: "Failed to send message. Please try again later." },
      { status: 500 }
    );
  }
}
