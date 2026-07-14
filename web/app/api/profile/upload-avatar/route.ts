import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyOrigin } from "@/lib/security/csrf";
import { ApiError, errorResponse, successResponse } from "@/lib/api/errors";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

function detectMimeFromBytes(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return "image/webp";
  return null;
}

export async function POST(request: NextRequest) {
  try {
    if (!verifyOrigin(request)) {
      throw ApiError.forbidden("Invalid request origin");
    }

    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw ApiError.unauthorized("You must be logged in");
    }

    const rl = await checkRateLimit(`upload-avatar:${user.id}`, { maxRequests: 10, windowMs: 60 * 1000 });
    if (!rl.allowed) {
      throw ApiError.tooManyRequests("Too many uploads. Please wait before trying again.");
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      throw ApiError.badRequest("Invalid form data");
    }

    const file = formData.get("avatar") as File | null;
    if (!file || file.size === 0) {
      throw ApiError.badRequest("No image file provided");
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      throw ApiError.badRequest("Only JPEG, PNG, or WebP images are allowed");
    }

    if (file.size > MAX_BYTES) {
      throw ApiError.badRequest("Image must be under 2 MB");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const actualMime = detectMimeFromBytes(new Uint8Array(buffer));
    if (!actualMime || !ALLOWED_TYPES.includes(actualMime)) {
      throw ApiError.badRequest("File content does not match a valid image format");
    }

    const ext = actualMime === "image/png" ? "png" : actualMime === "image/webp" ? "webp" : "jpg";
    const storagePath = `${user.id}/avatar/profile.${ext}`;

    const admin = createAdminClient();
    const { error: uploadError } = await admin.storage
      .from("documents")
      .upload(storagePath, buffer, { contentType: actualMime, upsert: true });

    if (uploadError) {
      throw ApiError.internal("Upload failed. Please try again.");
    }

    // Long-lived signed URL — 10 years (Supabase max ~315 360 000 s)
    const { data: signed, error: signError } = await admin.storage
      .from("documents")
      .createSignedUrl(storagePath, 315_360_000);

    if (signError || !signed?.signedUrl) {
      throw ApiError.internal("Failed to generate image URL");
    }

    const { error: updateError } = await supabase.auth.updateUser({
      data: { avatar_url: signed.signedUrl },
    });

    if (updateError) {
      throw ApiError.internal("Failed to save avatar to profile");
    }

    return successResponse({ avatarUrl: signed.signedUrl });
  } catch (error) {
    return errorResponse(error);
  }
}
