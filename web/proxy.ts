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
  "/cookies",
  "/pricing",
]);

// API routes that don't require authentication.
// Use exact strings or explicit trailing slashes — never bare prefixes that
// could accidentally match unrelated routes (e.g. "/api/contact" would also
// match a hypothetical "/api/contact-admin").
const publicApiRoutes = new Set(["/api/contact"]);
const publicApiPrefixes = ["/api/auth/", "/api/documents/shared/"];

// ── CSP nonce ──────────────────────────────────────────────────────────────
// Generate a cryptographically random nonce per request using the Web Crypto
// API (available in both Node.js 18+ and the Next.js edge runtime).
// The nonce is injected into the x-nonce request header so Next.js 16 App
// Router automatically threads it onto its generated <script> tags (hydration,
// __NEXT_DATA__, etc.), making nonce-based script-src enforcement safe.

function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  // btoa + fromCharCode avoids Buffer which is not available in edge runtime.
  return btoa(String.fromCharCode(...bytes));
}

function buildCSP(nonce: string): string {
  const directives = [
    "default-src 'self'",
    // 'nonce-…' allows only scripts carrying this nonce attribute.
    // 'strict-dynamic' lets nonce-trusted scripts load further chunks
    // dynamically (required for Next.js code-splitting) without having to
    // whitelist every chunk URL — and it implicitly ignores 'unsafe-inline'.
    // 'unsafe-inline' is kept as a fallback for CSP Level 1 browsers that
    // don't understand nonces; modern browsers ignore it when a nonce is present.
    // 'unsafe-eval' is intentionally removed — Next.js 13+ production builds
    // do not require eval() and removing it blocks eval-based XSS payloads.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline'`,
    // style-src keeps 'unsafe-inline' because Tailwind CSS, Radix UI, and
    // react-remove-scroll inject inline styles that cannot easily carry nonces.
    // CSS injection is much lower risk than script injection.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "frame-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];
  return directives.join("; ");
}

function addSecurityHeaders(response: NextResponse, nonce = "", isHttps = false): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );

  // Apply HSTS and nonce-based CSP on HTTPS requests (production, and staging
  // environments behind a reverse proxy that sets x-forwarded-proto: https).
  if (isProduction || isHttps) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
    response.headers.set("Content-Security-Policy", buildCSP(nonce));
  }

  return response;
}

function isPublicPath(pathname: string): boolean {
  if (publicRoutes.has(pathname)) return true;
  if (publicApiRoutes.has(pathname)) return true;
  for (const prefix of publicApiPrefixes) {
    if (pathname.startsWith(prefix)) return true;
  }
  return false;
}

/**
 * Validate a redirect destination so the proxy cannot be abused as an open
 * redirector.  Only allow paths that:
 *   - start with a single "/" (rules out "//evil.com" protocol-relative URLs)
 *   - contain no protocol separator (rules out "javascript:" and similar)
 *   - are not absolute URLs
 */
function isSafeRedirect(path: string): boolean {
  if (!path) return false;
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;       // protocol-relative URL
  if (/^\/[a-z][a-z0-9+\-.]*:/i.test(path)) return false; // scheme-like
  return true;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip for static files — no auth check or security headers needed.
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Generate a per-request nonce and inject it into the request headers.
  // Next.js 16 App Router reads x-nonce and applies it to every inline
  // <script> it emits (hydration, __NEXT_DATA__, etc.), enabling the
  // nonce-based CSP to enforce without breaking the app.
  const nonce   = generateNonce();
  const isHttps = request.headers.get("x-forwarded-proto") === "https";
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  let response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return addSecurityHeaders(response, nonce, isHttps);
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        // Preserve the nonce in the request headers when the session refresh
        // creates a new response (which happens when cookies need updating).
        const h = new Headers(request.headers);
        h.set("x-nonce", nonce);
        response = NextResponse.next({ request: { headers: h } });
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

  // Redirect unauthenticated users to login (preserve intended destination).
  // Only attach the redirect param if the path is a safe internal path to
  // prevent this endpoint being used as an open redirector.
  if (!user && !isPublic) {
    const loginUrl = new URL("/login", request.url);
    if (isSafeRedirect(pathname)) {
      loginUrl.searchParams.set("redirect", pathname);
    }
    return addSecurityHeaders(NextResponse.redirect(loginUrl), nonce, isHttps);
  }

  // Redirect authenticated users away from pages they shouldn't see while logged in.
  //
  // Landing page (/): always redirect — no loop risk here.
  if (user && pathname === "/") {
    return addSecurityHeaders(NextResponse.redirect(new URL("/dashboard", request.url)), nonce, isHttps);
  }

  // First-time users: redirect to /onboarding.
  // We check === false (not !value) so only NEW accounts that explicitly have
  // onboarding_completed: false are redirected. Existing accounts that were
  // created before onboarding was introduced have undefined → not redirected.
  const skipOnboarding =
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/auth");
  if (user && !skipOnboarding && !isPublic && user.user_metadata?.onboarding_completed === false) {
    return addSecurityHeaders(NextResponse.redirect(new URL("/onboarding", request.url)), nonce, isHttps);
  }

  // Auth form pages (login / signup / forgot-password): redirect unless sb_rm=0.
  // When sb_rm=0 the user opted out of persistence; AuthSync will sign them out
  // the moment they hit the dashboard, causing an infinite redirect loop:
  //   proxy → /dashboard → AuthSync signs out → /login → proxy → /dashboard → …
  // So we let them through to the auth page and let AuthSync clean up the session.
  const authFormPages = new Set(["/login", "/signup", "/forgot-password"]);
  if (user && authFormPages.has(pathname)) {
    // __Host- prefix in production, plain name in development
    const sbRm =
      request.cookies.get("__Host-sb_rm")?.value ??
      request.cookies.get("sb_rm")?.value;
    if (sbRm !== "0") {
      return addSecurityHeaders(NextResponse.redirect(new URL("/dashboard", request.url)), nonce, isHttps);
    }
  }

  return addSecurityHeaders(response, nonce, isHttps);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
