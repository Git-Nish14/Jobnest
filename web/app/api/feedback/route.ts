import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { verifyOrigin } from "@/lib/security/csrf";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { z } from "zod";

const feedbackSchema = z.object({
  score: z.number().int().min(0).max(10),
  comment: z.string().max(1000).trim().optional(),
});

export async function POST(request: NextRequest) {
  try {
    if (!verifyOrigin(request)) throw ApiError.forbidden("Invalid request origin.");

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    // Limit: 3 submissions per 24h per user
    const rl = await checkRateLimit(`feedback:${user.id}`, { maxRequests: 3, windowMs: 24 * 60 * 60 * 1000 });
    if (!rl.allowed) throw ApiError.tooManyRequests("Please wait before submitting more feedback.");

    const body = await request.json();
    const parsed = feedbackSchema.safeParse(body);
    if (!parsed.success) throw ApiError.badRequest("Invalid feedback data.");

    const { error: insertError } = await supabase.from("user_feedback").insert({
      user_id: user.id,
      score: parsed.data.score,
      comment: parsed.data.comment || null,
    });

    if (insertError) throw ApiError.internal("Failed to save feedback.");

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
