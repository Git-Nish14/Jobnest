import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ApiError, errorResponse, validateBody } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyOrigin } from "@/lib/security/csrf";
import { z } from "zod";

const DEGREES = ["BS","MS","PhD","MBA","Associate","Bootcamp","Certificate","Self-taught","Other"] as const;

const educationSchema = z.object({
  institution:    z.string().min(1).max(120),
  degree:         z.enum(DEGREES).default("BS"),
  field_of_study: z.string().max(120).nullable().optional(),
  gpa:            z.number().min(0).max(4.0).nullable().optional(),
  show_gpa:       z.boolean().default(false),
  start_date:     z.string().date(),
  end_date:       z.string().date().nullable().optional(),
  is_current:     z.boolean().default(false),
  activities:     z.array(z.string().max(200)).max(20).default([]),
}).refine(
  (d) => d.is_current || !d.end_date || d.end_date >= d.start_date,
  { message: "End date must be on or after start date.", path: ["end_date"] }
);

async function getAuthedUser(request: NextRequest) {
  if (!verifyOrigin(request)) throw ApiError.forbidden("Invalid request origin.");
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw ApiError.unauthorized();
  const rl = await checkRateLimit(`education:${user.id}`, { maxRequests: 30, windowMs: 60_000 });
  if (!rl.allowed) throw ApiError.tooManyRequests("Too many requests.");
  return { supabase, user };
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw ApiError.unauthorized();
    const { data, error: dbErr } = await supabase
      .from("education").select("*").eq("user_id", user.id)
      .order("start_date", { ascending: false });
    if (dbErr) throw ApiError.internal("Failed to fetch education.");
    return NextResponse.json({ education: data ?? [] });
  } catch (e) { return errorResponse(e); }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await getAuthedUser(request);
    const body = await validateBody(request, educationSchema);
    const { data, error } = await supabase.from("education")
      .insert({ ...body, user_id: user.id }).select().single();
    if (error) throw ApiError.internal("Failed to create education entry.");
    return NextResponse.json({ education: data }, { status: 201 });
  } catch (e) { return errorResponse(e); }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(request: NextRequest) {
  try {
    const { supabase, user } = await getAuthedUser(request);
    const id = request.nextUrl.searchParams.get("id");
    if (!id || !UUID_RE.test(id)) throw ApiError.badRequest("Valid education id is required.");
    const { data, error } = await supabase.from("education")
      .delete().eq("id", id).eq("user_id", user.id).select("id");
    if (error) throw ApiError.internal("Failed to delete education entry.");
    if (!data || data.length === 0) throw ApiError.notFound("Education entry not found.");
    return new NextResponse(null, { status: 204 });
  } catch (e) { return errorResponse(e); }
}
