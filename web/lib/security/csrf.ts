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

  // ── Primary check: static allowlist from NEXT_PUBLIC_APP_URL ─────────────
  // Using a static env var prevents an attacker from spoofing x-forwarded-host
  // to match an attacker-controlled Origin header.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL;
  if (appUrl) {
    try {
      // Use `if` (not `return`) so the dev fallback below still runs when
      // the env var is set to the production URL but the app is running locally.
      if (origin === new URL(appUrl).origin) return true;
    } catch {
      return false;
    }
  }

  // ── Fallback (dev only): derive expected origin from the request host ─────
  // Reached when no static URL is configured OR when the configured URL doesn't
  // match (e.g. NEXT_PUBLIC_APP_URL points to production but app runs on localhost).
  // x-forwarded-host is NOT trusted in production, so this is strictly dev-only.
  if (process.env.NODE_ENV === "production") return false;

  const host = request.headers.get("host");
  if (host) {
    if (origin === `http://${host}`) return true;
    if (origin === `https://${host}`) return true; // HTTPS dev servers (e.g. next dev --experimental-https)
  }

  return false;
}
