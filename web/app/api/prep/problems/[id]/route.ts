import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyOrigin } from "@/lib/security/csrf";
import { ApiError, errorResponse, successResponse } from "@/lib/api/errors";
import { z } from "zod";

const updateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  url: z.string().url().optional().or(z.literal("")).nullable(),
  difficulty: z.enum(["Easy", "Medium", "Hard"]).optional(),
  topic: z.string().min(1).max(100).optional(),
  status: z.enum(["Todo", "Attempted", "Solved", "Review"]).optional(),
  company_tags: z.array(z.string().max(100)).max(20).optional(),
  time_to_solve_minutes: z.number().int().positive().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  solution_url: z.string().url().optional().or(z.literal("")).nullable(),
  last_reviewed_at: z.string().optional().nullable(),
});

interface Params { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    if (!verifyOrigin(request)) throw ApiError.forbidden("Invalid request origin.");
    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/.test(id)) throw ApiError.badRequest("Invalid problem ID");

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) throw ApiError.badRequest(parsed.error.issues[0]?.message ?? "Invalid input");

    const { data, error } = await supabase
      .from("coding_problems")
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error || !data) throw ApiError.notFound("Problem not found");

    return successResponse({ problem: data });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    if (!verifyOrigin(request)) throw ApiError.forbidden("Invalid request origin.");
    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/.test(id)) throw ApiError.badRequest("Invalid problem ID");

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const { error } = await supabase
      .from("coding_problems")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw ApiError.internal("Failed to delete problem");

    return successResponse({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
