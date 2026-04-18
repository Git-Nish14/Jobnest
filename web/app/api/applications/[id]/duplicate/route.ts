import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyOrigin } from "@/lib/security/csrf";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!verifyOrigin(request)) throw ApiError.forbidden("Invalid request origin.");

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const rl = await checkRateLimit(`duplicate:${user.id}`, { maxRequests: 20, windowMs: 60_000 });
    if (!rl.allowed) throw ApiError.tooManyRequests("Too many duplicate requests. Please wait a moment.");

    const { id } = await params;

    // Fetch the original — RLS ensures it belongs to this user
    const { data: original, error: fetchError } = await supabase
      .from("job_applications")
      .select("company, position, job_id, job_url, salary_range, location, notes, job_description, source")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !original) throw ApiError.notFound("Application not found.");

    const today = new Date().toISOString().slice(0, 10);

    const { data: duplicate, error: insertError } = await supabase
      .from("job_applications")
      .insert({
        user_id:         user.id,
        company:         original.company,
        position:        original.position,
        job_id:          original.job_id,
        job_url:         original.job_url,
        salary_range:    original.salary_range,
        location:        original.location,
        notes:           original.notes,
        job_description: original.job_description,
        source:          original.source,
        status:          "Applied",
        applied_date:    today,
      })
      .select("id")
      .single();

    if (insertError || !duplicate) throw ApiError.internal("Failed to duplicate application.");

    return NextResponse.json({ id: duplicate.id }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
