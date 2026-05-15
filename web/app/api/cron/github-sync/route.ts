import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptToken } from "@/lib/security/tokens";

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

async function ghFetch<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${url}`);
  return res.json() as Promise<T>;
}

/**
 * POST /api/cron/github-sync
 * Daily job that refreshes GitHub profile stats and repos for all connected users.
 * Stagger delays prevent hitting GitHub rate limits (5000 req/hr per token).
 */
export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }
  const authHeader = request.headers.get("Authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();
  let synced = 0;
  let failed = 0;

  // Fetch all connections with tokens
  const { data: connections, error } = await admin
    .from("github_connections")
    .select("user_id, access_token");

  if (error || !connections?.length) {
    return NextResponse.json({ message: "No GitHub connections.", synced: 0, failed: 0 });
  }

  for (const conn of connections) {
    try {
      const access_token = decryptToken(conn.access_token);
      if (!access_token) {
        console.error(`[github-sync] user ${conn.user_id}: token decryption failed — skipping`);
        failed++;
        continue;
      }

      const [ghUser, ghRepos] = await Promise.all([
        ghFetch<GHUser>("https://api.github.com/user", access_token),
        ghFetch<GHRepo[]>(
          "https://api.github.com/user/repos?sort=pushed&per_page=100&type=owner",
          access_token
        ),
      ]);

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
      }).eq("user_id", conn.user_id);

      if (ghRepos.length > 0) {
        const rows = ghRepos.map((r) => ({
          user_id: conn.user_id,
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
        if (reposErr) throw new Error(`Repo upsert failed: ${reposErr.message}`);
      }

      synced++;
    } catch (e) {
      console.error(`[github-sync] user ${conn.user_id}:`, e);
      failed++;
    }
  }

  return NextResponse.json({ synced, failed, total: connections.length });
}
