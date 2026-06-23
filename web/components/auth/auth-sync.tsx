"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * AuthSync — mounted once inside the dashboard layout.
 *
 * Two jobs:
 * 1. Cross-tab logout sync: when the user signs out in another tab,
 *    every other open tab immediately redirects to /login.
 *
 * 2. "Stay signed in" enforcement: if the user unchecked "Stay signed in"
 *    at login, we set sb_remember_me=0 (httpOnly cookie). On a fresh browser
 *    session sessionStorage is empty, so we sign them out automatically.
 *    Within the same browser session sessionStorage persists so navigation
 *    within the app keeps them signed in as expected.
 */
export function AuthSync() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    // ── Remember-me check ────────────────────────────────────────────────────
    // sb_remember_me is HttpOnly so we can't read it directly here.
    // Instead we use a non-HttpOnly companion cookie sb_rm (set server-side
    // alongside the HttpOnly one) that JS can read.
    // Fallback: if neither cookie exists, assume remembered (backward compat).
    const cookies = Object.fromEntries(
      document.cookie.split(";").map((c) => {
        const [k, ...v] = c.trim().split("=");
        return [k, v.join("=")];
      })
    );

    // In production the cookie uses the __Host- prefix for subdomain-injection
    // protection. Fall back to the unprefixed name in development (http).
    const rememberMe = cookies["__Host-sb_rm"] ?? cookies["sb_rm"]; // "1" | "0" | undefined
    const sessionActive = sessionStorage.getItem("jobnest_session");

    if (rememberMe === "0" && !sessionActive) {
      // New browser session + user opted out of persistence → sign out
      supabase.auth.signOut().then(() => router.replace("/login"));
      return;
    }

    // Mark this tab's session as active (survives page nav, cleared on tab/browser close)
    sessionStorage.setItem("jobnest_session", "active");

    // ── Timezone sync (once per day) ─────────────────────────────────────────
    // Captures the user's IANA timezone + UTC offset so cron emails can be
    // delivered at ~8am local time rather than a fixed UTC time.
    try {
      const today = new Date().toISOString().slice(0, 10);
      if (localStorage.getItem("jobnest_tz_synced") !== today) {
        const utcOffsetHours = -new Date().getTimezoneOffset() / 60;
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        // Only mark as synced after the request succeeds so a transient
        // failure causes a retry on the next dashboard load (not 24h later).
        fetch("/api/profile/timezone", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ timezone, utcOffsetHours }),
        })
          .then((r) => { if (r.ok) localStorage.setItem("jobnest_tz_synced", today); })
          .catch(() => {});
      }
    } catch {
      // non-critical — localStorage or Intl not available
    }

    // ── Cross-tab logout sync ────────────────────────────────────────────────
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        sessionStorage.removeItem("jobnest_session");
        router.replace("/login");
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  return null;
}
