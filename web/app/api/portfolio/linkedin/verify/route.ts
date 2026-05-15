import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ApiError, errorResponse } from "@/lib/api/errors";

const LINKEDIN_RE = /^https:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9_.%-]{3,100}\/?$/;

/**
 * GET /api/portfolio/linkedin/verify?url=...
 * Best-effort server-side check: does the LinkedIn profile URL resolve?
 * Returns { status: "found" | "not_found" | "private" | "blocked" }
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw ApiError.unauthorized();

    const url = request.nextUrl.searchParams.get("url");
    if (!url || !LINKEDIN_RE.test(url)) {
      return NextResponse.json({ status: "invalid" });
    }

    try {
      const res = await fetch(url, {
        method: "HEAD",
        redirect: "follow",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
          Accept: "text/html",
        },
        signal: AbortSignal.timeout(6000),
      });

      if (res.status === 200) return NextResponse.json({ status: "found" });
      if (res.status === 404) return NextResponse.json({ status: "not_found" });
      if (res.status === 999 || res.status === 429)
        return NextResponse.json({ status: "blocked" });
      // LinkedIn often redirects unauthenticated users to /login — treat as "private"
      return NextResponse.json({ status: "private" });
    } catch {
      // Network error, timeout, or bot-block — can't determine
      return NextResponse.json({ status: "blocked" });
    }
  } catch (e) {
    return errorResponse(e);
  }
}
