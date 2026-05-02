import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyOrigin } from "@/lib/security/csrf";
import { extractTextFromBuffer } from "@/lib/utils/document-parser";

const SESSION_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const IMAGE_MIME_RE = /^image\//;

export async function POST(request: NextRequest) {
  try {
    if (!verifyOrigin(request)) throw ApiError.forbidden("Invalid request origin.");

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const rl = await checkRateLimit(`parse-file:${user.id}`, { maxRequests: 10, windowMs: 60_000 });
    if (!rl.allowed) throw ApiError.tooManyRequests("Too many file uploads. Please wait a moment.");

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const rawSessionId = (formData.get("session_id") as string | null)?.trim() ?? null;
    const sessionId = rawSessionId && SESSION_ID_RE.test(rawSessionId) ? rawSessionId : null;

    if (!file) throw ApiError.badRequest("Please select a file to upload.");
    if (file.size > MAX_FILE_SIZE) throw ApiError.badRequest("File exceeds the 5 MB size limit.");
    if (!sessionId) throw ApiError.badRequest("A session ID is required to attach files.");

    const buffer = Buffer.from(await file.arrayBuffer());
    const isImage = IMAGE_MIME_RE.test(file.type);

    // Text extraction — images get a context note, everything else is parsed
    let text: string | null;
    if (isImage) {
      text = `[Image attached: ${file.name}]`;
    } else {
      const { text: extracted, error } = await extractTextFromBuffer(buffer, file.name);
      if (error && !extracted) {
        throw ApiError.badRequest(
          "Could not read this file. Please ensure it is a valid PDF, Word document, or plain text file."
        );
      }
      text = extracted;
    }

    // Binary upload to Storage — required for preview. If this fails the attachment is rejected.
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    // Path: {user_id}/chat-attachments/{sessionId}/... — user ID is first segment
    // so the existing storage RLS policy "(foldername)[1] = auth.uid()" passes.
    const storagePath = `${user.id}/chat-attachments/${sessionId}/${Date.now()}_${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(storagePath, new Uint8Array(buffer), {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      console.error("[parse-file] Storage upload failed:", uploadError.message);
      throw ApiError.internal(
        "Could not save your file for preview. Please try again or check your storage quota."
      );
    }

    return NextResponse.json({ text, fileName: file.name, storagePath });
  } catch (error) {
    return errorResponse(error);
  }
}
