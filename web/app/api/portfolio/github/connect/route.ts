import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { randomBytes, createHmac } from "crypto";

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const STATE_SECRET = (() => {
  const secret = process.env.GITHUB_STATE_SECRET ?? process.env.CSRF_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("GITHUB_STATE_SECRET or CSRF_SECRET is required in production");
  }
  return secret ?? "dev-state-secret";
})();

/** GET /api/portfolio/github/connect — redirect authenticated user to GitHub OAuth */
export async function GET(request: NextRequest) {
  try {
    if (!GITHUB_CLIENT_ID) {
      throw ApiError.serviceUnavailable("GitHub OAuth is not configured.");
    }

    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw ApiError.unauthorized();

    const state = randomBytes(32).toString("hex");
    const sig = createHmac("sha256", STATE_SECRET).update(state).digest("hex");
    const signedState = `${state}.${sig}`;

    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "localhost:3000";
    const proto = request.headers.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "production" ? "https" : "http");
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `${proto}://${host}`;

    const params = new URLSearchParams({
      client_id: GITHUB_CLIENT_ID,
      redirect_uri: `${appUrl}/api/portfolio/github/callback`,
      scope: "read:user public_repo",
      state: signedState,
    });

    const res = NextResponse.redirect(
      `https://github.com/login/oauth/authorize?${params.toString()}`
    );
    res.cookies.set("gh_oauth_state", signedState, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });
    return res;
  } catch (e) {
    return errorResponse(e);
  }
}
