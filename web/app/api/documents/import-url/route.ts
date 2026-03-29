import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ApiError, errorResponse, validateBody } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { validateMagicBytes } from "@/lib/utils/storage";
import { ALLOWED_MIME_TYPES } from "@/types/application";
import { z } from "zod";

const MAX_IMPORT_SIZE = 10 * 1024 * 1024; // 10 MB
const FETCH_TIMEOUT_MS = 20_000;

const EXT_TO_MIME: Record<string, string> = {
  pdf:  "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc:  "application/msword",
  txt:  "text/plain",
  md:   "text/markdown",
  png:  "image/png",
  jpg:  "image/jpeg",
  jpeg: "image/jpeg",
};

const importSchema = z.object({
  url:            z.string().url("Invalid URL"),
  label:          z.string().min(1).max(80),
  application_id: z.string().uuid().optional(),
  is_master:      z.boolean().optional().default(false),
});

// ── Content-Disposition helpers ───────────────────────────────────────────────

/**
 * Extracts the filename from a Content-Disposition header value.
 * Handles both plain `filename=` and RFC 5987 `filename*=UTF-8''` forms.
 *
 * Examples:
 *   attachment; filename="My Resume.pdf"          → "My Resume.pdf"
 *   attachment; filename*=UTF-8''My%20Resume.docx → "My Resume.docx"
 */
function extractFilenameFromDisposition(contentDisposition: string): string | null {
  if (!contentDisposition) return null;

  // RFC 5987: filename*=UTF-8''<percent-encoded-name>  (takes priority)
  const rfc5987 = contentDisposition.match(/filename\*=(?:UTF-8'')?([^;\n\r]+)/i);
  if (rfc5987) {
    try { return decodeURIComponent(rfc5987[1].trim()); } catch { /* fall through */ }
  }

  // Plain: filename="name" or filename=name
  const simple = contentDisposition.match(/filename=["']?([^"';\n\r]+)["']?/i);
  return simple ? simple[1].trim() : null;
}

/**
 * Resolves the best MIME type for a response using this priority order:
 *   1. Content-Type (if it's a known specific type)
 *   2. Extension from Content-Disposition filename
 *   3. Extension from the fetch URL path
 *   4. Falls back to the raw Content-Type string
 */
function resolveMimeType(
  contentType: string,
  contentDisposition: string,
  fetchUrl: string
): { mimeType: string; filename: string | null } {
  const rawMime = contentType.split(";")[0].trim().toLowerCase();
  const filename = extractFilenameFromDisposition(contentDisposition);

  // If the server gave us a specific known type, trust it
  if (rawMime && rawMime !== "application/octet-stream" && rawMime !== "binary/octet-stream") {
    return { mimeType: rawMime, filename };
  }

  // Fall back to extension-based inference — Content-Disposition filename first
  const sources = [
    filename,                              // "My Resume.pdf"   from Content-Disposition
    new URL(fetchUrl).pathname,            // "/download"       from URL (usually no ext for GDrive)
  ].filter(Boolean) as string[];

  for (const src of sources) {
    const ext = src.split(".").pop()?.toLowerCase() ?? "";
    if (EXT_TO_MIME[ext]) return { mimeType: EXT_TO_MIME[ext], filename };
  }

  return { mimeType: rawMime, filename };
}

// ── Google Drive helpers ──────────────────────────────────────────────────────

/**
 * Extracts a Google Drive file ID from various share URL formats:
 *   https://drive.google.com/file/d/FILE_ID/view?usp=sharing
 *   https://drive.google.com/open?id=FILE_ID
 *   https://drive.google.com/uc?id=FILE_ID&export=download   (legacy)
 *   https://docs.google.com/document/d/FILE_ID/...
 */
function extractGoogleDriveFileId(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith("google.com")) return null;

    // /file/d/FILE_ID, /document/d/FILE_ID, /spreadsheets/d/FILE_ID, etc.
    const pathMatch = u.pathname.match(/\/d\/([A-Za-z0-9_-]{10,})/);
    if (pathMatch) return pathMatch[1];

    // ?id=FILE_ID  (open?id=, uc?id=)
    const idParam = u.searchParams.get("id");
    if (idParam && /^[A-Za-z0-9_-]{10,}$/.test(idParam)) return idParam;
  } catch {
    // invalid URL
  }
  return null;
}

