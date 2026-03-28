"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FileText, Calendar, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const PRIMARY_TABS = [
  { href: "/dashboard",    label: "Overview",      icon: LayoutDashboard },
  { href: "/applications", label: "Applications",  icon: FileText },
  { href: "/interviews",   label: "Interviews",    icon: Calendar },
  { href: "/nestai",       label: "NESTAi",        icon: Sparkles },
] as const;

export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-50 bottom-tab-bar"
      aria-label="Primary navigation"
    >
      <div className="flex items-stretch h-16">
        {PRIMARY_TABS.map(({ href, label, icon: Icon }) => {
          const isActive =
            pathname === href ||
            (href !== "/dashboard" && pathname.startsWith(href + "/"));

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-1 pt-2 pb-safe transition-colors select-none",
                isActive
                  ? "bottom-tab-active"
                  : "bottom-tab-inactive"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon
                className={cn(
                  "h-5 w-5 transition-transform",
                  isActive && "scale-110"
                )}
                strokeWidth={isActive ? 2.5 : 1.75}
              />
              <span className="text-[10px] font-semibold leading-none tracking-wide">
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
