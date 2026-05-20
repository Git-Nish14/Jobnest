"use client";

import type { StageFunnel } from "@/types";

interface Props {
  data: StageFunnel[];
}

const STAGE_COLOURS = [
  "fill-[#99462a] dark:fill-[#ccff00]",
  "fill-[#b85a36] dark:fill-[#b8e600]",
  "fill-[#cc7a5a] dark:fill-[#99cc00]",
  "fill-[#e0a88a] dark:fill-[#779900]",
  "fill-[#f0ccb8] dark:fill-[#556600]",
];

export function StageFunnelChart({ data }: Props) {
  const top = data[0]?.count ?? 0;

  if (top === 0) {
    return (
      <div className="db-panel h-full flex flex-col">
        <h2 className="db-panel-title mb-4">Application Funnel</h2>
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          Add applications to see your funnel.
        </div>
      </div>
    );
  }

  return (
    <div className="db-panel h-full flex flex-col">
      <h2 className="db-panel-title mb-5">Application Funnel</h2>

      <div className="flex flex-col gap-2 flex-1 justify-center">
        {data.map((item, i) => {
          const pct = top > 0 ? Math.max(Math.round((item.count / top) * 100), item.count > 0 ? 4 : 0) : 0;
          return (
            <div key={item.stage} className="flex items-center gap-3">
              <span className="text-[11px] text-muted-foreground w-24 shrink-0 text-right">{item.stage}</span>
              <div className="flex-1 h-6 rounded-md overflow-hidden bg-[#dbc1b9]/20 dark:bg-white/5 relative">
                <svg width={`${pct}%`} height="100%" aria-hidden="true" className="rounded-md overflow-hidden">
                  <rect x="0" y="0" width="100%" height="100%" className={STAGE_COLOURS[i] ?? STAGE_COLOURS[4]} />
                </svg>
              </div>
              <span className="text-xs font-semibold text-foreground w-6 shrink-0">{item.count}</span>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-muted-foreground mt-4">
        Counts include all apps at or past each stage
      </p>
    </div>
  );
}
