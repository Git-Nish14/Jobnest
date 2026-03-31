import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** POST /api/documents/:id/restore — makes this version the current one */
export async function POST(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const rl = await checkRateLimit(`doc-restore:${user.id}`, { maxRequests: 30, windowMs: 60_000 });
    if (!rl.allowed) throw ApiError.tooManyRequests("Too many requests.");

    // Fetch target version
    const { data: doc, error: fetchErr } = await supabase
      .from("application_documents")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchErr || !doc) throw ApiError.notFound("Document version not found.");
    if (doc.is_current) {
      return NextResponse.json({ message: "This is already the current version." });
    }

    // Unset current on existing current version for same (application_id / label)
    if (doc.application_id) {
      await supabase
        .from("application_documents")
        .update({ is_current: false })
        .eq("application_id", doc.application_id)
        .eq("user_id", user.id)
        .eq("label", doc.label)
        .eq("is_current", true);
    } else {
      await supabase
        .from("application_documents")
        .update({ is_current: false })
        .is("application_id", null)
        .eq("user_id", user.id)
        .eq("label", doc.label)
        .eq("is_current", true);
    }

    // Promote this version to current
    const { data: updated, error: updateErr } = await supabase
      .from("application_documents")
      .update({ is_current: true })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (updateErr) throw ApiError.internal("Failed to restore version.");

    return NextResponse.json({ document: updated });
  } catch (error) {
    return errorResponse(error);
  }
}
