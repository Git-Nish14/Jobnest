import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/read-json";
import { verifyOrigin } from "@/lib/security/csrf";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { equitySchema } from "@/lib/validations/equity";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!request.headers.get("origin") || !verifyOrigin(request)) throw ApiError.forbidden("Invalid request origin.");
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw ApiError.unauthorized();
    const { id } = await context.params;
    if (!z.uuid().safeParse(id).success) throw ApiError.badRequest("Invalid application identifier.");
    if (!(await checkRateLimit(`equity:${user.id}`, { maxRequests: 20, windowMs: 60_000 })).allowed) throw ApiError.tooManyRequests();
    const input = z.object({ equity_details: equitySchema }).strict().parse(await readJsonBody(request, 2048));
    const application = await supabase.from("job_applications").select("id").eq("id", id).eq("user_id", user.id).single();
    if (application.error || !application.data) throw ApiError.notFound("Application not found.");
    const result = await supabase.from("salary_details").upsert({ application_id: id, equity_details: input.equity_details }, { onConflict: "application_id" }).select("equity_details").single();
    if (result.error || !result.data) throw ApiError.internal("Could not save equity details. Please try again.");
    return NextResponse.json(result.data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
