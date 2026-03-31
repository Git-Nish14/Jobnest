import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ApiError, errorResponse, successResponse } from "@/lib/api/errors";

interface Body {
  displayName?: string;
  aboutMe?: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) throw ApiError.unauthorized();

    // Parse optional profile data sent alongside the completion flag
    const body: Body = await request.json().catch(() => ({}));
    const displayName = typeof body.displayName === "string" ? body.displayName.trim() : undefined;
    const aboutMe = typeof body.aboutMe === "string" ? body.aboutMe.trim() : undefined;

    // One atomic updateUser call — saves name, about me, and marks onboarding done
    const { error } = await supabase.auth.updateUser({
      data: {
        onboarding_completed: true,
        ...(displayName !== undefined && { display_name: displayName }),
        ...(aboutMe !== undefined && { about_me: aboutMe || null }),
      },
    });

    if (error) throw ApiError.internal("Failed to complete onboarding");

    return successResponse({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
