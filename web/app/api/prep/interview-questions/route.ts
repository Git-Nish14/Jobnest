import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyOrigin } from "@/lib/security/csrf";
import { ApiError, errorResponse, successResponse } from "@/lib/api/errors";
import { z } from "zod";

const questionSchema = z.object({
  interview_id: z.string().uuid("Invalid interview ID"),
  question: z.string().min(1, "Question is required").max(1000),
  category: z.enum(["DSA", "Behavioral", "System Design", "Domain Knowledge", "Culture Fit", "Other"]).optional().nullable(),
  difficulty: z.enum(["Easy", "Medium", "Hard"]).optional().nullable(),
  notes: z.string().max(3000).optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const { searchParams } = new URL(request.url);
    const interviewId = searchParams.get("interview_id");

    let query = supabase
      .from("interview_questions")
      .select("*, interviews(scheduled_at, job_applications(company, position))")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (interviewId) {
      if (!/^[0-9a-f-]{36}$/.test(interviewId)) throw ApiError.badRequest("Invalid interview ID");
      query = query.eq("interview_id", interviewId);
    }

    const { data, error } = await query;
    if (error) throw ApiError.internal("Failed to fetch interview questions");

    return successResponse({ questions: data ?? [] });
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

    const rl = await checkRateLimit(`prep:iq:post:${user.id}`, { maxRequests: 30, windowMs: 60_000 });
    if (!rl.allowed) throw ApiError.tooManyRequests("Too many requests.");

    const body = await request.json();
    const parsed = questionSchema.safeParse(body);
    if (!parsed.success) throw ApiError.badRequest(parsed.error.issues[0]?.message ?? "Invalid input");

    // Verify the interview belongs to the authenticated user (prevents IDOR)
    const { data: interview } = await supabase
      .from("interviews")
      .select("id")
      .eq("id", parsed.data.interview_id)
      .eq("user_id", user.id)
      .single();
    if (!interview) throw ApiError.forbidden("Interview not found or access denied.");

    const { data, error } = await supabase
      .from("interview_questions")
      .insert({ ...parsed.data, user_id: user.id })
      .select()
      .single();

    if (error) throw ApiError.internal("Failed to log interview question");

    return successResponse({ question: data }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
