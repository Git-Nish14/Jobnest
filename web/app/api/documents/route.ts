import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { z } from "zod";

// Document path validation - must be userId/applicationId/filename format
const pathSchema = z
  .string()
  .min(1, "Path is required")
  .refine(
    (path) => {
      const parts = path.split("/");
      // Must have exactly 3 parts: userId, applicationId, filename
      if (parts.length !== 3) return false;
      // Each part must be non-empty
      if (parts.some((p) => !p)) return false;
      // Filename must have an extension
      if (!parts[2].includes(".")) return false;
      return true;
    },
    { message: "Invalid document path format" }
  );

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get("path");

    // Validate path exists
    if (!path) {
      throw ApiError.badRequest("Path is required");
    }

    // Validate path format
    const validationResult = pathSchema.safeParse(path);
    if (!validationResult.success) {
      throw ApiError.badRequest("Invalid document path format");
    }

    const supabase = await createClient();

    // Verify user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw ApiError.unauthorized();
    }

    // Rate limit document access
    const rateLimitResult = checkRateLimit(`docs:${user.id}`, {
      maxRequests: 60,
      windowMs: 60 * 1000, // 60 requests per minute
    });

    if (!rateLimitResult.allowed) {
      throw ApiError.tooManyRequests("Too many document requests. Please slow down.");
    }

    // SECURITY: Verify the path belongs to the user (path format: userId/applicationId/filename)
    const pathParts = path.split("/");
    if (pathParts[0] !== user.id) {
      throw ApiError.forbidden("You don't have permission to access this document");
    }

    // Additional security check: verify the application belongs to the user
    const applicationId = pathParts[1];
    const { data: application, error: appError } = await supabase
      .from("job_applications")
      .select("id")
      .eq("id", applicationId)
      .eq("user_id", user.id)
      .single();

    if (appError || !application) {
      throw ApiError.forbidden("You don't have permission to access this document");
    }

    // Download the file from Supabase storage
    const { data, error } = await supabase.storage.from("documents").download(path);

    if (error || !data) {
      throw ApiError.notFound("File not found");
    }

    // Return the file with appropriate headers.
    // Content-Type is derived from the file extension so we never serve
    // a DOCX or TXT with "application/pdf" (wrong MIME breaks some clients).
    // All files are forced to download (attachment) to prevent browsers from
    // rendering arbitrary content in-page, which could enable stored XSS via
    // an uploaded HTML/SVG file if the bucket is ever misconfigured.
    const filename = pathParts[2];
    const ext = filename.split(".").pop()?.toLowerCase() ?? "";
    const MIME: Record<string, string> = {
      pdf:  "application/pdf",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      doc:  "application/msword",
      txt:  "text/plain; charset=utf-8",
      md:   "text/plain; charset=utf-8",
    };
    const contentType = MIME[ext] ?? "application/octet-stream";
    const arrayBuffer = await data.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
