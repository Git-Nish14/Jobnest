import { createClient } from "@/lib/supabase/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/dashboard";

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    if (!error) {
      // Update last reverification timestamp on successful verification
      if (type === "email") {
        await supabase.auth.updateUser({
          data: {
            last_reverification: new Date().toISOString(),
          },
        });
      }

      // Clear any reverification cookies
      const response = NextResponse.redirect(new URL(next, origin));
      response.cookies.delete("needs_reverification");

      return response;
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(new URL("/auth/auth-error", origin));
}
