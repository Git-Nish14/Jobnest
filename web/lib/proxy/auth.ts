import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const isProduction = process.env.NODE_ENV === "production";

// Routes that don't require authentication
const publicRoutes = [
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/auth/callback",
  "/auth/confirm",
  "/privacy",
  "/terms",
  "/contact",
];

// Routes that require authentication
const protectedRoutes = ["/dashboard", "/applications"];

// API routes that don't require authentication
const publicApiRoutes = ["/api/contact", "/api/auth"];

export async function handleAuth(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static files and public API routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".") ||
    publicApiRoutes.some((route) => pathname.startsWith(route))
  ) {
    return addSecurityHeaders(NextResponse.next());
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return addSecurityHeaders(supabaseResponse);
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, {
            ...options,
            // Don't override httpOnly - Supabase manages this
            secure: isProduction,
            sameSite: "lax",
            path: "/",
          })
        );
      },
    },
  });

  // Refresh session if it exists
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Check if route is protected
  const isProtectedRoute = protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );

  // Check if route is public (auth pages)
  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );

  // Redirect unauthenticated users from protected routes
  if (isProtectedRoute && !user) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("redirect", pathname);
    return addSecurityHeaders(NextResponse.redirect(redirectUrl));
  }

  // Redirect authenticated users from auth pages to dashboard
  if (user && (pathname === "/login" || pathname === "/signup")) {
    return addSecurityHeaders(NextResponse.redirect(new URL("/dashboard", request.url)));
  }

  // Check email verification for protected routes
  if (isProtectedRoute && user) {
    const emailVerified = user.email_confirmed_at;

    if (!emailVerified) {
      const redirectUrl = new URL("/verify-email", request.url);
      redirectUrl.searchParams.set("email", user.email || "");
      return addSecurityHeaders(NextResponse.redirect(redirectUrl));
    }

    // Check if re-verification is needed (every 7 days)
    const lastVerified = user.email_confirmed_at;
    if (lastVerified) {
      const lastVerifiedDate = new Date(lastVerified);
      const daysSinceVerification = Math.floor(
        (Date.now() - lastVerifiedDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Check user metadata for last reverification
      const lastReverification = user.user_metadata?.last_reverification;
      const needsReverification = !lastReverification ||
        Math.floor((Date.now() - new Date(lastReverification).getTime()) / (1000 * 60 * 60 * 24)) >= 7;

      if (needsReverification && daysSinceVerification >= 7) {
        // Store that reverification is needed in a cookie
        const response = NextResponse.redirect(new URL("/verify-email?reverify=true", request.url));
        response.cookies.set("needs_reverification", "true", {
          httpOnly: true,
          secure: isProduction,
          sameSite: "lax",
          maxAge: 60 * 60, // 1 hour
        });
        return addSecurityHeaders(response);
      }
    }
  }

  return addSecurityHeaders(supabaseResponse);
}

export function addSecurityHeaders(response: NextResponse): NextResponse {
  // Security headers
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()"
  );

  if (isProduction) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }

  // Content Security Policy
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "frame-src 'self' https://*.supabase.co blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ")
  );

  return response;
}

