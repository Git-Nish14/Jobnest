import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptToken } from "@/lib/security/tokens";

interface GHUser {
  id: number; login: string; name: string | null; avatar_url: string;
  bio: string | null; location: string | null; company: string | null;
  blog: string | null; public_repos: number; followers: number; following: number;
}

interface GHRepo {
  id: number; name: string; full_name: string; description: string | null;
  html_url: string; homepage: string | null; language: string | null;
  stargazers_count: number; forks_count: number; fork: boolean;
  archived: boolean; topics: string[]; pushed_at: string | null;
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
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${url}`);
  return res.json() as Promise<T>;
}

/**
 * GET /api/portfolio/github/callback
 * Supabase redirects here after the GitHub OAuth handshake.
 * Exchanges the code for a session (PKCE), reads session.provider_token
 * (the GitHub access token), then syncs profile + repos.
 *
 * This URL must be in: Supabase Dashboard → Auth → URL Configuration → Redirect URLs
 */
export async function GET(request: NextRequest) {
  // Use the configured app URL for all redirects — never derive from request
  // headers (x-forwarded-host/x-forwarded-proto) to prevent open-redirect via
  // forged proxy headers in non-Vercel deployments.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;

  const fail = (reason: string) =>
    NextResponse.redirect(`${appUrl}/profile?github_error=${reason}`);

  try {
    const code = request.nextUrl.searchParams.get("code");
    if (!code) return fail("missing_code");

    // Exchange Supabase PKCE code → session (provider_token = GitHub access token)
    const supabase = await createClient();
    const { data: { session }, error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeErr || !session) {
      console.error("[github/callback] exchangeCodeForSession:", exchangeErr);
      return fail("auth_error");
    }

    const access_token = session.provider_token;
    if (!access_token) return fail("no_provider_token");

    const { user } = session;

    const [ghUser, ghRepos] = await Promise.all([
      ghFetch<GHUser>("https://api.github.com/user", access_token),
      ghFetch<GHRepo[]>("https://api.github.com/user/repos?sort=pushed&per_page=100&type=owner", access_token),
    ]);

    const admin = createAdminClient();
    const now = new Date().toISOString();

    // Encrypt token at rest — decryptToken() handles legacy plaintext tokens transparently
    const stored_token = encryptToken(access_token);

    const { error: connErr } = await admin.from("github_connections").upsert(
      {
        user_id: user.id, github_id: ghUser.id, github_username: ghUser.login,
        github_name: ghUser.name, github_avatar_url: ghUser.avatar_url,
        github_bio: ghUser.bio, github_location: ghUser.location,
        github_company: ghUser.company, github_blog: ghUser.blog,
        github_public_repos: ghUser.public_repos, github_followers: ghUser.followers,
        github_following: ghUser.following, access_token: stored_token,
        last_synced_at: now, updated_at: now,
      },
      { onConflict: "user_id" }
    );
    if (connErr) { console.error("[github/callback] upsert:", connErr); return fail("db_error"); }

    if (ghRepos.length > 0) {
      const rows = ghRepos.map((r) => ({
        user_id: user.id, github_repo_id: r.id, name: r.name, full_name: r.full_name,
        description: r.description, html_url: r.html_url, homepage_url: r.homepage ?? null,
        language: r.language, stargazers_count: r.stargazers_count, forks_count: r.forks_count,
        is_fork: r.fork, is_archived: r.archived, topics: r.topics ?? [],
        pushed_at: r.pushed_at, synced_at: now,
      }));
      const { error: reposErr } = await admin
        .from("github_repos")
        .upsert(rows, { onConflict: "user_id,github_repo_id" });
      if (reposErr) console.error("[github/callback] repos:", reposErr);
    }

    return NextResponse.redirect(`${appUrl}/profile?github_connected=1`);
  } catch (e) {
    console.error("[github/callback]", e);
    return fail("server_error");
  }
}
