"use client";

import type { WeekdayActivity } from "@/types";

interface Props { data: WeekdayActivity[] }

const CHART_H = 100;

export function WeekdayActivityChart({ data }: Props) {
  const total  = data.reduce((s, d) => s + d.count, 0);
  const maxVal = Math.max(...data.map((d) => d.count), 1);
  const peakDay = data.reduce((best, d, i) => d.count > data[best].count ? i : best, 0);

  if (total === 0) return (
    <div className="db-panel h-full flex flex-col">
      <h2 className="db-panel-title mb-4">Best Day to Apply</h2>
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        Add applications to see your most productive days.
      </div>
    </div>
  );

  return (
    <div className="db-panel h-full flex flex-col">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="db-panel-title">Best Day to Apply</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Most active: <span className="font-semibold text-[#99462a] dark:text-[#ccff00]">{data[peakDay]?.day}</span>
            {" "}({data[peakDay]?.count} app{data[peakDay]?.count !== 1 ? "s" : ""})
          </p>
        </div>
        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold shrink-0">Total {total}</span>
      </div>

      <div className="flex items-end gap-1.5 flex-1">
        {data.map((item, i) => {
          const barH = Math.max(Math.round((item.count / maxVal) * CHART_H * 0.92), item.count > 0 ? 6 : 2);
          const isPeak = i === peakDay && item.count > 0;
          return (
            <div key={item.day} className="flex-1 flex flex-col items-center gap-1.5 group">
              <div className="relative w-full flex justify-center">
                {/* Hover tooltip */}
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-foreground text-background text-[10px] px-2 py-1 rounded whitespace-nowrap pointer-events-none z-10">
                  {item.count} app{item.count !== 1 ? "s" : ""}
                </div>
                <svg width="100%" height={barH} aria-hidden="true" className="rounded-t-md overflow-hidden">
                  <rect
                    x="0" y="0" width="100%" height={barH}
                    className={isPeak
                      ? "fill-[#99462a] dark:fill-[#ccff00]"
                      : "fill-[#dbc1b9] dark:fill-white/20"}
                  />
                </svg>
              </div>
              <span className="text-[10px] text-muted-foreground font-semibold uppercase">{item.day}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
