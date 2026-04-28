import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ApiError, errorResponse, validateBody } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyOrigin } from "@/lib/security/csrf";
import { z } from "zod";

const CATEGORIES   = ["Language","Framework","Database","Cloud","Tool","Soft"] as const;
const PROFICIENCIES = ["Beginner","Intermediate","Advanced","Expert"] as const;

const skillSchema = z.object({
  name:             z.string().min(1).max(80),
  category:         z.enum(CATEGORIES).default("Language"),
  proficiency:      z.enum(PROFICIENCIES).default("Intermediate"),
  years_experience: z.number().int().min(0).max(50).nullable().optional(),
  last_used_at:     z.string().date().nullable().optional(),
});

async function getAuthedUser(request: NextRequest) {
  if (!verifyOrigin(request)) throw ApiError.forbidden("Invalid request origin.");
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw ApiError.unauthorized();
  const rl = await checkRateLimit(`skills:${user.id}`, { maxRequests: 30, windowMs: 60_000 });
  if (!rl.allowed) throw ApiError.tooManyRequests("Too many requests.");
  return { supabase, user };
}

/** GET /api/profile/skills — return all skills for the authenticated user */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw ApiError.unauthorized();
    const { data, error: dbErr } = await supabase
      .from("skills").select("*").eq("user_id", user.id)
      .order("category").order("name");
    if (dbErr) throw ApiError.internal("Failed to fetch skills.");
    return NextResponse.json({ skills: data ?? [] });
  } catch (e) { return errorResponse(e); }
}

/** POST /api/profile/skills — create a skill */
export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await getAuthedUser(request);
    const body = await validateBody(request, skillSchema);
    const { data, error } = await supabase.from("skills")
      .insert({ ...body, user_id: user.id }).select().single();
    if (error) throw ApiError.internal("Failed to create skill.");
    return NextResponse.json({ skill: data }, { status: 201 });
  } catch (e) { return errorResponse(e); }
}

/** DELETE /api/profile/skills?id=xxx — delete a skill */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(request: NextRequest) {
  try {
    const { supabase, user } = await getAuthedUser(request);
    const id = request.nextUrl.searchParams.get("id");
    if (!id || !UUID_RE.test(id)) throw ApiError.badRequest("Valid skill id is required.");
    const { data, error } = await supabase.from("skills")
      .delete().eq("id", id).eq("user_id", user.id).select("id");
    if (error) throw ApiError.internal("Failed to delete skill.");
    if (!data || data.length === 0) throw ApiError.notFound("Skill not found.");
    return new NextResponse(null, { status: 204 });
  } catch (e) { return errorResponse(e); }
}
