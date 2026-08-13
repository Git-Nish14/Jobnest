"use client";

import type { TierResponseRate } from "@/types";
import { cn } from "@/lib/utils";

interface TierResponseChartProps {
  data: TierResponseRate[];
}

// Tier colour tokens — warm → cool gradient across the FAANG → Startup spectrum
const TIER_COLORS: Record<string, { bar: string; label: string }> = {
  "FAANG":   { bar: "bg-[#99462a]",           label: "text-[#99462a] dark:text-[#d97757]" },
  "Tier 1":  { bar: "bg-amber-500",            label: "text-amber-700 dark:text-amber-400" },
  "Tier 2":  { bar: "bg-yellow-500",           label: "text-yellow-700 dark:text-yellow-400" },
  "Tier 3":  { bar: "bg-emerald-500",          label: "text-emerald-700 dark:text-emerald-400" },
  "Startup": { bar: "bg-blue-500",             label: "text-blue-700 dark:text-blue-400" },
};

function tierColor(tier: string) {
  return TIER_COLORS[tier] ?? { bar: "bg-muted-foreground/40", label: "text-muted-foreground" };
}

export function TierResponseChart({ data }: TierResponseChartProps) {
  if (data.length === 0) return null;

  const maxRate = Math.max(...data.map((d) => d.responseRate), 1);

  return (
    <div className="db-content-card h-full flex flex-col gap-4">
      <div>
        <h3 className="db-headline text-base font-semibold text-foreground">Response Rate by Tier</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          % of applications that got a reply · min 2 apps per tier
        </p>
      </div>

      <div className="flex-1 flex flex-col justify-center gap-3">
        {data.map((d) => {
          const colors = tierColor(d.tier);
          const barWidth = maxRate > 0 ? Math.round((d.responseRate / maxRate) * 100) : 0;
          return (
            <div key={d.tier}>
              <div className="flex items-center justify-between mb-1">
                <span className={cn("text-xs font-semibold", colors.label)}>
                  {d.tier}
                </span>
                <span className="text-xs font-bold tabular-nums text-foreground">
                  {d.responseRate}%
                  <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">
                    ({d.responded}/{d.total})
                  </span>
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all duration-500", colors.bar)}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-muted-foreground/60 mt-auto">
        Based on your logged applications · FAANG includes Google, Meta, Apple, Amazon, Netflix, Microsoft
      </p>
    </div>
  );
}
