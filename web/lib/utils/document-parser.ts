import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "documents";

/** Max characters to include per document (keeps token usage reasonable) */
const MAX_CHARS = 5000;

interface ParseResult {
  text: string | null;
  error: string | null;
}

/**
 * Downloads a file from Supabase Storage and extracts its plain text.
 * Supports: .pdf, .docx, .doc, .txt
 */
export async function extractDocumentText(
  supabase: SupabaseClient,
  filePath: string
): Promise<ParseResult> {
  try {
    const { data, error } = await supabase.storage.from(BUCKET).download(filePath);
    if (error || !data) {
      return { text: null, error: "Could not download file from storage." };
    }

    const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
    const buffer = Buffer.from(await data.arrayBuffer());

    // ── PDF ───────────────────────────────────────────────────────────────
    if (ext === "pdf") {
      // Import the low-level parser directly to avoid pdf-parse's test-file side effect
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse: (buf: Buffer) => Promise<{ text: string }> = require("pdf-parse/lib/pdf-parse.js");
      const result = await pdfParse(buffer);
      const text = result.text.replace(/\s{3,}/g, "\n").trim().slice(0, MAX_CHARS);
      return text
        ? { text, error: null }
        : { text: null, error: "PDF appears to be image-only or has no selectable text." };
    }

    // ── DOCX / DOC ────────────────────────────────────────────────────────
    if (ext === "docx" || ext === "doc") {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mammoth = require("mammoth") as { extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }> };
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value.trim().slice(0, MAX_CHARS);
      return text
        ? { text, error: null }
        : { text: null, error: "Document appears to be empty." };
    }

    // ── Plain text ────────────────────────────────────────────────────────
    if (ext === "txt" || ext === "md") {
      const text = buffer.toString("utf-8").trim().slice(0, MAX_CHARS);
      return { text: text || null, error: text ? null : "File is empty." };
    }

    return {
      text: null,
      error: `File format ".${ext}" is not supported for text extraction. Supported: PDF, DOCX, DOC, TXT.`,
    };
  } catch (err) {
    console.error("Document parse error:", err);
    return { text: null, error: "Failed to extract text from document." };
  }
}

/**
 * Extracts plain text from a raw buffer given the original filename.
 * Used for inline file attachments in the NESTAi chat.
 */
export async function extractTextFromBuffer(
  buffer: Buffer,
  filename: string
): Promise<ParseResult> {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";

  try {
    if (ext === "pdf") {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse: (buf: Buffer) => Promise<{ text: string }> = require("pdf-parse/lib/pdf-parse.js");
      const result = await pdfParse(buffer);
      const text = result.text.replace(/\s{3,}/g, "\n").trim().slice(0, MAX_CHARS);
      return text
        ? { text, error: null }
        : { text: null, error: "PDF appears to be image-only or has no selectable text." };
    }

    if (ext === "docx" || ext === "doc") {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mammoth = require("mammoth") as { extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }> };
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value.trim().slice(0, MAX_CHARS);
      return text
        ? { text, error: null }
        : { text: null, error: "Document appears to be empty." };
    }

    if (ext === "txt" || ext === "md") {
      const text = buffer.toString("utf-8").trim().slice(0, MAX_CHARS);
      return { text: text || null, error: text ? null : "File is empty." };
    }

    return {
      text: null,
      error: `File format ".${ext}" is not supported. Supported: PDF, DOCX, DOC, TXT.`,
    };
  } catch (err) {
    console.error("Buffer parse error:", err);
    return { text: null, error: "Failed to extract text from file." };
  }
}

/**
 * Extracts text from all resume/cover-letter paths attached to the user's
 * applications, deduplicating by storage path so the same file isn't parsed twice.
 */
export async function extractAllDocuments(
  supabase: SupabaseClient,
  applications: Array<{
    id: string;
    company: string;
    position: string;
    resume_path: string | null;
    cover_letter_path: string | null;
  }>
): Promise<Array<{
  applicationId: string;
  company: string;
  position: string;
  type: "resume" | "cover_letter";
  fileName: string;
  text: string | null;
  error: string | null;
}>> {
  // Collect unique (path → metadata) entries to avoid duplicate parses
  const tasks: Array<{
    path: string;
    applicationId: string;
    company: string;
    position: string;
    type: "resume" | "cover_letter";
  }> = [];

  const seen = new Set<string>();

  for (const app of applications) {
    if (app.resume_path && !seen.has(app.resume_path)) {
      seen.add(app.resume_path);
      tasks.push({
        path: app.resume_path,
        applicationId: app.id,
        company: app.company,
        position: app.position,
        type: "resume",
      });
    }
    if (app.cover_letter_path && !seen.has(app.cover_letter_path)) {
      seen.add(app.cover_letter_path);
      tasks.push({
        path: app.cover_letter_path,
        applicationId: app.id,
        company: app.company,
        position: app.position,
        type: "cover_letter",
      });
    }
  }

  // Parse all unique documents in parallel
  const results = await Promise.all(
    tasks.map(async (task) => {
      const { text, error } = await extractDocumentText(supabase, task.path);
      return {
        applicationId: task.applicationId,
        company: task.company,
        position: task.position,
        type: task.type,
        fileName: task.path.split("/").pop() ?? task.path,
        text,
        error,
      };
    })
  );

  return results;
}
