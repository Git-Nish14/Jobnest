import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyOrigin } from "@/lib/security/csrf";
import { ApiError, errorResponse, successResponse } from "@/lib/api/errors";

interface Params { params: Promise<{ id: string }> }

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    if (!verifyOrigin(request)) throw ApiError.forbidden("Invalid request origin.");
    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/.test(id)) throw ApiError.badRequest("Invalid question ID");

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const { error } = await supabase
      .from("interview_questions")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw ApiError.internal("Failed to delete question");

    return successResponse({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
