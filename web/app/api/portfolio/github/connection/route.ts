import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ApiError, errorResponse } from "@/lib/api/errors";

/** GET /api/portfolio/github/connection — return the user's GitHub connection or null */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw ApiError.unauthorized();

    const { data } = await supabase
      .from("github_connections")
      .select(
        "github_username, github_name, github_avatar_url, github_bio, github_location, github_company, github_blog, github_public_repos, github_followers, github_following, last_synced_at"
      )
      .eq("user_id", user.id)
      .maybeSingle();

    return NextResponse.json({ connection: data ?? null });
  } catch (e) {
    return errorResponse(e);
  }
}
