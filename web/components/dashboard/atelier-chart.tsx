"use client";

import type { WeeklyTrend } from "@/types";

interface AtelierChartProps {
  data: WeeklyTrend[];
}

const CHART_HEIGHT = 200; // px — matches .db-chart-area height in dashboard.css

export function AtelierChart({ data }: AtelierChartProps) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const peakIdx = data.reduce((best, d, i) => (d.count > data[best].count ? i : best), 0);

  return (
    <div className="db-panel h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h2 className="db-panel-title">Application Velocity</h2>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#99462a]/30 dark:bg-[#ccff00]/30" />
          <span className="text-xs text-muted-foreground font-medium">Weekly Submissions</span>
        </div>
      </div>

      {data.length > 0 ? (
        <>
          {/* Bars — pixel heights fix the "height: X% on flex child" browser bug */}
          <div className="db-chart-area">
            {data.map((item, i) => {
              const barPx = Math.max(Math.round((item.count / maxCount) * CHART_HEIGHT * 0.92), 6);
              const isHighlight = i === peakIdx && item.count > 0;
              return (
                <div key={i} className="flex-1 relative group">
                  {/* Tooltip on hover */}
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-foreground text-background text-[10px] px-2 py-1 rounded whitespace-nowrap pointer-events-none z-10">
                    {item.count}
                  </div>
                  <div
                    className={`w-full db-bar ${isHighlight ? "db-bar-highlight" : "db-bar-normal"}`}
                    style={{ height: `${barPx}px` }}
                  />
                </div>
              );
            })}
          </div>

          {/* X-axis labels */}
          <div className="flex justify-between mt-3 px-1">
            {data.map((item, i) => (
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
