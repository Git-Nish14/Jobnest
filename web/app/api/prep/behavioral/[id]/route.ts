import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyOrigin } from "@/lib/security/csrf";
import { ApiError, errorResponse, successResponse } from "@/lib/api/errors";
import { z } from "zod";

const COMPETENCIES = ["Leadership", "Conflict", "Failure", "Achievement", "Teamwork", "Communication", "Problem Solving", "Other"] as const;

const updateSchema = z.object({
  question: z.string().min(1).max(1000).optional(),
  competency: z.enum(COMPETENCIES).optional().nullable(),
  situation: z.string().max(3000).optional().nullable(),
  task_desc: z.string().max(3000).optional().nullable(),
  action: z.string().max(3000).optional().nullable(),
  result: z.string().max(3000).optional().nullable(),
});

interface Params { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    if (!verifyOrigin(request)) throw ApiError.forbidden("Invalid request origin.");
    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/.test(id)) throw ApiError.badRequest("Invalid answer ID");

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) throw ApiError.badRequest(parsed.error.issues[0]?.message ?? "Invalid input");

    const { data, error } = await supabase
      .from("behavioral_answers")
      .update({ ...parsed.data, last_updated: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error || !data) throw ApiError.notFound("Answer not found");

    return successResponse({ answer: data });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    if (!verifyOrigin(request)) throw ApiError.forbidden("Invalid request origin.");
    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/.test(id)) throw ApiError.badRequest("Invalid answer ID");

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const { error } = await supabase
      .from("behavioral_answers")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw ApiError.internal("Failed to delete answer");

    return successResponse({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
