import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getSignedUrl } from "@/lib/utils/storage";

/**
 * GET /api/documents/refresh-url?document_id=<uuid>
 * Returns a fresh 24-hour signed URL for a document the user owns.
 * Called automatically by the viewer when a stored URL returns 403.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const rl = await checkRateLimit(`doc-url:${user.id}`, { maxRequests: 120, windowMs: 60_000 });
    if (!rl.allowed) throw ApiError.tooManyRequests("Too many requests.");

    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get("document_id");
    if (!documentId) throw ApiError.badRequest("document_id is required.");

    // Verify ownership via RLS
    const { data: doc, error: fetchErr } = await supabase
      .from("application_documents")
      .select("storage_path")
      .eq("id", documentId)
      .eq("user_id", user.id)
      .single();

    if (fetchErr || !doc) throw ApiError.notFound("Document not found.");

    const signedUrl = await getSignedUrl(supabase, doc.storage_path);
    if (!signedUrl) throw ApiError.internal("Failed to generate signed URL.");

    return NextResponse.json({ signed_url: signedUrl });
  } catch (error) {
    return errorResponse(error);
  }
}
