import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ApiError, errorResponse, validateBody } from "@/lib/api/errors";
import { verifyOrigin } from "@/lib/security/csrf";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { z } from "zod";

const URL_OPTIONAL = z.string().url().nullable().optional();

const projectSchema = z.object({
  title:         z.string().min(1).max(120),
  description:   z.string().max(1000).nullable().optional(),
  tags:          z.array(z.string().max(40)).max(10).optional().default([]),
  demo_url:      URL_OPTIONAL,
  repo_url:      URL_OPTIONAL,
  image_url:     z.string().nullable().optional(),
  github_repo_id: z.string().uuid().nullable().optional(),
  is_featured:   z.boolean().optional().default(false),
  display_order: z.number().int().min(0).optional().default(0),
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

/** GET /api/portfolio/projects — list all projects for authenticated user */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw ApiError.unauthorized();

    const { data, error: dbErr } = await supabase
      .from("projects")
      .select("*, github_repo:github_repos(name, html_url, language, stargazers_count)")
      .eq("user_id", user.id)
      .order("display_order")
      .order("created_at", { ascending: false });

    if (dbErr) throw ApiError.internal("Failed to fetch projects.");
    return NextResponse.json({ projects: data ?? [] });
  } catch (e) {
    return errorResponse(e);
  }
}

/** POST /api/portfolio/projects — create a new project */
export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await authed(request);
    const body = await validateBody(request, projectSchema);

    const { data, error } = await supabase
      .from("projects")
      .insert({ ...body, user_id: user.id })
      .select()
      .single();

    if (error) throw ApiError.internal("Failed to create project.");
    return NextResponse.json({ project: data }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
