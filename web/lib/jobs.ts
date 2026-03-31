import { createAdminClient } from "@/lib/supabase/admin";
import nodemailer from "nodemailer";

/**
 * Background job dispatcher.
 *
 * When TRIGGER_API_KEY is set, tasks are dispatched to Trigger.dev and run
 * asynchronously — no Vercel timeout risk.
 *
 * When TRIGGER_API_KEY is not set (local dev, CI), tasks run inline
 * synchronously as a graceful fallback so nothing is broken.
 */

function isTriggerConfigured(): boolean {
  return Boolean(process.env.TRIGGER_API_KEY && process.env.TRIGGER_PROJECT_ID);
}

// ── Inline implementations (used as fallback when Trigger.dev is absent) ─────

async function runDocumentParseInline(payload: { userId: string; filePath: string; documentId: string }) {
  const { userId, filePath, documentId } = payload;
  const admin = createAdminClient();
  const { data: fileData, error } = await admin.storage.from("documents").download(filePath);
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
    const mammoth = require("mammoth") as { extractRawText: (o: { buffer: Buffer }) => Promise<{ value: string }> };
    text = (await mammoth.extractRawText({ buffer })).value.trim().slice(0, 50_000) || null;
  } else if (ext === "txt" || ext === "md") {
    text = buffer.toString("utf-8").trim().slice(0, 50_000) || null;
  }

  if (text) {
    await admin.from("application_documents").update({ extracted_text: text }).eq("id", documentId).eq("user_id", userId);
  }
}

async function runEmailInline(payload: { to: string; subject: string; text: string; html: string }) {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_PORT = "587" } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return;
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT),
    secure: SMTP_PORT === "465",
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  await transporter.sendMail({ from: `"Jobnest" <${SMTP_USER}>`, ...payload });
}

// ── Document parsing ──────────────────────────────────────────────────────────

export async function queueDocumentParse(payload: {
  userId: string;
  filePath: string;
  documentId: string;
}): Promise<void> {
  if (isTriggerConfigured()) {
    try {
      const { tasks } = await import("@trigger.dev/sdk/v3");
      await tasks.trigger("parse-document", payload);
      return;
    } catch (err) {
      console.warn("[jobs] Trigger.dev unavailable, running inline:", err);
    }
  }

  // Inline fallback — run the logic directly in this function
  await runDocumentParseInline(payload);
}

// ── Email sending ─────────────────────────────────────────────────────────────

export async function queueEmail(payload: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  if (isTriggerConfigured()) {
    try {
      const { tasks } = await import("@trigger.dev/sdk/v3");
      await tasks.trigger("send-email", payload);
      return;
    } catch (err) {
      console.warn("[jobs] Trigger.dev unavailable for email, running inline:", err);
    }
  }

  // Inline fallback — send synchronously
  await runEmailInline(payload);
}
