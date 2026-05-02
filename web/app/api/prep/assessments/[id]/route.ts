import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyOrigin } from "@/lib/security/csrf";
import { ApiError, errorResponse, successResponse } from "@/lib/api/errors";
import { z } from "zod";

const updateSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  application_id: z.string().uuid().optional().nullable(),
  platform: z.string().max(100).optional().nullable(),
  assigned_at: z.string().optional().nullable(),
  deadline: z.string().optional().nullable(),
  time_limit_hours: z.number().positive().optional().nullable(),
  tech_stack: z.array(z.string().max(100)).max(20).optional(),
  status: z.enum(["Pending", "In Progress", "Submitted", "Passed", "Failed"]).optional(),
  score: z.number().min(0).max(100).optional().nullable(),
  feedback: z.string().max(5000).optional().nullable(),
  time_spent_minutes: z.number().int().positive().optional().nullable(),
});

interface Params { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    if (!verifyOrigin(request)) throw ApiError.forbidden("Invalid request origin.");
    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/.test(id)) throw ApiError.badRequest("Invalid assessment ID");

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) throw ApiError.badRequest(parsed.error.issues[0]?.message ?? "Invalid input");

    const { data, error } = await supabase
      .from("assessments")
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error || !data) throw ApiError.notFound("Assessment not found");

    return successResponse({ assessment: data });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    if (!verifyOrigin(request)) throw ApiError.forbidden("Invalid request origin.");
    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/.test(id)) throw ApiError.badRequest("Invalid assessment ID");

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const { error } = await supabase
      .from("assessments")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw ApiError.internal("Failed to delete assessment");

    return successResponse({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
