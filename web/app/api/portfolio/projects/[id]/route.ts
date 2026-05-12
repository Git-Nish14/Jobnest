import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ApiError, errorResponse, validateBody } from "@/lib/api/errors";
import { verifyOrigin } from "@/lib/security/csrf";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { z } from "zod";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const patchSchema = z.object({
  title:          z.string().min(1).max(120).optional(),
  description:    z.string().max(1000).nullable().optional(),
  tags:           z.array(z.string().max(40)).max(10).optional(),
  demo_url:       z.string().url().nullable().optional(),
  repo_url:       z.string().url().nullable().optional(),
  image_url:      z.string().nullable().optional(),
  github_repo_id: z.string().uuid().nullable().optional(),
  is_featured:    z.boolean().optional(),
  display_order:  z.number().int().min(0).optional(),
});

async function authed(request: NextRequest) {
  if (!verifyOrigin(request)) throw ApiError.forbidden("Invalid request origin.");
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw ApiError.unauthorized();
  const rl = await checkRateLimit(`projects:${user.id}`, { maxRequests: 40, windowMs: 60_000 });
  if (!rl.allowed) throw ApiError.tooManyRequests();
  return { supabase, user };
}

/** PATCH /api/portfolio/projects/[id] — update a project */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) throw ApiError.badRequest("Invalid project id.");

    const { supabase, user } = await authed(request);
    const body = await validateBody(request, patchSchema);

    const { data, error } = await supabase
      .from("projects")
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error || !data) throw ApiError.notFound("Project not found.");
    return NextResponse.json({ project: data });
  } catch (e) {
    return errorResponse(e);
  }
}

/** DELETE /api/portfolio/projects/[id] — delete a project */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) throw ApiError.badRequest("Invalid project id.");

    const { supabase, user } = await authed(request);
    const { data, error } = await supabase
      .from("projects")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id");

    if (error) throw ApiError.internal("Failed to delete project.");
    if (!data || data.length === 0) throw ApiError.notFound("Project not found.");
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
