import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";

/**
 * Validate and parse a Supabase Storage path for the documents bucket.
 *
 * Supported formats:
 *   Legacy  (3 parts): {userId}/{applicationId}/{filename.ext}
 *   Versioned (4 parts): {userId}/{applicationId|"library"}/{label}/{timestamp_filename.ext}
 *
 * Returns parsed parts or null if invalid.
 */
function parsePath(path: string): {
  userId: string;
  scope: string;          // applicationId or "library"
  filename: string;       // last segment (must have an extension)
  isLibrary: boolean;
} | null {
  if (!path) return null;
  const parts = path.split("/");

  // Allow 3-part legacy paths and 4-part versioned paths only
  if (parts.length !== 3 && parts.length !== 4) return null;
  if (parts.some((p) => !p)) return null;

  const filename = parts.at(-1)!;
  if (!filename.includes(".")) return null;          // must have an extension

  const userId = parts[0];
  const scope  = parts[1];                           // applicationId or "library"
  const isLibrary = scope === "library";

  return { userId, scope, filename, isLibrary };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get("path");

    if (!path) throw ApiError.badRequest("Path is required");

    const parsed = parsePath(path);
    if (!parsed) throw ApiError.badRequest("Invalid document path format");

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) throw ApiError.unauthorized();

    const rateLimitResult = await checkRateLimit(`docs:${user.id}`, {
      maxRequests: 60,
      windowMs: 60 * 1000,
    });
    if (!rateLimitResult.allowed) {
      throw ApiError.tooManyRequests("Too many document requests. Please slow down.");
    }

    // User-folder check (first segment must be this user's ID)
    if (parsed.userId !== user.id) {
      throw ApiError.forbidden("You don't have permission to access this document");
    }

    // Application-ownership check (skip for library paths)
    if (!parsed.isLibrary) {
      const { data: application, error: appError } = await supabase
        .from("job_applications")
        .select("id")
        .eq("id", parsed.scope)
        .eq("user_id", user.id)
        .single();

      if (appError || !application) {
        throw ApiError.forbidden("You don't have permission to access this document");
      }
    }

    // Download the file
    const { data, error } = await supabase.storage.from("documents").download(path);
    if (error || !data) throw ApiError.notFound("File not found");

    // Derive Content-Type from the extension of the actual filename (last segment)
    const ext = parsed.filename.split(".").pop()?.toLowerCase() ?? "";
    const MIME: Record<string, string> = {
      pdf:  "application/pdf",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      doc:  "application/msword",
      txt:  "text/plain; charset=utf-8",
      md:   "text/plain; charset=utf-8",
      png:  "image/png",
      jpg:  "image/jpeg",
      jpeg: "image/jpeg",
    };
    const contentType = MIME[ext] ?? "application/octet-stream";

    // For PDF and images we want inline display in the preview iframe/img;
    // for everything else we force a download attachment.
    const inline = ext === "pdf" || ext === "png" || ext === "jpg" || ext === "jpeg";
    const disposition = inline
      ? `inline; filename="${parsed.filename.replace(/"/g, "")}"`
      : `attachment; filename="${parsed.filename.replace(/"/g, "")}"`;

    const arrayBuffer = await data.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      headers: {
        "Content-Type":        contentType,
        "Content-Disposition": disposition,
        "Cache-Control":       "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
