"use client";

import { useState } from "react";
import type { DailyTrend, WeeklyTrend, MonthlyTrend } from "@/types";

interface AtelierChartProps {
  dailyData:   DailyTrend[];
  weeklyData:  WeeklyTrend[];
  monthlyData: MonthlyTrend[];
}

type Granularity = "D" | "W" | "M";

const CHART_HEIGHT = 200;

// How many bars to show per granularity (window selector options)
const WINDOWS: Record<Granularity, { label: string; count: number }[]> = {
  D: [{ label: "14d", count: 14 }, { label: "30d", count: 30 }],
  W: [{ label: "8w",  count: 8  }, { label: "12w", count: 12 }, { label: "24w", count: 24 }],
  M: [{ label: "All", count: 999 }],
};

function getLabel(gran: Granularity, item: DailyTrend | WeeklyTrend | MonthlyTrend): string {
  if (gran === "D") return (item as DailyTrend).date;
  if (gran === "W") return (item as WeeklyTrend).week;
  return (item as MonthlyTrend).month;
}

export function AtelierChart({ dailyData, weeklyData, monthlyData }: AtelierChartProps) {
  const [gran, setGran]     = useState<Granularity>("W");
  const [window_, setWindow] = useState<number>(8);

  // When switching granularity, reset window to first option for that mode
  const switchGran = (g: Granularity) => {
    setGran(g);
    setWindow(WINDOWS[g][0].count);
  };

  const allData: (DailyTrend | WeeklyTrend | MonthlyTrend)[] =
    gran === "D" ? dailyData : gran === "W" ? weeklyData : monthlyData;

  const visible  = allData.slice(-Math.min(window_, allData.length));
  const maxCount = Math.max(...visible.map((d) => d.count), 1);
  const peakIdx  = visible.reduce((best, d, i) => (d.count > visible[best].count ? i : best), 0);

  // Show abbreviated x-axis labels when many bars are visible
  const showEvery = visible.length > 20 ? 5 : visible.length > 12 ? 3 : 1;

  return (
    <div className="db-panel h-full flex flex-col">
      {/* Header — stacks vertically on mobile, row on sm+ */}
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center mb-6 sm:mb-8">
        <h2 className="db-panel-title leading-tight">Application Velocity</h2>
        <div className="flex items-center gap-1 flex-wrap">
          {/* Granularity toggle: D / W / M */}
          <div className="flex items-center gap-0.5 rounded-full bg-muted p-0.5 mr-1">
            {(["D", "W", "M"] as Granularity[]).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => switchGran(g)}
                className={
                  gran === g
                    ? "px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#99462a] text-white dark:bg-[#ccff00] dark:text-black transition-colors"
                    : "px-2.5 py-1 rounded-full text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
                }
              >
                {g}
              </button>
            ))}
          </div>
          {/* Window size — only show when more than one option */}
          {WINDOWS[gran].length > 1 && WINDOWS[gran].map(({ label, count }) => (
            <button
              key={count}
              type="button"
              onClick={() => setWindow(count)}
              className={
                window_ === count
                  ? "px-2.5 py-1 rounded-full text-[11px] font-semibold bg-foreground/10 text-foreground transition-colors"
                  : "px-2.5 py-1 rounded-full text-[11px] font-semibold text-muted-foreground hover:bg-muted transition-colors"
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {visible.length > 0 ? (
        <>
          <div className="db-chart-area">
            {visible.map((item, i) => {
              const barPx = Math.max(Math.round((item.count / maxCount) * CHART_HEIGHT * 0.92), item.count > 0 ? 6 : 2);
              const isHighlight = i === peakIdx && item.count > 0;
              return (
                <div key={i} className="flex-1 relative group">
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-foreground text-background text-[10px] px-2 py-1 rounded whitespace-nowrap pointer-events-none z-10">
                    {item.count} app{item.count !== 1 ? "s" : ""}
                  </div>
                  <svg width="100%" height={barPx} aria-hidden="true" className="overflow-visible">
                    <rect
                      x="0" y="0" width="100%" height={barPx} rx="4"
                      className={isHighlight ? "fill-[#99462a] dark:fill-[#ccff00]" : "fill-[#dbc1b9] dark:fill-white/20"}
                    />
                  </svg>
                </div>
              );
            })}
          </div>

          <div className="flex justify-between mt-3 px-1">
            {visible.map((item, i) => (
              <span
                key={i}
                className="flex-1 text-center text-[10px] text-muted-foreground uppercase font-semibold truncate"
              >
                {i % showEvery === 0 ? getLabel(gran, item) : ""}
              </span>
            ))}
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          No applications tracked yet — start adding!
        </div>
      )}
    </div>
  );
}
