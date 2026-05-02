import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyOrigin } from "@/lib/security/csrf";
import { ApiError, errorResponse, successResponse } from "@/lib/api/errors";
import { z } from "zod";

const updateSchema = z.object({
  scheduled_at: z.string().optional(),
  type: z.enum(["DSA", "Behavioral", "System Design", "Mixed"]).optional(),
  status: z.enum(["Scheduled", "Completed", "Cancelled"]).optional(),
  partner_name: z.string().max(200).optional().nullable(),
  score: z.number().int().min(1).max(5).optional().nullable(),
  feedback: z.string().max(5000).optional().nullable(),
  topics_to_revisit: z.array(z.string().max(200)).max(20).optional(),
});

interface Params { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    if (!verifyOrigin(request)) throw ApiError.forbidden("Invalid request origin.");
    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/.test(id)) throw ApiError.badRequest("Invalid mock interview ID");

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) throw ApiError.badRequest(parsed.error.issues[0]?.message ?? "Invalid input");

    const { data, error } = await supabase
      .from("mock_interviews")
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error || !data) throw ApiError.notFound("Mock interview not found");

    return successResponse({ mockInterview: data });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    if (!verifyOrigin(request)) throw ApiError.forbidden("Invalid request origin.");
    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/.test(id)) throw ApiError.badRequest("Invalid mock interview ID");

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const { error } = await supabase
      .from("mock_interviews")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw ApiError.internal("Failed to delete mock interview");

    return successResponse({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
