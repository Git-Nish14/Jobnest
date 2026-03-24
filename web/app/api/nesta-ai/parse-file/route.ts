import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { extractTextFromBuffer } from "@/lib/utils/document-parser";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) throw ApiError.unauthorized();

    const rateLimitResult = checkRateLimit(`parse-file:${user.id}`, {
      maxRequests: 10,
      windowMs: 60 * 1000,
    });
    if (!rateLimitResult.allowed) throw ApiError.tooManyRequests("Too many file uploads. Please wait a moment.");

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) throw ApiError.badRequest("No file provided");
    if (file.size > MAX_FILE_SIZE) throw ApiError.badRequest("File exceeds 5 MB limit");

    const buffer = Buffer.from(await file.arrayBuffer());
    const { text, error } = await extractTextFromBuffer(buffer, file.name);

    if (error && !text) {
      return NextResponse.json({ error }, { status: 422 });
    }

    return NextResponse.json({ text, fileName: file.name });
  } catch (error) {
    return errorResponse(error);
  }
}
