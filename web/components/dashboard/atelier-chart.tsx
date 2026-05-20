"use client";

import { useState } from "react";
import type { WeeklyTrend } from "@/types";

interface AtelierChartProps {
  data: WeeklyTrend[];
}

const CHART_HEIGHT = 200;

const PERIODS = [
  { label: "4w", weeks: 4 },
  { label: "8w", weeks: 8 },
  { label: "12w", weeks: 12 },
] as const;

export function AtelierChart({ data }: AtelierChartProps) {
  const [period, setPeriod] = useState<4 | 8 | 12>(8);

  const visible = data.slice(-period);
  const maxCount = Math.max(...visible.map((d) => d.count), 1);
  const peakIdx  = visible.reduce((best, d, i) => (d.count > visible[best].count ? i : best), 0);

  return (
    <div className="db-panel h-full flex flex-col">
      <div className="flex justify-between items-center mb-8">
        <h2 className="db-panel-title">Application Velocity</h2>
        <div className="flex items-center gap-1">
          {PERIODS.map(({ label, weeks }) => (
            <button
              key={weeks}
              type="button"
              onClick={() => setPeriod(weeks as 4 | 8 | 12)}
              className={
                period === weeks
                  ? "px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#99462a] text-white dark:bg-[#ccff00] dark:text-black transition-colors"
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
              const barPx = Math.max(Math.round((item.count / maxCount) * CHART_HEIGHT * 0.92), 6);
              const isHighlight = i === peakIdx && item.count > 0;
              return (
                <div key={i} className="flex-1 relative group">
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-foreground text-background text-[10px] px-2 py-1 rounded whitespace-nowrap pointer-events-none z-10">
                    {item.count} app{item.count !== 1 ? "s" : ""}
                  </div>
                  {/* SVG bar — height attr is an SVG presentation attribute, no inline style needed */}
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
                {item.week}
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
