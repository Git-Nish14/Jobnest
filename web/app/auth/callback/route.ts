import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const response = NextResponse.redirect(new URL(next, origin));
      // OAuth users always stay signed in — set the JS-readable companion cookie
      const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
      response.headers.append(
        "Set-Cookie",
        `sb_rm=1; Path=/; Max-Age=${30 * 24 * 60 * 60}; SameSite=Lax${secure}`
      );
      return response;
    }
  }

  return NextResponse.redirect(new URL("/auth/auth-error", origin));
}
