import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ApiError, errorResponse, successResponse, validateBody } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyOrigin } from "@/lib/security/csrf";

// ── Shared ownership helper ───────────────────────────────────────────────────

async function assertDocumentOwner(
  supabase: Awaited<ReturnType<typeof createClient>>,
  documentId: string,
  userId: string
): Promise<void> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(documentId)) {
    throw ApiError.badRequest("Invalid document ID.");
  }
  const { data } = await supabase
    .from("application_documents")
    .select("id")
    .eq("id", documentId)
    .eq("user_id", userId)
    .single();
  if (!data) throw ApiError.notFound("Document not found.");
}

// ── GET /api/documents/[id]/annotations ──────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    await assertDocumentOwner(supabase, id, user.id);

    const { data, error } = await supabase
      .from("document_annotations")
      .select("*")
      .eq("document_id", id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (error) throw ApiError.internal("Failed to fetch annotations.");
    return successResponse({ annotations: data ?? [] });
  } catch (error) {
    return errorResponse(error);
  }
}

// ── POST /api/documents/[id]/annotations ─────────────────────────────────────

const createSchema = z.object({
  page_number: z.number().int().min(1),
  x_pct:       z.number().min(0).max(1),
  y_pct:       z.number().min(0).max(1),
  width_pct:   z.number().min(0.05).max(0.6).optional().default(0.22),
  content:     z.string().max(2000).optional().default(""),
  color:       z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().default("#fef08a"),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!verifyOrigin(request)) throw ApiError.forbidden("Invalid request origin.");
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const rl = await checkRateLimit(`annotations:${user.id}`, { maxRequests: 60, windowMs: 60_000 });
    if (!rl.allowed) throw ApiError.tooManyRequests("Too many annotation requests. Please slow down.");

    await assertDocumentOwner(supabase, id, user.id);

    const body = await validateBody(request, createSchema);

    const { data, error } = await supabase
      .from("document_annotations")
      .insert({
        document_id: id,
        user_id:     user.id,
        ...body,
      })
      .select()
      .single();

    if (error) throw ApiError.internal("Failed to save annotation.");
    return NextResponse.json({ annotation: data }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
