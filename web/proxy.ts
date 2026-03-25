import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const isProduction = process.env.NODE_ENV === "production";

// Public routes that don't require authentication
const publicRoutes = new Set([
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/auth/callback",
  "/auth/auth-error",
  "/contact",
  "/privacy",
  "/terms",
]);

// API routes that don't require authentication
const publicApiPrefixes = ["/api/auth/", "/api/contact"];

function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );

  if (isProduction) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
    response.headers.set(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https: blob:",
        "font-src 'self' data:",
        "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
        "frame-src 'self' blob:",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join("; ")
    );
  }

  return response;
}

function isPublicPath(pathname: string): boolean {
  if (publicRoutes.has(pathname)) return true;
  for (const prefix of publicApiPrefixes) {
    if (pathname.startsWith(prefix)) return true;
  }
  return false;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip for static files
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return addSecurityHeaders(response);
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({
          request: { headers: request.headers },
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, {
            ...options,
            secure: isProduction,
            sameSite: "lax",
          })
        );
      },
    },
  });

  // Refresh session — keeps tokens from expiring between requests
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic = isPublicPath(pathname);

  // Redirect unauthenticated users to login (preserve intended destination)
  if (!user && !isPublic) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return addSecurityHeaders(NextResponse.redirect(loginUrl));
  }

  // Redirect authenticated users away from pages they shouldn't see while logged in.
  //
  // Landing page (/): always redirect — no loop risk here.
  if (user && pathname === "/") {
    return addSecurityHeaders(NextResponse.redirect(new URL("/dashboard", request.url)));
  }

  // Auth form pages (login / signup / forgot-password): redirect unless sb_rm=0.
  // When sb_rm=0 the user opted out of persistence; AuthSync will sign them out
  // the moment they hit the dashboard, causing an infinite redirect loop:
  //   proxy → /dashboard → AuthSync signs out → /login → proxy → /dashboard → …
  // So we let them through to the auth page and let AuthSync clean up the session.
  const authFormPages = new Set(["/login", "/signup", "/forgot-password"]);
  if (user && authFormPages.has(pathname)) {
    const sbRm = request.cookies.get("sb_rm")?.value;
    if (sbRm !== "0") {
      return addSecurityHeaders(NextResponse.redirect(new URL("/dashboard", request.url)));
    }
  }

  return addSecurityHeaders(response);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
