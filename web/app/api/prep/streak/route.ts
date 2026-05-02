import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyOrigin } from "@/lib/security/csrf";
import { ApiError, errorResponse, successResponse } from "@/lib/api/errors";
import { z } from "zod";

const SYSTEM_DESIGN_STATUSES = ["Not Started", "Reading", "Comfortable"] as const;

const streakUpdateSchema = z.object({
  log_activity: z.boolean().optional(),
  // z.record needs explicit key type in strict TS; spread to satisfy z.enum's mutable-array requirement
  system_design_progress: z.record(z.string(), z.enum([...SYSTEM_DESIGN_STATUSES])).optional(),
});

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const { data, error } = await supabase
      .from("prep_streaks")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error && error.code !== "PGRST116") throw ApiError.internal("Failed to fetch streak");

    if (!data) {
      return successResponse({
        streak: {
          user_id: user.id,
          current_streak: 0,
          longest_streak: 0,
          last_activity_date: null,
          system_design_progress: {},
        },
      });
    }

    return successResponse({ streak: data });
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

    const body = await request.json();
    const parsed = streakUpdateSchema.safeParse(body);
    if (!parsed.success) throw ApiError.badRequest(parsed.error.issues[0]?.message ?? "Invalid input");

    // Fetch current streak row
    const { data: existing } = await supabase
      .from("prep_streaks")
      .select("*")
      .eq("user_id", user.id)
      .single();

    const today = new Date().toISOString().slice(0, 10);
    let currentStreak = existing?.current_streak ?? 0;
    let longestStreak = existing?.longest_streak ?? 0;
    const lastDate = existing?.last_activity_date ?? null;
    const systemDesignProgress = {
      ...(existing?.system_design_progress ?? {}),
      ...(parsed.data.system_design_progress ?? {}),
    };

    if (parsed.data.log_activity) {
      if (lastDate === today) {
        // Already logged today — no change
      } else if (lastDate) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yStr = yesterday.toISOString().slice(0, 10);
        if (lastDate === yStr) {
          currentStreak += 1;
        } else {
          currentStreak = 1;
        }
      } else {
        currentStreak = 1;
      }
      longestStreak = Math.max(longestStreak, currentStreak);
    }

    const upsertData = {
      user_id: user.id,
      current_streak: currentStreak,
      longest_streak: longestStreak,
      last_activity_date: parsed.data.log_activity ? today : lastDate,
      system_design_progress: systemDesignProgress,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("prep_streaks")
      .upsert(upsertData, { onConflict: "user_id" })
      .select()
      .single();

    if (error) throw ApiError.internal("Failed to update streak");

    return successResponse({ streak: data });
  } catch (error) {
    return errorResponse(error);
  }
}
