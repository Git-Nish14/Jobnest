import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ApiError, errorResponse, validateBody } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { z } from "zod";
import { randomBytes } from "crypto";

const TTL_MAP: Record<string, number> = {
  "1d":  1,
  "7d":  7,
  "30d": 30,
};

const shareSchema = z.object({
  document_id: z.string().uuid("Invalid document_id"),
  expires_in:  z.enum(["1d", "7d", "30d"]).default("7d"),
});

/** POST /api/documents/share — create a time-limited public share link */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const rl = checkRateLimit(`doc-share:${user.id}`, { maxRequests: 20, windowMs: 60_000 });
    if (!rl.allowed) throw ApiError.tooManyRequests("Too many requests.");

    const body = await validateBody(request, shareSchema);

    // Verify ownership
    const { data: doc, error: fetchErr } = await supabase
      .from("application_documents")
      .select("id")
      .eq("id", body.document_id)
      .eq("user_id", user.id)
      .single();

    if (fetchErr || !doc) throw ApiError.notFound("Document not found.");

    // Generate a 32-byte URL-safe token
    const token = randomBytes(32).toString("base64url");

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + TTL_MAP[body.expires_in]);

    const { data: link, error: insertErr } = await supabase
      .from("document_shared_links")
      .insert({
        document_id: body.document_id,
        user_id:     user.id,
        token,
        expires_at:  expiresAt.toISOString(),
      })
      .select()
      .single();

    if (insertErr) throw ApiError.internal("Failed to create share link.");

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://jobnest.nishpatel.dev";
    const shareUrl = `${siteUrl}/api/documents/shared/${token}`;

    return NextResponse.json({ link, share_url: shareUrl }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

/** GET /api/documents/share?document_id=<uuid> — list share links for a document */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get("document_id");
    if (!documentId) throw ApiError.badRequest("document_id is required.");

    // Verify ownership
    const { data: doc } = await supabase
      .from("application_documents")
      .select("id")
      .eq("id", documentId)
      .eq("user_id", user.id)
      .single();

    if (!doc) throw ApiError.notFound("Document not found.");

    const { data: links } = await supabase
      .from("document_shared_links")
      .select("*")
      .eq("document_id", documentId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://jobnest.nishpatel.dev";
    const enriched = (links ?? []).map((l) => ({
      ...l,
      share_url:  `${siteUrl}/api/documents/shared/${l.token}`,
      is_expired: new Date(l.expires_at) < new Date(),
    }));

    return NextResponse.json({ links: enriched });
  } catch (error) {
    return errorResponse(error);
  }
}

/** DELETE /api/documents/share?link_id=<uuid> — revoke a share link */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const { searchParams } = new URL(request.url);
    const linkId = searchParams.get("link_id");
    if (!linkId) throw ApiError.badRequest("link_id is required.");

    const { error } = await supabase
      .from("document_shared_links")
      .delete()
      .eq("id", linkId)
      .eq("user_id", user.id);

    if (error) throw ApiError.internal("Failed to revoke link.");

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
