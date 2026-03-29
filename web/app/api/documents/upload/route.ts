import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { validateMagicBytes, uploadVersionedFile } from "@/lib/utils/storage";
import { ALLOWED_MIME_TYPES } from "@/types/application";

const MAX_FILE_SIZE  = 10 * 1024 * 1024; // 10 MB
const MAX_LABEL_LEN  = 80;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    // Rate limit: 20 uploads per minute per user
    const rl = checkRateLimit(`doc-upload:${user.id}`, { maxRequests: 20, windowMs: 60_000 });
    if (!rl.allowed) throw ApiError.tooManyRequests("Upload rate limit reached. Please wait before uploading more files.");

    const formData = await request.formData();
    const file          = formData.get("file") as File | null;
    const applicationId = (formData.get("application_id") as string | null)?.trim();
    const label         = (formData.get("label") as string | null)?.trim();
    const isMasterRaw   = formData.get("is_master");
    const isMaster      = isMasterRaw === "true";

    if (!file) throw ApiError.badRequest("No file provided.");
    if (!label || label.length === 0) throw ApiError.badRequest("Label is required.");
    if (label.length > MAX_LABEL_LEN) throw ApiError.badRequest(`Label must be at most ${MAX_LABEL_LEN} characters.`);
    if (!isMaster && !applicationId) throw ApiError.badRequest("application_id is required for non-master documents.");

    // Size check
    if (file.size > MAX_FILE_SIZE) {
      throw ApiError.badRequest(`File exceeds the 10 MB limit (${(file.size / 1024 / 1024).toFixed(1)} MB).`);
    }

    // MIME type check
    if (!ALLOWED_MIME_TYPES.includes(file.type as never)) {
      throw ApiError.badRequest(`File type "${file.type}" is not supported. Allowed: PDF, DOCX, DOC, TXT, MD, PNG, JPEG.`);
    }

    // Magic-byte content validation (server-side, prevents extension spoofing)
    const buffer = Buffer.from(await file.arrayBuffer());
    if (!validateMagicBytes(buffer, file.type)) {
      throw ApiError.badRequest("File content does not match its declared type. Upload rejected.");
    }

    // If not master, verify the application belongs to this user
    if (!isMaster && applicationId) {
      const { data: app } = await supabase
        .from("job_applications")
        .select("id")
        .eq("id", applicationId)
        .eq("user_id", user.id)
        .single();

      if (!app) throw ApiError.forbidden("Application not found or access denied.");
    }

    const scope = isMaster ? "library" : applicationId!;

    // Upload to Storage (versioned path)
    const storagePath = await uploadVersionedFile(supabase, user.id, scope, label, file);

    // Mark existing current versions of the same (application_id, label) as not current
    if (!isMaster && applicationId) {
      await supabase
        .from("application_documents")
        .update({ is_current: false })
        .eq("application_id", applicationId)
        .eq("user_id", user.id)
        .eq("label", label)
        .eq("is_current", true);
    } else if (isMaster) {
      await supabase
        .from("application_documents")
        .update({ is_current: false })
        .is("application_id", null)
        .eq("user_id", user.id)
        .eq("label", label)
        .eq("is_current", true);
    }

    // Insert new document row
    const { data: doc, error: insertError } = await supabase
      .from("application_documents")
      .insert({
        application_id: isMaster ? null : applicationId,
        user_id:        user.id,
        label,
        storage_path:   storagePath,
        mime_type:      file.type,
        size_bytes:     file.size,
        is_current:     true,
        is_master:      isMaster,
        original_name:  file.name,
      })
      .select()
      .single();

    if (insertError) {
      // Clean up orphaned storage object
      await supabase.storage.from("documents").remove([storagePath]);
      throw ApiError.internal("Failed to save document record.");
    }

    return NextResponse.json({ document: doc }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
