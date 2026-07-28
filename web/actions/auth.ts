"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Server action — sign out.
 *
 * Clearing the session server-side (via the SSR Supabase client) is the
 * architecturally correct pattern for Next.js App Router: the session lives
 * in HttpOnly cookies that only the server can reliably write.  The server
 * then issues a 302 redirect to /login, so the browser follows with a fresh
 * request that carries no session cookies.
 *
 * Compared to a client-side router.push() approach, this avoids:
 *   - RSC cache races (router.refresh() fighting router.push())
 *   - Timing gaps between cookie deletion and the next navigation request
 */
export async function signOutAction(scope: "local" | "global" = "global") {
  // Runtime allowlist — TypeScript union types are erased at runtime.
  // A crafted POST to this server-action endpoint could pass scope="others",
  // which is a valid Supabase value that revokes every session *except* the
  // caller's, leaving an attacker with continued access while the victim is
  // locked out.  Hard-clamp to the two values we intentionally expose.
  const safeScope: "local" | "global" = scope === "local" ? "local" : "global";
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: safeScope });
  redirect("/login");
}
