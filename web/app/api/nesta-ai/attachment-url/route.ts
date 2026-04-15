import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ApiError, errorResponse } from "@/lib/api/errors";

// Returns a short-lived signed URL for a chat attachment stored in Supabase Storage.
// Validates that the path belongs to the authenticated user before signing.
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const { searchParams } = new URL(request.url);
    const path = searchParams.get("path");

    if (!path) throw ApiError.badRequest("path is required.");

    // Security: reject path traversal attempts and enforce user ownership.
    if (path.includes("..") || !path.startsWith(`chat-attachments/${user.id}/`)) {
      throw ApiError.forbidden("Access denied.");
    }

    const { data, error } = await supabase.storage
      .from("documents")
      .createSignedUrl(path, 60 * 10); // 10-minute TTL

    if (error || !data?.signedUrl) throw ApiError.notFound("Attachment not found or has expired.");

    return NextResponse.json({ signedUrl: data.signedUrl });
  } catch (error) {
    return errorResponse(error);
  }
}
