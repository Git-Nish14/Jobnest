import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/security/rate-limit";

interface RouteContext {
  params: Promise<{ token: string }>;
}

/**
 * GET /api/documents/shared/:token
 * Public endpoint — no auth required.
 * Validates the token, increments view_count, and redirects to a short-lived signed URL.
 * Uses the admin client because the document_shared_links table requires service role
 * to read via token without user auth context.
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  const { token } = await params;

  // Rate limit by IP to prevent enumeration (100/min)
  const ip = request.headers.get("x-real-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim()
    ?? "unknown";
  const rl = await checkRateLimit(`shared-doc:${ip}`, { maxRequests: 100, windowMs: 60_000 });
  if (!rl.allowed) {
    return new NextResponse("Too many requests", { status: 429 });
  }

  if (!token || token.length < 10) {
    return new NextResponse("Invalid link", { status: 400 });
  }

  const supabase = createAdminClient();

  // Look up the token
  const { data: link, error } = await supabase
    .from("document_shared_links")
    .select("id, document_id, expires_at, view_count")
    .eq("token", token)
    .single();

  if (error || !link) {
    return new NextResponse("Link not found or has been revoked.", { status: 404 });
  }

  if (new Date(link.expires_at) < new Date()) {
    return new NextResponse("This link has expired.", { status: 410 });
  }

  // Fetch the document's storage path
  const { data: doc } = await supabase
    .from("application_documents")
    .select("storage_path, original_name, mime_type")
    .eq("id", link.document_id)
    .single();

  if (!doc) {
    return new NextResponse("Document no longer exists.", { status: 404 });
  }

  // Generate a short-lived signed URL (5 minutes — enough for the browser to start download)
  const { data: signedData, error: urlErr } = await supabase.storage
    .from("documents")
    .createSignedUrl(doc.storage_path, 300);

  if (urlErr || !signedData?.signedUrl) {
    return new NextResponse("Failed to generate download URL.", { status: 500 });
  }

  // Increment view count (fire-and-forget, non-blocking)
  supabase
    .from("document_shared_links")
    .update({ view_count: link.view_count + 1 })
    .eq("id", link.id)
    .then(() => {/* ignore */});

  // Redirect to the signed URL — browser will download/open the file
  return NextResponse.redirect(signedData.signedUrl, { status: 302 });
}
