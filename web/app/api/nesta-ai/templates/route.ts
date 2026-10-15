import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { verifyOrigin } from "@/lib/security/csrf";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/read-json";
import { TEMPLATE_CATEGORIES } from "@/lib/validations/forms";

const text = (max: number) => z.string().trim().min(1).max(max).refine(value => !value.includes("\0"), "Remove unsupported characters.");
const schema = z.object({ name: text(100), subject: text(255), body: text(10_000), category: z.enum(TEMPLATE_CATEGORIES) }).strict();

export async function POST(request: Request) {
  try {
    if (!request.headers.get("origin") || !verifyOrigin(request)) throw ApiError.forbidden("Invalid request origin.");
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();
    const limit = await checkRateLimit(`nestai-template:${user.id}`, { maxRequests: 10, windowMs: 60_000 });
    if (!limit.allowed) throw ApiError.tooManyRequests();
    const input = schema.parse(await readJsonBody(request));
    const { data, error } = await supabase.from("email_templates")
      .insert({ ...input, user_id: user.id }).select("id, name").single();
    if (error || !data) throw ApiError.internal("Could not save the template. Please try again.");
    return NextResponse.json({ template: data }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
