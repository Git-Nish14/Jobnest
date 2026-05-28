import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ApiError, errorResponse, successResponse } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyOrigin } from "@/lib/security/csrf";

/**
 * DELETE /api/applications/:id
 *
 * Deletes a job application and all associated Storage files.
 * The application_documents rows and document_purge_queue entry cascade
 * automatically via FK ON DELETE CASCADE; this route also removes the
 * Storage objects so no orphaned files are left in the bucket.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!verifyOrigin(request)) throw ApiError.forbidden("Invalid request origin.");

    const { id } = await params;
    if (!id) throw ApiError.badRequest("Application ID is required.");

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const rl = await checkRateLimit(`app-delete:${user.id}`, {
      maxRequests: 30,
      windowMs: 60_000,
    });
    if (!rl.allowed) throw ApiError.tooManyRequests("Too many requests.");

    // Verify ownership before touching Storage (defence-in-depth on top of RLS)
    const { data: app } = await supabase
      .from("job_applications")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (!app) throw ApiError.notFound("Application not found.");

    // Collect all Storage paths across every document version before the DB row
    // is deleted (cascade would remove application_documents rows, leaving files orphaned).
    const { data: docRows } = await supabase
      .from("application_documents")
      .select("storage_path")
      .eq("application_id", id)
      .eq("user_id", user.id);

    // Also collect legacy paths stored directly on the application row
    const { data: legacyApp } = await supabase
      .from("job_applications")
      .select("resume_path, cover_letter_path")
      .eq("id", id)
      .single();

    const storagePaths = [
      ...(docRows ?? []).map((d) => d.storage_path).filter(Boolean),
      legacyApp?.resume_path,
      legacyApp?.cover_letter_path,
    ].filter((p): p is string => !!p && p.startsWith(`${user.id}/`));

    // Delete Storage files (non-fatal — orphan-cleanup cron will catch stragglers)
    if (storagePaths.length > 0) {
      await supabase.storage.from("documents").remove(storagePaths);
    }

    // Delete the application row — cascades to application_documents,
    // document_purge_queue, activity_logs, reminders, interviews, etc.
    const { error: deleteError } = await supabase
      .from("job_applications")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (deleteError) {
      console.error("[api/applications/delete] failed:", deleteError.message);
      throw ApiError.internal("Failed to delete application.");
    }

    return successResponse({ success: true });
  } catch (err) {
    return errorResponse(err);
  }
}
