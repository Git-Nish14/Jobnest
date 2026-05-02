import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyOrigin } from "@/lib/security/csrf";
import { ApiError, errorResponse, successResponse } from "@/lib/api/errors";
import { z } from "zod";

const COMPETENCIES = ["Leadership", "Conflict", "Failure", "Achievement", "Teamwork", "Communication", "Problem Solving", "Other"] as const;

const behavioralSchema = z.object({
  question: z.string().min(1, "Question is required").max(1000),
  competency: z.enum(COMPETENCIES).optional().nullable(),
  situation: z.string().max(3000).optional().nullable(),
  task_desc: z.string().max(3000).optional().nullable(),
  action: z.string().max(3000).optional().nullable(),
  result: z.string().max(3000).optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const { searchParams } = new URL(request.url);
    const competency = searchParams.get("competency");

    let query = supabase
      .from("behavioral_answers")
      .select("*")
      .eq("user_id", user.id)
      .order("last_updated", { ascending: false });

    if (competency && competency !== "all") query = query.eq("competency", competency);

    const { data, error } = await query;
    if (error) throw ApiError.internal("Failed to fetch behavioral answers");

    return successResponse({ answers: data ?? [] });
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

    const rl = await checkRateLimit(`prep:behavioral:post:${user.id}`, { maxRequests: 30, windowMs: 60_000 });
    if (!rl.allowed) throw ApiError.tooManyRequests("Too many requests.");

    const body = await request.json();
    const parsed = behavioralSchema.safeParse(body);
    if (!parsed.success) throw ApiError.badRequest(parsed.error.issues[0]?.message ?? "Invalid input");

    const { data, error } = await supabase
      .from("behavioral_answers")
      .insert({ ...parsed.data, user_id: user.id, last_updated: new Date().toISOString() })
      .select()
      .single();

    if (error) throw ApiError.internal("Failed to create behavioral answer");

    return successResponse({ answer: data }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
