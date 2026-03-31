import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { deleteFiles } from "@/lib/utils/storage";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/documents/:id/purge-versions
 * Deletes all non-current versions for the same (application_id, label) group
 * as the document with :id. Returns bytes freed.
 */
export async function POST(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const rl = await checkRateLimit(`doc-purge:${user.id}`, { maxRequests: 10, windowMs: 60_000 });
    if (!rl.allowed) throw ApiError.tooManyRequests("Too many requests.");

    // Get the anchor document so we know which group to purge
    const { data: anchor, error: fetchErr } = await supabase
      .from("application_documents")
      .select("application_id, label, user_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchErr || !anchor) throw ApiError.notFound("Document not found.");

    // Find all non-current versions in the same group
    let query = supabase
      .from("application_documents")
      .select("id, storage_path, size_bytes")
      .eq("user_id", user.id)
      .eq("label", anchor.label)
      .eq("is_current", false);

    if (anchor.application_id) {
      query = query.eq("application_id", anchor.application_id);
    } else {
      query = query.is("application_id", null);
    }

    const { data: oldVersions } = await query;
    if (!oldVersions || oldVersions.length === 0) {
      return NextResponse.json({ deleted: 0, bytes_freed: 0 });
    }

    const paths = oldVersions.map((v) => v.storage_path);
    const ids   = oldVersions.map((v) => v.id);
    const bytesFreed = oldVersions.reduce((sum, v) => sum + (v.size_bytes ?? 0), 0);

    // Delete from storage first
    await deleteFiles(supabase, paths);

    // Then delete DB rows
    await supabase
      .from("application_documents")
      .delete()
      .in("id", ids)
      .eq("user_id", user.id);

    return NextResponse.json({ deleted: oldVersions.length, bytes_freed: bytesFreed });
  } catch (error) {
    return errorResponse(error);
  }
}
