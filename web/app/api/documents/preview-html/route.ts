import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";
import * as mammoth from "mammoth";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

// GET /api/documents/preview-html?path=<storage-path>
// Converts a DOCX stored in the documents bucket to safe HTML for inline preview.
// The returned HTML is rendered in a sandboxed <iframe srcdoc> on the client
// so no scripts can execute even if mammoth's output contained them.
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const rl = await checkRateLimit(`docx-preview:${user.id}`, { maxRequests: 20, windowMs: 60_000 });
    if (!rl.allowed) throw ApiError.tooManyRequests("Too many preview requests. Please wait a moment.");

    const path = request.nextUrl.searchParams.get("path");
    if (!path) throw ApiError.badRequest("path is required.");

    // Reject any path containing ".." before it reaches storage — defense-in-depth against
    // traversal attempts even though Supabase Storage RLS also enforces ownership.
    if (path.includes("..") || path.startsWith("/")) throw ApiError.badRequest("Invalid path.");

    // Ownership: first path segment must be the user's ID.
    const firstSegment = path.split("/")[0];
    if (firstSegment !== user.id) throw ApiError.forbidden("Access denied.");

    const ext = path.split(".").pop()?.toLowerCase();
    if (ext !== "docx" && ext !== "doc") {
      throw ApiError.badRequest("Only DOCX/DOC files can be converted to HTML preview.");
    }

    const { data, error } = await supabase.storage.from("documents").download(path);
    if (error || !data) throw ApiError.notFound("File not found in storage.");

    const buffer = Buffer.from(await data.arrayBuffer());
    if (buffer.byteLength > MAX_FILE_BYTES) {
      throw ApiError.badRequest("File is too large to preview inline (max 10 MB).");
    }

    const { value: html } = await mammoth.convertToHtml({ buffer });

    return NextResponse.json(
      { html: html || "<p>Document appears to be empty.</p>" },
      { headers: { "Cache-Control": "private, max-age=300" } },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
