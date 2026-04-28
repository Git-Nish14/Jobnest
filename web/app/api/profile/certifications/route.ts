import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ApiError, errorResponse, validateBody } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyOrigin } from "@/lib/security/csrf";
import { z } from "zod";

const certSchema = z.object({
  name:           z.string().min(1).max(120),
  provider:       z.string().max(120).nullable().optional(),
  credential_id:  z.string().max(120).nullable().optional(),
  credential_url: z.string().url().nullable().optional(),
  issued_at:      z.string().date(),
  expires_at:     z.string().date().nullable().optional(),
}).refine(
  (d) => !d.expires_at || d.expires_at > d.issued_at,
  { message: "Expiry date must be after issue date.", path: ["expires_at"] }
);

async function getAuthedUser(request: NextRequest) {
  if (!verifyOrigin(request)) throw ApiError.forbidden("Invalid request origin.");
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw ApiError.unauthorized();
  const rl = await checkRateLimit(`certs:${user.id}`, { maxRequests: 30, windowMs: 60_000 });
  if (!rl.allowed) throw ApiError.tooManyRequests("Too many requests.");
  return { supabase, user };
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw ApiError.unauthorized();
    const { data, error: dbErr } = await supabase
      .from("certifications").select("*").eq("user_id", user.id)
      .order("issued_at", { ascending: false });
    if (dbErr) throw ApiError.internal("Failed to fetch certifications.");
    return NextResponse.json({ certifications: data ?? [] });
  } catch (e) { return errorResponse(e); }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await getAuthedUser(request);
    const body = await validateBody(request, certSchema);
    const { data, error } = await supabase.from("certifications")
      .insert({ ...body, user_id: user.id }).select().single();
    if (error) throw ApiError.internal("Failed to create certification.");
    return NextResponse.json({ certification: data }, { status: 201 });
  } catch (e) { return errorResponse(e); }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(request: NextRequest) {
  try {
    const { supabase, user } = await getAuthedUser(request);
    const id = request.nextUrl.searchParams.get("id");
    if (!id || !UUID_RE.test(id)) throw ApiError.badRequest("Valid certification id is required.");
    const { data, error } = await supabase.from("certifications")
      .delete().eq("id", id).eq("user_id", user.id).select("id");
    if (error) throw ApiError.internal("Failed to delete certification.");
    if (!data || data.length === 0) throw ApiError.notFound("Certification not found.");
    return new NextResponse(null, { status: 204 });
  } catch (e) { return errorResponse(e); }
}
