import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ApiError, errorResponse, successResponse, validateBody } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyOrigin } from "@/lib/security/csrf";

// ── PUT /api/documents/[id]/annotations/[annId] ───────────────────────────────

const updateSchema = z.object({
  x_pct:     z.number().min(0).max(1).optional(),
  y_pct:     z.number().min(0).max(1).optional(),
  width_pct: z.number().min(0.05).max(0.6).optional(),
  content:   z.string().max(2000).optional(),
  color:     z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
}).strict();

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; annId: string }> }
) {
  try {
    if (!verifyOrigin(request)) throw ApiError.forbidden("Invalid request origin.");
    const { annId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const rl = await checkRateLimit(`annotations:${user.id}`, { maxRequests: 60, windowMs: 60_000 });
    if (!rl.allowed) throw ApiError.tooManyRequests("Too many annotation requests. Please slow down.");

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(annId)) {
      throw ApiError.badRequest("Invalid annotation ID.");
    }

    const body = await validateBody(request, updateSchema);
    if (Object.keys(body).length === 0) throw ApiError.badRequest("No fields to update.");

    const { data, error } = await supabase
      .from("document_annotations")
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("id", annId)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error || !data) throw ApiError.notFound("Annotation not found.");
    return successResponse({ annotation: data });
  } catch (error) {
    return errorResponse(error);
  }
}

// ── DELETE /api/documents/[id]/annotations/[annId] ────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; annId: string }> }
) {
  try {
    if (!verifyOrigin(request)) throw ApiError.forbidden("Invalid request origin.");
    const { annId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(annId)) {
      throw ApiError.badRequest("Invalid annotation ID.");
    }

    const { data, error } = await supabase
      .from("document_annotations")
      .delete()
      .eq("id", annId)
      .eq("user_id", user.id)
      .select("id")
      .single();

    if (error || !data) throw ApiError.notFound("Annotation not found.");
    return successResponse({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}
