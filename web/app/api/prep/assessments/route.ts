import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyOrigin } from "@/lib/security/csrf";
import { ApiError, errorResponse, successResponse } from "@/lib/api/errors";
import { z } from "zod";

const assessmentSchema = z.object({
  title: z.string().min(1, "Title is required").max(300),
  application_id: z.string().uuid().optional().nullable(),
  platform: z.string().max(100).optional().nullable(),
  assigned_at: z.string().optional().nullable(),
  deadline: z.string().optional().nullable(),
  time_limit_hours: z.number().positive().optional().nullable(),
  tech_stack: z.array(z.string().max(100)).max(20).default([]),
  status: z.enum(["Pending", "In Progress", "Submitted", "Passed", "Failed"]).default("Pending"),
  score: z.number().min(0).max(100).optional().nullable(),
  feedback: z.string().max(5000).optional().nullable(),
  time_spent_minutes: z.number().int().positive().optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    let query = supabase
      .from("assessments")
      .select("*, job_applications(company, position)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (status && status !== "all") query = query.eq("status", status);

    const { data, error } = await query;
    if (error) throw ApiError.internal("Failed to fetch assessments");

    return successResponse({ assessments: data ?? [] });
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

    const rl = await checkRateLimit(`prep:assessments:post:${user.id}`, { maxRequests: 30, windowMs: 60_000 });
    if (!rl.allowed) throw ApiError.tooManyRequests("Too many requests.");

    const body = await request.json();
    const parsed = assessmentSchema.safeParse(body);
    if (!parsed.success) throw ApiError.badRequest(parsed.error.issues[0]?.message ?? "Invalid input");

    // Verify the linked application belongs to this user (prevents IDOR)
    if (parsed.data.application_id) {
      const { data: app } = await supabase
        .from("job_applications")
        .select("id")
        .eq("id", parsed.data.application_id)
        .eq("user_id", user.id)
        .single();
      if (!app) throw ApiError.forbidden("Application not found or access denied.");
    }

    const { data, error } = await supabase
      .from("assessments")
      .insert({ ...parsed.data, user_id: user.id })
      .select()
      .single();

    if (error) throw ApiError.internal("Failed to create assessment");

    return successResponse({ assessment: data }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
