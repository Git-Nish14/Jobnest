import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

const BUCKET = "documents";

// ── Redis document-parse cache ─────────────────────────────────────────────────
// Uses the same Upstash REST endpoint as rate-limit.ts.
// Key: `doc-cache:{sha256}` — TTL 1 hour.
// Falls back silently when Redis is not configured.

const CACHE_TTL_SEC = 3600;

function isRedisConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

// Use the Upstash pipeline (POST + JSON body) so the value is never embedded in
// a URL path segment. Path-based SET encodes the value with encodeURIComponent,
// but HTTP servers decode %2F back to "/" before routing, corrupting any text
// that contains a forward slash (dates, file paths, URLs — essentially every
// real document). The pipeline endpoint is immune to this.

async function redisGet(key: string): Promise<string | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL!;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
  try {
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify([["GET", key]]),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    // Pipeline returns an array of results; first item is the GET result
    const result = Array.isArray(data) ? data[0]?.result : null;
    return typeof result === "string" ? result : null;
  } catch {
    return null;
  }
}

async function redisSet(key: string, value: string): Promise<void> {
  const url = process.env.UPSTASH_REDIS_REST_URL!;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
  try {
    await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify([["SET", key, value, "EX", CACHE_TTL_SEC]]),
      cache: "no-store",
    });
  } catch {
    // Non-fatal — cache miss on error is acceptable
  }
}

function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

async function getCachedText(buf: Buffer): Promise<string | null> {
  if (!isRedisConfigured()) return null;
  return redisGet(`doc-cache:${sha256(buf)}`);
}

async function setCachedText(buf: Buffer, text: string): Promise<void> {
  if (!isRedisConfigured()) return;
  await redisSet(`doc-cache:${sha256(buf)}`, text);
}

/** Max characters to include per document (keeps token usage reasonable) */
const MAX_CHARS = 5000;

interface ParseResult {
  text: string | null;
  error: string | null;
}

// pdf-parse v2 is loaded lazily inside each call. The PDFParse class is
// instantiated with { data: buffer } and cleaned up with destroy().

async function parsePdfBuffer(buffer: Buffer): Promise<ParseResult> {
  const cached = await getCachedText(buffer);
  if (cached) return { text: cached, error: null };

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PDFParse } = require("pdf-parse") as { PDFParse: new (opts: { data: Buffer }) => { getText(): Promise<{ text: string }>; destroy(): Promise<void> } };
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    const text = result.text.replace(/\s{3,}/g, "\n").trim().slice(0, MAX_CHARS);
    if (text) await setCachedText(buffer, text);
    return text
      ? { text, error: null }
      : { text: null, error: "PDF appears to be image-only or has no selectable text." };
  } finally {
    await parser.destroy();
  }
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
      return await parsePdfBuffer(buffer);
    }

    // ── DOCX / DOC ────────────────────────────────────────────────────────
    if (ext === "docx" || ext === "doc") {
      const cached = await getCachedText(buffer);
      if (cached) return { text: cached, error: null };

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mammoth = require("mammoth") as { extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }> };
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value.trim().slice(0, MAX_CHARS);
      if (text) await setCachedText(buffer, text);
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
      return await parsePdfBuffer(buffer);
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
