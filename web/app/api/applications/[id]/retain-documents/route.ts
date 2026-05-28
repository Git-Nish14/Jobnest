import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError, errorResponse, successResponse, validateBody } from "@/lib/api/errors";
import { verifyOrigin } from "@/lib/security/csrf";

const schema = z.object({
  action: z.enum(["retain", "library"]),
});

/**
 * POST /api/applications/:id/retain-documents
 *
 * Cancels the 30-day auto-purge for a rejected application's documents.
 *
 * action = "retain"  → mark the purge queue entry as retained (files stay)
 * action = "library" → copy current docs to the master library, then retain
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!verifyOrigin(request)) throw ApiError.forbidden("Invalid request origin.");

    const { id: applicationId } = await params;
    if (!applicationId) throw ApiError.badRequest("Application ID required.");

    const { action } = await validateBody(request, schema);

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    // Verify the application belongs to this user
    const { data: app } = await supabase
      .from("job_applications")
      .select("id, user_id")
      .eq("id", applicationId)
      .eq("user_id", user.id)
      .single();

    if (!app) throw ApiError.forbidden("Application not found or access denied.");

    const admin = createAdminClient();

    if (action === "library") {
      // Copy current application documents into the master library
      const { data: currentDocs } = await admin
        .from("application_documents")
        .select("id, label, storage_path, mime_type, size_bytes, original_name")
        .eq("application_id", applicationId)
        .eq("user_id", user.id)
        .eq("is_current", true);

      for (const doc of currentDocs ?? []) {
        // Mark any existing master version of the same label as not current
        await admin
          .from("application_documents")
          .update({ is_current: false })
          .is("application_id", null)
          .eq("user_id", user.id)
          .eq("label", doc.label)
          .eq("is_current", true);

        // Guard: storage_path must be owned by this user (defence-in-depth
        // against a polluted DB row bypassing the admin client's bucket RLS).
        if (!doc.storage_path.startsWith(`${user.id}/`)) continue;

        // Copy the storage file to the library path
        const ts            = Date.now();
        const safeName      = (doc.original_name ?? doc.label).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
        const safeLabel     = doc.label.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
        const destPath      = `${user.id}/library/${safeLabel}/${ts}_${safeName}`;

        const { error: copyError } = await admin.storage
          .from("documents")
          .copy(doc.storage_path, destPath);

        if (copyError) continue; // skip if copy fails — don't block retain

        await admin.from("application_documents").insert({
          application_id: null,
          user_id:        user.id,
          label:          doc.label,
          storage_path:   destPath,
          mime_type:      doc.mime_type,
          size_bytes:     doc.size_bytes,
          is_current:     true,
          is_master:      true,
          original_name:  doc.original_name,
        });
      }
    }

    // Mark purge queue entry as retained
    const { error: retainError } = await admin
      .from("document_purge_queue")
      .update({ status: "retained" })
      .eq("application_id", applicationId)
      .eq("user_id", user.id)
      .eq("status", "pending");

    if (retainError) throw ApiError.internal("Failed to cancel document purge.");

    return successResponse({ success: true, action });
  } catch (err) {
    return errorResponse(err);
  }
}