/**
 * Returns the modern Google Drive direct-download URL.
 * drive.usercontent.google.com is Google's current preferred download host.
 */
function googleDriveDownloadUrl(fileId: string): string {
  return `https://drive.usercontent.google.com/download?id=${fileId}&export=download&authuser=0`;
}

/**
 * Google Drive shows a virus-scan confirmation page for larger files.
 * Parses the confirm= token from the HTML and returns the confirmed download URL.
 */
function extractGoogleDriveConfirmUrl(html: string, fileId: string): string | null {
  // Modern: confirm= param anywhere in the page
  const confirmMatch = html.match(/[?&]confirm=([0-9A-Za-z_-]+)/);
  if (confirmMatch) {
    return `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=${confirmMatch[1]}`;
  }
  // Legacy: /uc?export=download&confirm=... anchor
  const hrefMatch = html.match(/href="(\/uc\?[^"]*confirm=[^"]+)"/);
  if (hrefMatch) {
    return `https://drive.google.com${hrefMatch[1].replace(/&amp;/g, "&")}`;
  }
  return null;
}

// ── Fetch helper ──────────────────────────────────────────────────────────────

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

// ── Route ─────────────────────────────────────────────────────────────────────

/**
 * POST /api/documents/import-url
 * Fetches a publicly accessible file from a URL (including Google Drive share links)
 * and stores it in Supabase Storage after content-type + magic-byte validation.
 *
 * MIME type resolution priority:
 *   Content-Type header → Content-Disposition filename extension → URL path extension
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const rl = checkRateLimit(`doc-import:${user.id}`, { maxRequests: 10, windowMs: 60_000 });
    if (!rl.allowed) throw ApiError.tooManyRequests("Import rate limit reached. Please wait before importing more files.");

    const body = await validateBody(request, importSchema);

    if (!body.is_master && !body.application_id) {
      throw ApiError.badRequest("application_id is required for non-master documents.");
    }

    // Verify application ownership
    if (body.application_id) {
      const { data: app } = await supabase
        .from("job_applications")
        .select("id")
        .eq("id", body.application_id)
        .eq("user_id", user.id)
        .single();
      if (!app) throw ApiError.forbidden("Application not found or access denied.");
    }

    // ── Resolve fetch URL (Google Drive transformation) ──────────────────────
    const gdFileId = extractGoogleDriveFileId(body.url);
    const fetchUrl = gdFileId ? googleDriveDownloadUrl(gdFileId) : body.url;

    // ── First fetch ──────────────────────────────────────────────────────────
    let firstRes: Response;
    try {
      firstRes = await fetchWithTimeout(fetchUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; Jobnest/1.0)" },
        redirect: "follow",
      });
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        throw ApiError.badRequest("The request timed out. Check that the URL is publicly accessible.");
      }
      throw ApiError.badRequest("Could not reach the URL. Make sure it is publicly accessible and returns a file directly.");
    }

    if (!firstRes.ok) {
      const hint = (firstRes.status === 401 || firstRes.status === 403)
        ? "The URL requires authentication. For Google Drive: open the file → Share → set access to \"Anyone with the link\", then paste the share URL here."
        : "Make sure the URL is publicly accessible and points directly to a file.";
      throw ApiError.badRequest(`Remote server returned ${firstRes.status}. ${hint}`);
    }

    // ── Handle Google Drive virus-scan confirmation page ─────────────────────
    // Google returns text/html for files above ~25 MB asking the user to confirm.
    const firstCT = (firstRes.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    let finalRes: Response = firstRes;

    if (firstCT === "text/html" && gdFileId) {
      const html = await firstRes.text();
      const confirmUrl = extractGoogleDriveConfirmUrl(html, gdFileId);

      if (!confirmUrl) {
        throw ApiError.badRequest(
          "Google Drive returned a confirmation page but no download token was found. " +
          "Make sure the file is shared with \"Anyone with the link\" access."
        );
      }

      try {
        finalRes = await fetchWithTimeout(confirmUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; Jobnest/1.0)" },
          redirect: "follow",
        });
      } catch (e) {
        if ((e as Error).name === "AbortError") {
          throw ApiError.badRequest("Google Drive confirmation timed out. Please try again.");
        }
        throw ApiError.badRequest("Failed to complete Google Drive download. Please try again.");
      }

      if (!finalRes.ok) {
        throw ApiError.badRequest(`Google Drive confirmation failed (${finalRes.status}). Please try again.`);
      }

    } else if (firstCT === "text/html") {
      // Non-Google URL returning an HTML page — not a file.
      throw ApiError.badRequest(
        "The URL returned an HTML page instead of a file. " +
        "Paste a direct download link (e.g. ending in .pdf or .docx). " +
        "For Google Drive, use the share link from File → Share → Copy link."
      );
    }

    // ── Resolve MIME type using Content-Type + Content-Disposition ───────────
    const { mimeType, filename: dispositionFilename } = resolveMimeType(
      finalRes.headers.get("content-type") ?? "",
      finalRes.headers.get("content-disposition") ?? "",
      fetchUrl
    );

    if (!mimeType || !ALLOWED_MIME_TYPES.includes(mimeType as never)) {
      const hint = gdFileId
        ? "Could not determine file type. The Google Drive file may be a format that Jobnest does not support. Allowed: PDF, DOCX, DOC, TXT, MD, PNG, JPEG."
        : `File type "${mimeType || "unknown"}" is not supported. Allowed: PDF, DOCX, DOC, TXT, MD, PNG, JPEG.`;
      throw ApiError.badRequest(hint);
    }

    // ── Read body ────────────────────────────────────────────────────────────
    const buffer = Buffer.from(await finalRes.arrayBuffer());

    if (buffer.byteLength > MAX_IMPORT_SIZE) {
      throw ApiError.badRequest(`File is too large (${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB). Maximum is 10 MB.`);
    }

    if (!validateMagicBytes(buffer, mimeType)) {
      throw ApiError.badRequest("File content does not match its declared type. Import rejected.");
    }

    // ── Derive filename ──────────────────────────────────────────────────────
    // Priority: Content-Disposition filename → URL path last segment → label + ext
    const ext        = EXT_TO_MIME[mimeType] ? Object.keys(EXT_TO_MIME).find((k) => EXT_TO_MIME[k] === mimeType) ?? "" : "";
    const rawName    = dispositionFilename
      ?? (gdFileId ? null : new URL(fetchUrl).pathname.split("/").at(-1))
      ?? `${body.label}.${ext}`;
    const sanitised  = rawName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);

    // ── Build storage path + upload ──────────────────────────────────────────
    const timestamp  = Date.now();
    const scope      = body.is_master ? "library" : body.application_id!;
    const sanitLabel = body.label.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
    const storagePath = `${user.id}/${scope}/${sanitLabel}/${timestamp}_${sanitised}`;

    const { error: uploadErr } = await supabase.storage
      .from("documents")
      .upload(storagePath, buffer, { contentType: mimeType, upsert: false });

    if (uploadErr) throw ApiError.internal(`Storage upload failed: ${uploadErr.message}`);

    // ── Mark old current version stale ───────────────────────────────────────
    if (!body.is_master && body.application_id) {
      await supabase
        .from("application_documents")
        .update({ is_current: false })
        .eq("application_id", body.application_id)
        .eq("user_id", user.id)
        .eq("label", body.label)
        .eq("is_current", true);
    }

    // ── Insert document row ──────────────────────────────────────────────────
    const { data: doc, error: insertErr } = await supabase
      .from("application_documents")
      .insert({
        application_id: body.is_master ? null : body.application_id,
        user_id:        user.id,
        label:          body.label,
        storage_path:   storagePath,
        mime_type:      mimeType,
        size_bytes:     buffer.byteLength,
        is_current:     true,
        is_master:      body.is_master,
        original_name:  sanitised,
      })
      .select()
      .single();

    if (insertErr) {
      await supabase.storage.from("documents").remove([storagePath]);
      throw ApiError.internal("Failed to save document record.");
    }

    return NextResponse.json({ document: doc }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
