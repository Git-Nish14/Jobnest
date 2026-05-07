import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ApiError, errorResponse, validateBody } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyOrigin } from "@/lib/security/csrf";
import { validateMagicBytes, uploadVersionedFile } from "@/lib/utils/storage";
import { ALLOWED_MIME_TYPES } from "@/types/application";
import { scanBuffer } from "@/lib/security/virus-scan";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_LABEL_LEN = 80;

const schema = z.object({
  file_id:        z.string().max(200),
  access_token:   z.string().max(2048),
  file_name:      z.string().max(255),
  mime_type:      z.string().max(120),
  label:          z.string().min(1).max(MAX_LABEL_LEN),
  application_id: z.string().uuid().nullable().optional(),
  is_master:      z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  try {
    if (!verifyOrigin(request)) throw ApiError.forbidden("Invalid request origin.");

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const rl = await checkRateLimit(`drive-import:${user.id}`, { maxRequests: 10, windowMs: 60_000 });
    if (!rl.allowed) throw ApiError.tooManyRequests("Google Drive import rate limit reached. Please wait.");

    const { file_id, access_token, file_name, mime_type, label, application_id, is_master } =
      await validateBody(request, schema);

    if (!is_master && !application_id) {
      throw ApiError.badRequest("application_id is required for non-master documents.");
    }

    // Verify application ownership when not a library doc
    if (!is_master && application_id) {
      const { data: app } = await supabase
        .from("job_applications")
        .select("id")
        .eq("id", application_id)
        .eq("user_id", user.id)
        .single();
      if (!app) throw ApiError.forbidden("Application not found or access denied.");
    }

    // Validate MIME type is allowed
    if (!ALLOWED_MIME_TYPES.includes(mime_type as never)) {
      throw ApiError.badRequest(`File type "${mime_type}" is not supported. Allowed: PDF, DOCX, DOC, TXT, MD, PNG, JPEG.`);
    }

    // Download from Google Drive server-side (never expose access_token to storage)
    const driveRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file_id)}?alt=media`,
      {
        headers: { Authorization: `Bearer ${access_token}` },
        signal:  AbortSignal.timeout(30_000),
      }
    );

    if (!driveRes.ok) {
      const errText = await driveRes.text().catch(() => "");
      console.error("[import-drive] Drive API error:", driveRes.status, errText.slice(0, 200));
      if (driveRes.status === 401 || driveRes.status === 403) {
        throw ApiError.forbidden("Google Drive access denied. Please re-authorise.");
      }
      throw ApiError.badRequest("Could not download file from Google Drive.");
    }

    const buffer = Buffer.from(await driveRes.arrayBuffer());

    if (buffer.length > MAX_FILE_SIZE) {
      throw ApiError.badRequest(`File exceeds the 10 MB limit (${(buffer.length / 1024 / 1024).toFixed(1)} MB).`);
    }

    // Magic-byte content validation
    if (!validateMagicBytes(buffer, mime_type)) {
      throw ApiError.badRequest("File content does not match its declared type. Upload rejected.");
    }

    // Virus scan (fail-open when API key absent)
    const scanResult = await scanBuffer(buffer, file_name);
    if (!scanResult.clean) {
      console.error(`[import-drive] Malware detected — "${scanResult.threat}" from Drive file ${file_id} user ${user.id}`);
      throw ApiError.badRequest(
        `This file was flagged as malicious${scanResult.threat ? ` (${scanResult.threat})` : ""} and cannot be imported.`
      );
    }

    // Build a synthetic File-like object for uploadVersionedFile
    const blob = new Blob([buffer], { type: mime_type });
    const file  = new File([blob], file_name, { type: mime_type });

    const scope       = is_master ? "library" : application_id!;
    const storagePath = await uploadVersionedFile(supabase, user.id, scope, label, file);

    // Mark existing current versions as not current
    if (!is_master && application_id) {
      await supabase
        .from("application_documents")
        .update({ is_current: false })
        .eq("application_id", application_id)
        .eq("user_id", user.id)
        .eq("label", label)
        .eq("is_current", true);
    } else if (is_master) {
      await supabase
        .from("application_documents")
        .update({ is_current: false })
        .is("application_id", null)
        .eq("user_id", user.id)
        .eq("label", label)
        .eq("is_current", true);
    }

    const { data: doc, error: insertError } = await supabase
      .from("application_documents")
      .insert({
        application_id: is_master ? null : application_id,
        user_id:        user.id,
        label,
        storage_path:   storagePath,
        mime_type,
        size_bytes:     buffer.length,
        is_current:     true,
        is_master:      is_master ?? false,
        original_name:  file_name,
      })
      .select()
      .single();

    if (insertError) {
      await supabase.storage.from("documents").remove([storagePath]);
      throw ApiError.internal("Failed to save document record.");
    }

    return NextResponse.json({ document: doc }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
