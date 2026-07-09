"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { LayoutDashboard, FileText, Calendar, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const REGULAR_TABS = [
  { href: "/dashboard",    label: "Overview",     icon: LayoutDashboard },
  { href: "/applications", label: "Applications", icon: FileText },
  { href: "/interviews",   label: "Interviews",   icon: Calendar },
] as const;

const SCROLL_HIDE_THRESHOLD = 80; // px scrolled before hiding

export function BottomTabBar() {
  const pathname = usePathname();

  useEffect(() => {
    /*
     * Use window.location.pathname (not the React usePathname() value) so
     * the class toggle is always driven by the REAL browser URL, immune to
     * any stale React rendering state during reconciliation.
     *
     * pathname from usePathname() is kept as the dependency so this effect
     * re-runs every time the route changes.
     */
    const onNestAi = window.location.pathname.startsWith("/nestai");

    // html.page-nestai → dashboard.css hides .bottom-tab-bar + repositions
    // .nestai-input-area so the chat input sits at the safe-area bottom.
    document.documentElement.classList.toggle("page-nestai", onNestAi);

    // Clear any stale scroll-hide state left over from a previous page.
    document.documentElement.classList.remove("tab-bar-hidden");

    if (onNestAi) return; // NESTAi has its own full-screen layout, no scroll listener

    let lastY = window.scrollY;
    let ticking = false;

    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const shouldHide = y > lastY && y > SCROLL_HIDE_THRESHOLD;
        document.documentElement.classList.toggle("tab-bar-hidden", shouldHide);
        lastY = y;
        ticking = false;
      });
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.documentElement.classList.remove("tab-bar-hidden");
    };
  }, [pathname]); // re-run on every route change

  /*
   * Always render the nav — conditional rendering (return null / tabIndex)
   * based on usePathname() caused hydration mismatches in Next.js 16 because
   * the pathname value can differ between the server render and client
   * hydration during route transitions.
   *
   * Hiding on NESTAi is handled purely by CSS:
   *   html.page-nestai .bottom-tab-bar { display: none; }   (dashboard.css)
   * The useEffect above toggles html.page-nestai after every navigation.
   *
   * suppressHydrationWarning on <nav> silences any remaining class-name delta
   * between SSR and the first client render.
   */
  const nestAiActive = pathname.startsWith("/nestai");

  return (
    <nav
      suppressHydrationWarning
      className="md:hidden fixed inset-x-3 z-50 overflow-hidden bottom-tab-bar"
      aria-label="Primary navigation"
    >
      <div className="flex items-stretch h-19">

        {/* ── Regular tabs ─────────────────────────────────────────────────── */}
        {REGULAR_TABS.map(({ href, label, icon: Icon }) => {
          const isActive =
            pathname === href ||
            (href !== "/dashboard" && pathname.startsWith(href + "/"));

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-1.5 select-none transition-colors",
                isActive ? "bottom-tab-active" : "bottom-tab-inactive"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <div
                className={cn(
                  "flex items-center justify-center w-11 h-7 rounded-xl transition-all duration-200",
                  isActive ? "bg-[#99462a]/12 dark:bg-[#ccff00]/12" : "bg-transparent"
                )}
              >
                <Icon
                  className="h-5.5 w-5.5 transition-all duration-200"
                  strokeWidth={isActive ? 2.25 : 1.75}
                />
              </div>
              <span className="text-[11px] font-semibold leading-none tracking-wide truncate max-w-22">
                {label}
              </span>
            </Link>
          );
        })}

        {/* ── NESTAi — gradient sparkle tab ────────────────────────────────── */}
        <Link
          href="/nestai"
          className="flex-1 flex flex-col items-center justify-center gap-1.5 select-none"
          aria-current={nestAiActive ? "page" : undefined}
        >
          <div
            className={cn(
              "nestai-tab-pill relative flex items-center justify-center w-12 h-8 rounded-2xl transition-all duration-300",
              nestAiActive ? "nestai-tab-pill-active" : "nestai-tab-pill-idle"
            )}
          >
            <Sparkles
              className={cn(
                "nestai-tab-sparkle h-5.5 w-5.5 transition-all duration-300",
                nestAiActive ? "text-white dark:text-black" : "text-[#99462a] dark:text-[#ccff00]"
              )}
              strokeWidth={1.75}
            />
          </div>
          <span
            className={cn(
              "text-[11px] font-semibold leading-none tracking-wide transition-all duration-200",
              nestAiActive
                ? "text-[#99462a] dark:text-[#ccff00] opacity-100"
                : "text-[#55433d] dark:text-white/55 opacity-65"
            )}
          >
            NESTAi
          </span>
        </Link>
      </div>
    </nav>
  );
}
