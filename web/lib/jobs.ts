/**
 * Background job dispatcher — inline implementation.
 *
 * All heavy work (PDF parsing, email sending) runs synchronously in the
 * same serverless function for now.  When you are ready to add Trigger.dev,
 * replace the bodies of queueDocumentParse() and queueEmail() with:
 *
 *   const { tasks } = await import("@trigger.dev/sdk/v3");
 *   await tasks.trigger("parse-document", payload);
 *
 * NOTE: @trigger.dev/sdk currently requires zod ^3 which conflicts with this
 * project's zod ^4. Upgrade the SDK once it publishes zod-v4 support.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import nodemailer from "nodemailer";

// ── Document parsing ──────────────────────────────────────────────────────────

export async function queueDocumentParse(payload: {
  userId: string;
  filePath: string;
  documentId: string;
}): Promise<void> {
  const { userId, filePath, documentId } = payload;
  const admin = createAdminClient();

  const { data: fileData, error } = await admin.storage
    .from("documents")
    .download(filePath);
  if (error || !fileData) return;

  const buffer = Buffer.from(await fileData.arrayBuffer());
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  let text: string | null = null;

  if (ext === "pdf") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse: (buf: Buffer) => Promise<{ text: string }> = require("pdf-parse");
    text = (await pdfParse(buffer)).text.replace(/\s{3,}/g, "\n").trim().slice(0, 50_000) || null;
  } else if (ext === "docx" || ext === "doc") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mammoth = require("mammoth") as {
      extractRawText: (o: { buffer: Buffer }) => Promise<{ value: string }>;
    };
    text = (await mammoth.extractRawText({ buffer })).value.trim().slice(0, 50_000) || null;
  } else if (ext === "txt" || ext === "md") {
    text = buffer.toString("utf-8").trim().slice(0, 50_000) || null;
  }

  if (text) {
    await admin
      .from("application_documents")
      .update({ extracted_text: text })
      .eq("id", documentId)
      .eq("user_id", userId);
  }
}

// ── Email sending ─────────────────────────────────────────────────────────────

export async function queueEmail(payload: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_PORT = "587" } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return;

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT),
    secure: SMTP_PORT === "465",
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  await transporter.sendMail({
    from: `"Jobnest" <${SMTP_USER}>`,
    ...payload,
  });
}
