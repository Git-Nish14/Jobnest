import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyOrigin } from "@/lib/security/csrf";
import { ApiError, errorResponse, successResponse } from "@/lib/api/errors";
import { z } from "zod";

const problemSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  url: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
  difficulty: z.enum(["Easy", "Medium", "Hard"]),
  topic: z.string().min(1, "Topic is required").max(100),
  status: z.enum(["Todo", "Attempted", "Solved", "Review"]).default("Todo"),
  company_tags: z.array(z.string().max(100)).max(20).default([]),
  time_to_solve_minutes: z.number().int().positive().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  solution_url: z.string().url().optional().or(z.literal("")).nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const rl = await checkRateLimit(`prep:problems:get:${user.id}`, { maxRequests: 60, windowMs: 60_000 });
    if (!rl.allowed) throw ApiError.tooManyRequests("Too many requests.");

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const topic = searchParams.get("topic");
    const difficulty = searchParams.get("difficulty");

    let query = supabase
      .from("coding_problems")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (status && status !== "all") query = query.eq("status", status);
    if (topic && topic !== "all") query = query.eq("topic", topic);
    if (difficulty && difficulty !== "all") query = query.eq("difficulty", difficulty);

    const { data, error } = await query;
    if (error) throw ApiError.internal("Failed to fetch problems");

    return successResponse({ problems: data ?? [] });
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

    const rl = await checkRateLimit(`prep:problems:post:${user.id}`, { maxRequests: 30, windowMs: 60_000 });
    if (!rl.allowed) throw ApiError.tooManyRequests("Too many requests. Please slow down.");

    const body = await request.json();
    const parsed = problemSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid input";
      throw ApiError.badRequest(msg);
    }

    const { data, error } = await supabase
      .from("coding_problems")
      .insert({ ...parsed.data, user_id: user.id })
      .select()
      .single();

    if (error) throw ApiError.internal("Failed to create problem");

    return successResponse({ problem: data }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
