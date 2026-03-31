import { cookies } from "next/headers";
import { randomBytes, createHmac } from "crypto";

const CSRF_SECRET = (() => {
  const secret = process.env.CSRF_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("CSRF_SECRET environment variable is required in production");
  }
  return secret || "dev-csrf-secret-not-for-production";
})();
const CSRF_TOKEN_NAME = "csrf_token";
const CSRF_HEADER_NAME = "x-csrf-token";

export function generateCSRFToken(): string {
  const token = randomBytes(32).toString("hex");
  const signature = createHmac("sha256", CSRF_SECRET).update(token).digest("hex");
  return `${token}.${signature}`;
}

export function verifyCSRFToken(token: string): boolean {
  if (!token || !token.includes(".")) {
    return false;
  }

  const [tokenValue, signature] = token.split(".");
  const expectedSignature = createHmac("sha256", CSRF_SECRET)
    .update(tokenValue)
    .digest("hex");

  // Timing-safe comparison
  if (signature.length !== expectedSignature.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < signature.length; i++) {
    result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
  }

  return result === 0;
}

export async function setCSRFCookie(): Promise<string> {
  const cookieStore = await cookies();
  const token = generateCSRFToken();

  cookieStore.set(CSRF_TOKEN_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60, // 1 hour
  });

  return token;
}

export async function getCSRFToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(CSRF_TOKEN_NAME)?.value ?? null;
}

export { CSRF_TOKEN_NAME, CSRF_HEADER_NAME };

/**
 * Origin-based CSRF guard for API routes.
 *
 * Checks that the request Origin matches the app's own origin.
 * This is defense-in-depth on top of Supabase's SameSite=Lax cookies —
 * blocks cross-origin POST requests from malicious third-party sites.
 *
 * Returns true when the request is safe to proceed.
 */
export function verifyOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");

  // No Origin header = same-origin browser navigation or server-to-server. Allow.
  if (!origin) return true;

  // ── Primary check: derive expected origin from the incoming request itself ──
  // This works correctly on localhost (http://localhost:3000) AND in production
  // behind Vercel/nginx (https://jobnest.nishpatel.dev) without relying on a
  // hardcoded env var that may not match the actual request host.
  const host =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host");

  if (host) {
    // x-forwarded-proto is set by Vercel/reverse-proxies; fall back to NODE_ENV
    const proto =
      request.headers.get("x-forwarded-proto") ??
      (process.env.NODE_ENV === "production" ? "https" : "http");
    if (origin === `${proto}://${host}`) return true;
  }

  // ── Secondary check: match against NEXT_PUBLIC_APP_URL ────────────────────
  // Covers edge cases where x-forwarded-host isn't present.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    // No URL configured — fail open in dev, fail closed in prod
    return process.env.NODE_ENV !== "production";
  }

  try {
    return origin === new URL(appUrl).origin;
  } catch {
    return false;
  }
}
