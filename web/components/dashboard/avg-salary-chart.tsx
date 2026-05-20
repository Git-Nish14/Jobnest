"use client";

import type { SourceSalary } from "@/types";

interface Props {
  data: SourceSalary[];
}

function formatK(n: number): string {
  if (n >= 1000) return `$${Math.round(n / 1000)}k`;
  return `$${n}`;
}

export function AvgSalaryChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="db-panel h-full flex flex-col">
        <h2 className="db-panel-title mb-4">Avg. Salary by Source</h2>
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          Add salary ranges to your applications to see this chart.
        </div>
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.avgSalary), 1);

  return (
    <div className="db-panel h-full flex flex-col">
      <div className="flex justify-between items-start mb-5">
        <h2 className="db-panel-title">Avg. Salary by Source</h2>
        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Midpoint</span>
      </div>

      <div className="flex flex-col gap-3 flex-1 justify-center">
        {data.slice(0, 6).map((row) => {
          const pct = Math.max(Math.round((row.avgSalary / max) * 100), 4);
          return (
            <div key={row.source}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-medium text-foreground truncate max-w-[55%]">{row.source}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-muted-foreground">{row.count} app{row.count !== 1 ? "s" : ""}</span>
                  <span className="text-xs font-semibold text-foreground w-10 text-right">{formatK(row.avgSalary)}</span>
                </div>
              </div>
              <svg width="100%" height="6" aria-hidden="true" className="rounded-full overflow-hidden">
                <rect x="0" y="0" width="100%" height="6" className="fill-[#dbc1b9]/30 dark:fill-white/10" />
                <rect x="0" y="0" width={`${pct}%`} height="6" rx="3" className="fill-emerald-500 dark:fill-emerald-400" />
              </svg>
            </div>
          );
        })}
      </div>
    </div>
  );
}
