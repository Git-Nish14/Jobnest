import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyOrigin } from "@/lib/security/csrf";
import { ApiError, errorResponse, successResponse } from "@/lib/api/errors";
import { z } from "zod";

const referralSchema = z.object({
  application_id: z.string().uuid().optional().nullable(),
  contact_id:     z.string().uuid().optional().nullable(),
  status:         z.enum(["Requested", "Submitted", "Pending", "Converted"]).default("Requested"),
  referral_date:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format").optional().nullable(),
  notes:          z.string().max(2000).optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const rl = await checkRateLimit(`networking:referrals:get:${user.id}`, { maxRequests: 60, windowMs: 60_000 });
    if (!rl.allowed) throw ApiError.tooManyRequests("Too many requests.");

    const { searchParams } = new URL(request.url);
    const applicationId = searchParams.get("application_id");

    let query = supabase
      .from("referrals")
      .select(`
        *,
        contact:contacts(name, title, company),
        application:job_applications(company, position, status)
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (applicationId) query = query.eq("application_id", applicationId);

    const { data, error } = await query;
    if (error) throw ApiError.internal("Failed to fetch referrals.");

    return successResponse({ referrals: data ?? [] });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!verifyOrigin(request)) throw ApiError.forbidden("Invalid request origin.");

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const rl = await checkRateLimit(`networking:referrals:post:${user.id}`, { maxRequests: 30, windowMs: 60_000 });
    if (!rl.allowed) throw ApiError.tooManyRequests("Too many requests.");

    const body = await request.json();
    const parsed = referralSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid input";
      throw ApiError.badRequest(msg);
    }

    // If application_id is provided, verify it belongs to the calling user.
    // Defence-in-depth: the trigger also enforces this, but we reject early
    // so no row is written and no trigger fires on an unowned application.
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
      .insert({ ...parsed.data, user_id: user.id })
      .select(`
        *,
        contact:contacts(name, title, company),
        application:job_applications(company, position, status)
      `)
      .single();

    if (error) throw ApiError.internal("Failed to create referral.");

    return successResponse({ referral: data }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
