import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyOrigin } from "@/lib/security/csrf";
import { ApiError, errorResponse, successResponse } from "@/lib/api/errors";
import { z } from "zod";

const mockSchema = z.object({
  scheduled_at: z.string().min(1, "Scheduled time is required"),
  type: z.enum(["DSA", "Behavioral", "System Design", "Mixed"]),
  status: z.enum(["Scheduled", "Completed", "Cancelled"]).default("Scheduled"),
  partner_name: z.string().max(200).optional().nullable(),
  score: z.number().int().min(1).max(5).optional().nullable(),
  feedback: z.string().max(5000).optional().nullable(),
  topics_to_revisit: z.array(z.string().max(200)).max(20).default([]),
});

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    let query = supabase
      .from("mock_interviews")
      .select("*")
      .eq("user_id", user.id)
      .order("scheduled_at", { ascending: false });

    if (status && status !== "all") query = query.eq("status", status);

    const { data, error } = await query;
    if (error) throw ApiError.internal("Failed to fetch mock interviews");

    return successResponse({ mockInterviews: data ?? [] });
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

    const rl = await checkRateLimit(`prep:mock:post:${user.id}`, { maxRequests: 30, windowMs: 60_000 });
    if (!rl.allowed) throw ApiError.tooManyRequests("Too many requests.");

    const body = await request.json();
    const parsed = mockSchema.safeParse(body);
    if (!parsed.success) throw ApiError.badRequest(parsed.error.issues[0]?.message ?? "Invalid input");

    const { data, error } = await supabase
      .from("mock_interviews")
      .insert({ ...parsed.data, user_id: user.id })
      .select()
      .single();

    if (error) throw ApiError.internal("Failed to create mock interview");

    return successResponse({ mockInterview: data }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
