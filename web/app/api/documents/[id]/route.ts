import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { deleteFile } from "@/lib/utils/storage";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const rl = await checkRateLimit(`doc-delete:${user.id}`, { maxRequests: 30, windowMs: 60_000 });
    if (!rl.allowed) throw ApiError.tooManyRequests("Too many requests.");

    // Fetch the document — RLS ensures this user owns it
    const { data: doc, error: fetchError } = await supabase
      .from("application_documents")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !doc) throw ApiError.notFound("Document not found.");

    // If this was the current version, promote the newest older version (if any)
    if (doc.is_current && doc.application_id) {
      const { data: prev } = await supabase
        .from("application_documents")
        .select("id")
        .eq("application_id", doc.application_id)
        .eq("user_id", user.id)
        .eq("label", doc.label)
        .eq("is_current", false)
        .order("uploaded_at", { ascending: false })
        .limit(1)
        .single();

      if (prev) {
        await supabase
          .from("application_documents")
          .update({ is_current: true })
          .eq("id", prev.id);
      }
    }

    // Delete from storage
    await deleteFile(supabase, doc.storage_path);

    // Delete the DB row
    const { error: delError } = await supabase
      .from("application_documents")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (delError) throw ApiError.internal("Failed to delete document record.");

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
