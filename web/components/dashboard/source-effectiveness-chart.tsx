"use client";

import type { SourceEffectiveness } from "@/types";

interface Props {
  data: SourceEffectiveness[];
}

export function SourceEffectivenessChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="db-panel h-full flex flex-col">
        <h2 className="db-panel-title mb-4">Source Effectiveness</h2>
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          Apply from at least 2 sources to see response rates.
        </div>
      </div>
    );
  }

  return (
    <div className="db-panel h-full flex flex-col">
      <div className="flex justify-between items-start mb-5">
        <h2 className="db-panel-title">Source Effectiveness</h2>
        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Response rate</span>
      </div>

      <div className="flex flex-col gap-3 flex-1">
        {data.map((row) => (
          <div key={row.source}>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-medium text-foreground truncate max-w-[60%]">{row.source}</span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] text-muted-foreground">{row.responded}/{row.total}</span>
                <span className="text-xs font-semibold text-foreground w-9 text-right">{row.responseRate}%</span>
              </div>
            </div>
            {/* SVG avoids inline style — width attr is an SVG presentation attribute */}
            <svg width="100%" height="6" aria-hidden="true" className="rounded-full overflow-hidden">
              <rect x="0" y="0" width="100%" height="6" className="fill-[#dbc1b9]/30 dark:fill-white/10" />
              <rect x="0" y="0" width={`${row.responseRate}%`} height="6" rx="3" className="fill-[#99462a] dark:fill-[#ccff00]" />
            </svg>
          </div>
        ))}
      </div>
    </div>
  );
}
