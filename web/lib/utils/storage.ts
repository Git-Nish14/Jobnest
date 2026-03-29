import { SupabaseClient } from "@supabase/supabase-js";
import { ALLOWED_MIME_TYPES, type AllowedMimeType } from "@/types/application";

const BUCKET_NAME = "documents";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB (expanded from 5 MB)

// ── Signed-URL TTL ────────────────────────────────────────────────────────────
// 24-hour TTL for download links so they don't expire mid-session.
const SIGNED_URL_TTL = 86400; // 24 hours in seconds

// ── Magic-byte signatures ─────────────────────────────────────────────────────
// Validates file content against declared MIME type to prevent extension-spoofing.
const MAGIC: Record<string, number[][]> = {
  "application/pdf":  [[0x25, 0x50, 0x44, 0x46]],                              // %PDF
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
                      [[0x50, 0x4B, 0x03, 0x04], [0x50, 0x4B, 0x05, 0x06]],   // PK zip (DOCX)
  "application/msword": [[0xD0, 0xCF, 0x11, 0xE0]],                            // OLE2 (DOC)
  "image/png":        [[0x89, 0x50, 0x4E, 0x47]],                              // ‰PNG
  "image/jpeg":       [[0xFF, 0xD8, 0xFF]],                                     // JFIF / EXIF
  // text/plain and text/markdown: no reliable magic bytes — skip check
};

/**
 * Validates that the first bytes of a Buffer match the expected magic signature
 * for the declared MIME type. Returns true for MIME types without magic bytes
 * (text/plain, text/markdown) and for unrecognised MIME types.
 */
export function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  const signatures = MAGIC[mimeType];
  if (!signatures) return true; // no magic-byte check for this type

  return signatures.some((sig) =>
    sig.every((byte, i) => buffer[i] === byte)
  );
}

/**
 * Client-side size + MIME-type guard (called before upload).
 * Throws a user-friendly error string on failure.
 */
export function validateFileClient(file: File): void {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File exceeds the 10 MB limit (${(file.size / 1024 / 1024).toFixed(1)} MB uploaded).`);
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type as AllowedMimeType)) {
    throw new Error(
      `File type "${file.type}" is not supported. Allowed types: PDF, DOCX, DOC, TXT, MD, PNG, JPEG.`
    );
  }
}

// ── Legacy upload (kept for existing ApplicationForm) ─────────────────────────
export async function uploadFile(
  supabase: SupabaseClient,
  userId: string,
  applicationId: string,
  file: File,
  type: "resume" | "cover_letter"
): Promise<string | null> {
  validateFileClient(file);

  const fileExt = file.name.split(".").pop();
  const filePath = `${userId}/${applicationId}/${type}.${fileExt}`;

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, file, { upsert: true });

  if (error) throw error;
  return filePath;
}

// ── Versioned upload (used by DocumentManager + upload API) ──────────────────
/**
 * Uploads a file as a new version under the given label. Does NOT set is_current
 * on the DB row — the caller is responsible for updating application_documents.
 *
 * Path format: {userId}/{applicationId|"library"}/{label}/{timestamp}_{filename}
 */
export async function uploadVersionedFile(
  supabase: SupabaseClient,
  userId: string,
  scope: string,   // applicationId or "library" for master documents
  label: string,
  file: File
): Promise<string> {
  validateFileClient(file);

  const sanitisedLabel = label.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
  const sanitisedName  = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
  const timestamp      = Date.now();
  const filePath       = `${userId}/${scope}/${sanitisedLabel}/${timestamp}_${sanitisedName}`;

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, file, { upsert: false });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return filePath;
}

// ── File deletion ─────────────────────────────────────────────────────────────
export async function deleteFile(
  supabase: SupabaseClient,
  filePath: string
): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET_NAME).remove([filePath]);
  if (error) throw error;
}

export async function deleteFiles(
  supabase: SupabaseClient,
  filePaths: string[]
): Promise<void> {
  if (filePaths.length === 0) return;
  const { error } = await supabase.storage.from(BUCKET_NAME).remove(filePaths);
  if (error) throw error;
}

// ── Signed URLs ───────────────────────────────────────────────────────────────

/** Returns a 24-hour signed download URL. */
export async function getSignedUrl(
  supabase: SupabaseClient,
  filePath: string
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(filePath, SIGNED_URL_TTL);

  if (error) {
    console.error("Error getting signed URL:", error);
    return null;
  }
  return data.signedUrl;
}

/** Returns signed URLs for multiple paths in a single request. */
export async function getSignedUrls(
  supabase: SupabaseClient,
  filePaths: string[]
): Promise<Record<string, string>> {
  if (filePaths.length === 0) return {};

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrls(filePaths, SIGNED_URL_TTL);

  if (error || !data) {
    console.error("Error getting signed URLs:", error);
    return {};
  }

  return Object.fromEntries(
    data
      .filter((d) => d.signedUrl)
      .map((d) => [d.path, d.signedUrl!])
  );
}

// ── MIME helpers ──────────────────────────────────────────────────────────────
export const MIME_TO_EXT: Record<string, string> = {
  "application/pdf":  "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/msword": "doc",
  "text/plain":       "txt",
  "text/markdown":    "md",
  "image/png":        "png",
  "image/jpeg":       "jpg",
};

export function mimeToLabel(mimeType: string): string {
  const labels: Record<string, string> = {
    "application/pdf":  "PDF",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
    "application/msword": "DOC",
    "text/plain":       "TXT",
    "text/markdown":    "MD",
    "image/png":        "PNG",
    "image/jpeg":       "JPEG",
  };
  return labels[mimeType] ?? "File";
}

export function isPreviewable(mimeType: string): boolean {
  return mimeType === "application/pdf" || mimeType.startsWith("image/");
}

export function isTextExtractable(mimeType: string): boolean {
  return [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "text/plain",
    "text/markdown",
  ].includes(mimeType);
}
