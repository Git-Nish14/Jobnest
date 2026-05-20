"use client";

import type { CompanyCount } from "@/types";

interface Props { data: CompanyCount[] }

export function TopCompaniesChart({ data }: Props) {
  if (!data.length) return (
    <div className="db-panel h-full flex flex-col">
      <h2 className="db-panel-title mb-4">Top Companies</h2>
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        Add more applications to see your top companies.
      </div>
    </div>
  );

  const max = data[0].count;

  return (
    <div className="db-panel h-full flex flex-col">
      <div className="flex items-start justify-between mb-5">
        <h2 className="db-panel-title">Top Companies</h2>
        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Apps</span>
      </div>

      <div className="flex flex-col gap-3 flex-1 justify-center">
        {data.slice(0, 7).map((row, i) => {
          const pct = Math.max(Math.round((row.count / max) * 100), 6);
          return (
            <div key={row.company} className="flex items-center gap-3">
              <span className="text-[10px] font-bold text-muted-foreground/60 w-4 shrink-0 text-right">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-medium text-foreground truncate max-w-[80%]">{row.company}</span>
                  <span className="text-xs font-semibold text-foreground ml-2 shrink-0">{row.count}</span>
                </div>
                <svg width="100%" height="6" aria-hidden="true" className="rounded-full overflow-hidden">
                  <rect x="0" y="0" width="100%" height="6" className="fill-[#dbc1b9]/25 dark:fill-white/8" />
                  <rect x="0" y="0" width={`${pct}%`} height="6" rx="3"
                    className={i === 0 ? "fill-[#99462a] dark:fill-[#ccff00]" : "fill-[#c8b8b0] dark:fill-white/30"}
                  />
                </svg>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
