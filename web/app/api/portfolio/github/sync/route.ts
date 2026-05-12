import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { verifyOrigin } from "@/lib/security/csrf";
import { checkRateLimit } from "@/lib/security/rate-limit";

interface GHRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  fork: boolean;
  archived: boolean;
  topics: string[];
  pushed_at: string | null;
}

interface GHUser {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
  bio: string | null;
  location: string | null;
  company: string | null;
  blog: string | null;
  public_repos: number;
  followers: number;
  following: number;
}

async function ghFetch<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  return res.json() as Promise<T>;
}

/** POST /api/portfolio/github/sync — manually re-sync GitHub profile + repos */
export async function POST(request: NextRequest) {
  try {
    if (!verifyOrigin(request)) throw ApiError.forbidden("Invalid request origin.");

    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw ApiError.unauthorized();

    // Rate-limit manual syncs (max 5 per hour)
    const rl = await checkRateLimit(`github-sync:${user.id}`, {
      maxRequests: 5,
      windowMs: 60 * 60_000,
    });
    if (!rl.allowed) throw ApiError.tooManyRequests("Too many sync requests. Try again later.");

    // Fetch stored connection (needs the token)
    const admin = createAdminClient();
    const { data: conn, error: connErr } = await admin
      .from("github_connections")
      .select("access_token")
      .eq("user_id", user.id)
      .single();

    if (connErr || !conn) throw ApiError.badRequest("No GitHub connection found.");

    const { access_token } = conn;
    const now = new Date().toISOString();

    const [ghUser, ghRepos] = await Promise.all([
      ghFetch<GHUser>("https://api.github.com/user", access_token),
      ghFetch<GHRepo[]>(
        "https://api.github.com/user/repos?sort=pushed&per_page=100&type=owner",
        access_token
      ),
    ]);

    // Update profile metadata
    await admin.from("github_connections").update({
      github_name: ghUser.name,
      github_avatar_url: ghUser.avatar_url,
      github_bio: ghUser.bio,
      github_location: ghUser.location,
      github_company: ghUser.company,
      github_blog: ghUser.blog,
      github_public_repos: ghUser.public_repos,
      github_followers: ghUser.followers,
      github_following: ghUser.following,
      last_synced_at: now,
      updated_at: now,
    }).eq("user_id", user.id);

    // Upsert repos
    if (ghRepos.length > 0) {
      const rows = ghRepos.map((r) => ({
        user_id: user.id,
        github_repo_id: r.id,
        name: r.name,
        full_name: r.full_name,
        description: r.description,
        html_url: r.html_url,
        homepage_url: r.homepage ?? null,
        language: r.language,
        stargazers_count: r.stargazers_count,
        forks_count: r.forks_count,
        is_fork: r.fork,
        is_archived: r.archived,
        topics: r.topics ?? [],
        pushed_at: r.pushed_at,
        synced_at: now,
      }));
      const { error: reposErr } = await admin
        .from("github_repos")
        .upsert(rows, { onConflict: "user_id,github_repo_id" });
      if (reposErr) throw ApiError.internal("Failed to save repos.");
    }

    return NextResponse.json({ synced_at: now, repo_count: ghRepos.length });
  } catch (e) {
    return errorResponse(e);
  }
}
