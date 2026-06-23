"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Scrolls the window to the top on every client-side route change.
 * Fixes the issue where navigating via the bottom tab bar leaves the page
 * mid-scroll from the previous visit.
 */
export function ScrollRestorer() {
  const pathname = usePathname();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);
  return null;
}
