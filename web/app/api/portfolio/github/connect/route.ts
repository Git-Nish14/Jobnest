import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ApiError, errorResponse } from "@/lib/api/errors";

/**
 * GET /api/portfolio/github/connect
 * Server-side entry point: builds the Supabase GitHub OAuth URL and redirects.
 * Uses the GitHub OAuth App already configured in Supabase (same as login) —
 * no separate GITHUB_CLIENT_ID / SECRET required.
 *
 * The GitHub App's registered callback URL points to Supabase. After Supabase
 * handles the OAuth handshake it redirects to our redirectTo URL below.
 * That URL must be listed in:
 *   Supabase Dashboard → Auth → URL Configuration → Redirect URLs
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw ApiError.unauthorized();

    // Pin to configured app URL — never derive from request headers to prevent
    // open-redirect via forged proxy headers in non-Vercel deployments.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;

    const { data, error: oauthErr } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: `${appUrl}/api/portfolio/github/callback`,
        scopes: "read:user public_repo",
        skipBrowserRedirect: true,
      },
    });

    if (oauthErr || !data.url) {
      throw ApiError.serviceUnavailable(
        "GitHub OAuth is not enabled in Supabase. Enable it at: Supabase Dashboard → Auth → Providers → GitHub"
      );
    }

    return NextResponse.redirect(data.url);
  } catch (e) {
    return errorResponse(e);
  }
}
