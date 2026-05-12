import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createHmac, timingSafeEqual } from "crypto";

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const STATE_SECRET = (() => {
  const secret = process.env.GITHUB_STATE_SECRET ?? process.env.CSRF_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("GITHUB_STATE_SECRET or CSRF_SECRET is required in production");
  }
  return secret ?? "dev-state-secret";
})();

function verifyState(state: string, cookie: string): boolean {
  if (state !== cookie) return false;
  const dot = state.lastIndexOf(".");
  if (dot < 0) return false;
  const token = state.slice(0, dot);
  const sig = state.slice(dot + 1);
  const expected = createHmac("sha256", STATE_SECRET).update(token).digest("hex");
  if (sig.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
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
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${url}`);
  return res.json() as Promise<T>;
}

/** GET /api/portfolio/github/callback — GitHub OAuth callback handler */
export async function GET(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "localhost:3000";
  const proto = request.headers.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "production" ? "https" : "http");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `${proto}://${host}`;

  const clearStateCookie = (res: NextResponse) => {
    res.cookies.set("gh_oauth_state", "", { maxAge: 0, path: "/" });
    return res;
  };

  const fail = (reason: string) =>
    clearStateCookie(
      NextResponse.redirect(`${appUrl}/profile?github_error=${reason}`)
    );

  try {
    if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) return fail("not_configured");

    const { searchParams } = request.nextUrl;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const cookieState = request.cookies.get("gh_oauth_state")?.value;

    if (!code || !state || !cookieState || !verifyState(state, cookieState)) {
      return fail("invalid_state");
    }

    // Exchange code → access token
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
      }),
    });
    const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };
    if (!tokenData.access_token) return fail("token_exchange_failed");

    const { access_token } = tokenData;

    // Verify Jobnest session
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return clearStateCookie(NextResponse.redirect(`${appUrl}/login`));
    }

    // Fetch profile + repos in parallel
    const [ghUser, ghRepos] = await Promise.all([
      ghFetch<GHUser>("https://api.github.com/user", access_token),
      ghFetch<GHRepo[]>(
        "https://api.github.com/user/repos?sort=pushed&per_page=100&type=owner",
        access_token
      ),
    ]);

    const admin = createAdminClient();
    const now = new Date().toISOString();

    // Upsert connection
    const { error: connErr } = await admin.from("github_connections").upsert(
      {
        user_id: user.id,
        github_id: ghUser.id,
        github_username: ghUser.login,
        github_name: ghUser.name,
        github_avatar_url: ghUser.avatar_url,
        github_bio: ghUser.bio,
        github_location: ghUser.location,
        github_company: ghUser.company,
        github_blog: ghUser.blog,
        github_public_repos: ghUser.public_repos,
        github_followers: ghUser.followers,
        github_following: ghUser.following,
        access_token,
        last_synced_at: now,
        updated_at: now,
      },
      { onConflict: "user_id" }
    );
    if (connErr) {
      console.error("[github/callback] upsert connection:", connErr);
      return fail("db_error");
    }

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
      if (reposErr) console.error("[github/callback] upsert repos:", reposErr);
    }

    const success = NextResponse.redirect(`${appUrl}/profile?github_connected=1`);
    return clearStateCookie(success);
  } catch (e) {
    console.error("[github/callback]", e);
    return fail("server_error");
  }
}
