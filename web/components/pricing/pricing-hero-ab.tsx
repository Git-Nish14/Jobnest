"use client";

import { useState } from "react";

// A/B test: pricing hero subheading
// Variant assignment is deterministic via a 30-day cookie so the same
// visitor always sees the same variant across sessions.
// Cookie: _jn_ab_pricing = 'a' | 'b'

const COOKIE  = "_jn_ab_pricing";
const EXPIRES = 30; // days

const VARIANTS = {
  a: "Start on the Free plan and upgrade to Pro when you're ready for advanced tools — or claim a free month as a student.",
  b: "Join thousands of job seekers landing more interviews with NESTAi — free to start, no credit card required.",
} as const;

function getOrAssignVariant(): "a" | "b" {
  if (typeof document === "undefined") return "a";
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=([ab])`));
  if (match) return match[1] as "a" | "b";
  // Assign a random variant and persist it
  const variant: "a" | "b" = Math.random() < 0.5 ? "a" : "b";
  const maxAge  = EXPIRES * 24 * 60 * 60;
  document.cookie = `${COOKIE}=${variant}; max-age=${maxAge}; path=/; SameSite=Lax`;
  return variant;
}

export function PricingHeroSubheading() {
  // Lazy useState initializer: runs during the first client render.
  // Returns 'a' on the server (typeof document === "undefined") so SSR HTML
  // matches; on the client it reads/assigns the cookie immediately.
  // suppressHydrationWarning silences the expected server/client text diff.
  const [variant] = useState<"a" | "b">(getOrAssignVariant);

  return (
    <p
      className="text-xl text-[#55433d] max-w-lg mx-auto leading-relaxed"
      suppressHydrationWarning
    >
      {VARIANTS[variant]}
    </p>
  );
}
