"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FileText, Calendar, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const REGULAR_TABS = [
  { href: "/dashboard",    label: "Overview",     icon: LayoutDashboard },
  { href: "/applications", label: "Applications", icon: FileText },
  { href: "/interviews",   label: "Interviews",   icon: Calendar },
] as const;

export function BottomTabBar() {
  const pathname = usePathname();
  const isNestAiActive = pathname.startsWith("/nestai");

  return (
    /*
     * inset-x-3  → left/right margins so the pill floats above the screen edge.
     * bottom + border-radius + glass effect all live in dashboard.css.
     * overflow-hidden is required so the pill border-radius clips the children.
     */
    <nav
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
              {/* Icon with soft pill background on active */}
              <div
                className={cn(
                  "flex items-center justify-center w-11 h-7 rounded-xl transition-all duration-200",
                  isActive
                    ? "bg-[#99462a]/12 dark:bg-[#ccff00]/12"
                    : "bg-transparent"
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
          aria-current={isNestAiActive ? "page" : undefined}
        >
          <div
            className={cn(
              "nestai-tab-pill relative flex items-center justify-center w-12 h-8 rounded-2xl transition-all duration-300",
              isNestAiActive ? "nestai-tab-pill-active" : "nestai-tab-pill-idle"
            )}
          >
            <Sparkles
              className={cn(
                "nestai-tab-sparkle h-5.5 w-5.5 transition-all duration-300",
                isNestAiActive
                  ? "text-white dark:text-black"
                  : "text-[#99462a] dark:text-[#ccff00]"
              )}
              strokeWidth={1.75}
            />
          </div>

          <span
            className={cn(
              "text-[11px] font-semibold leading-none tracking-wide transition-all duration-200",
              isNestAiActive
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
