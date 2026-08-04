import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyOrigin } from "@/lib/security/csrf";
import { ApiError, errorResponse, successResponse } from "@/lib/api/errors";
import { z } from "zod";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const patchSchema = z.object({
  application_id: z.string().uuid().optional().nullable(),
  contact_id:     z.string().uuid().optional().nullable(),
  status:         z.enum(["Requested", "Submitted", "Pending", "Converted"]).optional(),
  referral_date:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format").optional().nullable(),
  notes:          z.string().max(2000).optional().nullable(),
});

interface Params { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    if (!verifyOrigin(request)) throw ApiError.forbidden("Invalid request origin.");

    const { id } = await params;
    if (!UUID_RE.test(id)) throw ApiError.badRequest("Invalid referral ID.");

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const rl = await checkRateLimit(`networking:referrals:patch:${user.id}`, { maxRequests: 30, windowMs: 60_000 });
    if (!rl.allowed) throw ApiError.tooManyRequests("Too many requests.");

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid input";
      throw ApiError.badRequest(msg);
    }

    // If application_id is being updated, verify it belongs to the calling user.
    if (parsed.data.application_id) {
      const { data: app } = await supabase
        .from("job_applications")
        .select("id")
        .eq("id", parsed.data.application_id)
        .eq("user_id", user.id)
        .single();
      if (!app) throw ApiError.forbidden("Application not found.");
    }

    const { data, error } = await supabase
      .from("referrals")
      .update(parsed.data)
      .eq("id", id)
      .eq("user_id", user.id)
      .select(`
        *,
        contact:contacts(name, title, company),
        application:job_applications(company, position, status)
      `)
      .single();

    if (error || !data) throw ApiError.notFound("Referral not found.");

    return successResponse({ referral: data });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    if (!verifyOrigin(request)) throw ApiError.forbidden("Invalid request origin.");

    const { id } = await params;
    if (!UUID_RE.test(id)) throw ApiError.badRequest("Invalid referral ID.");

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const rl = await checkRateLimit(`networking:referrals:delete:${user.id}`, { maxRequests: 30, windowMs: 60_000 });
    if (!rl.allowed) throw ApiError.tooManyRequests("Too many requests.");

    const { error } = await supabase
      .from("referrals")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw ApiError.internal("Failed to delete referral.");

    return successResponse({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
