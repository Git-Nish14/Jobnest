import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyOrigin } from "@/lib/security/csrf";
import { extractTextFromBuffer } from "@/lib/utils/document-parser";

// Session IDs are UUIDs. Reject anything else before letting it into the storage path.
const SESSION_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_FILE_SIZE = 5 * 1024 * 1024;

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
    // Only accept well-formed UUIDs. Reject anything that could be a path traversal attempt.
    const sessionId = rawSessionId && SESSION_ID_RE.test(rawSessionId) ? rawSessionId : null;

    if (!file) throw ApiError.badRequest("Please select a file to upload.");
    if (file.size > MAX_FILE_SIZE) throw ApiError.badRequest("File exceeds the 5 MB size limit.");

    const buffer = Buffer.from(await file.arrayBuffer());
    const { text, error } = await extractTextFromBuffer(buffer, file.name);

    if (error && !text) {
      return NextResponse.json(
        { error: "Could not read this file. Please ensure it is a valid PDF, Word document, or plain text file." },
        { status: 422 }
      );
    }

    // Upload binary to Storage so the user can preview/download it later.
    // Path: chat-attachments/{userId}/{sessionId}/{timestamp}_{filename}
    let storagePath: string | null = null;
    if (sessionId) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      storagePath = `chat-attachments/${user.id}/${sessionId}/${Date.now()}_${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(storagePath, new Uint8Array(buffer), {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });
      if (uploadError) {
        console.error("[parse-file] Storage upload failed:", uploadError.message);
        storagePath = null;
      }
    }

    return NextResponse.json({ text, fileName: file.name, storagePath });
  } catch (error) {
    return errorResponse(error);
  }
}
