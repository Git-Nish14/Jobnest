import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { verifyOrigin } from "@/lib/security/csrf";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { z } from "zod";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function authed(request: NextRequest) {
  if (!verifyOrigin(request)) throw ApiError.forbidden("Invalid request origin.");
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw ApiError.unauthorized();
  const rl = await checkRateLimit(`github-repos:${user.id}`, { maxRequests: 30, windowMs: 60_000 });
  if (!rl.allowed) throw ApiError.tooManyRequests();
  return { supabase, user };
}

/** GET /api/portfolio/github/repos — list cached repos */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw ApiError.unauthorized();

    const { data, error: dbErr } = await supabase
      .from("github_repos")
      .select("*")
      .eq("user_id", user.id)
      .order("is_pinned", { ascending: false })
      .order("stargazers_count", { ascending: false });

    if (dbErr) throw ApiError.internal("Failed to fetch repos.");
    return NextResponse.json({ repos: data ?? [] });
  } catch (e) {
    return errorResponse(e);
  }
}

const patchSchema = z.object({
  id: z.string().regex(UUID_RE, "Invalid repo id"),
  is_pinned: z.boolean(),
});

/** PATCH /api/portfolio/github/repos — toggle is_pinned */
export async function PATCH(request: NextRequest) {
  try {
    const { supabase, user } = await authed(request);
    const body = await request.json() as unknown;
    const { id, is_pinned } = patchSchema.parse(body);

    // Maximum 6 pinned repos (same as GitHub's UI limit)
    if (is_pinned) {
      const { count } = await supabase
        .from("github_repos")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_pinned", true);
      if ((count ?? 0) >= 6) throw ApiError.badRequest("Maximum 6 repos can be pinned.");
    }

    const { data, error } = await supabase
      .from("github_repos")
      .update({ is_pinned })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error || !data) throw ApiError.notFound("Repo not found.");
    return NextResponse.json({ repo: data });
  } catch (e) {
    return errorResponse(e);
  }
}
