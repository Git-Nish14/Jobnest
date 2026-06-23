"use client";

import type { StageFunnel } from "@/types";

interface Props {
  data: StageFunnel[];
}

// Applied → Phone Screen → Interview → Offer → Accepted: warm amber fading to emerald
const STAGE_COLOURS = [
  "fill-amber-500   dark:fill-amber-400",
  "fill-orange-500  dark:fill-orange-400",
  "fill-[#99462a]   dark:fill-[#cc7a5a]",
  "fill-emerald-600 dark:fill-emerald-400",
  "fill-emerald-700 dark:fill-emerald-300",
];

// Entry-level SWE industry benchmarks (Levels.fyi / LinkedIn Salary 2025-2026)
const BENCHMARKS: Record<string, number> = {
  "Applied → Phone Screen":   18,
  "Phone Screen → Interview": 42,
  "Interview → Offer":        22,
  "Offer → Accepted":         88,
};

const TRANSITION_LABELS = [
  "Applied → Phone Screen",
  "Phone Screen → Interview",
  "Interview → Offer",
  "Offer → Accepted",
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
      <div className="flex items-start justify-between mb-5">
        <h2 className="db-panel-title">Application Funnel</h2>
        <span className="text-[10px] text-muted-foreground/60 font-medium uppercase tracking-widest mt-0.5">
          vs. Industry avg
        </span>
      </div>

      <div className="flex flex-col gap-1.5 flex-1 justify-center">
        {data.map((item, i) => {
          const pct = top > 0
            ? Math.max(Math.round((item.count / top) * 100), item.count > 0 ? 4 : 0)
            : 0;

          // Conversion rate to the next stage
          const nextCount = data[i + 1]?.count ?? null;
          const convRate = nextCount != null && item.count > 0
            ? Math.round((nextCount / item.count) * 100)
            : null;
          const benchLabel = TRANSITION_LABELS[i];
          const benchmark = benchLabel ? BENCHMARKS[benchLabel] : null;

          return (
            <div key={item.stage}>
              {/* Stage bar row */}
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-muted-foreground w-24 shrink-0 text-right leading-tight">
                  {item.stage}
                </span>
                <div className="flex-1 h-6 rounded-md overflow-hidden bg-[#dbc1b9]/20 dark:bg-white/5">
                  <svg width={`${pct}%`} height="100%" aria-hidden="true" className="rounded-md overflow-hidden">
                    <rect x="0" y="0" width="100%" height="100%"
                      className={STAGE_COLOURS[i] ?? STAGE_COLOURS[4]} />
                  </svg>
                </div>
                <span className="text-xs font-semibold text-foreground w-6 shrink-0 tabular-nums">
                  {item.count}
                </span>
              </div>

              {/* Conversion arrow row — only between stages */}
              {convRate !== null && (
                <div className="flex items-center gap-3 my-0.5">
                  <span className="w-24 shrink-0" />
                  <div className="flex-1 flex items-center gap-2 pl-1">
                    <span className="text-[10px] text-muted-foreground/50">↓</span>
                    <span className={`text-[10px] font-semibold tabular-nums ${
                      benchmark == null ? "text-muted-foreground" :
                      convRate >= benchmark ? "text-emerald-600 dark:text-emerald-400" :
                      convRate >= benchmark * 0.7 ? "text-amber-600 dark:text-amber-400" :
                      "text-red-500 dark:text-red-400"
                    }`}>
                      {convRate}%
                    </span>
                    {benchmark != null && (
                      <span className="text-[10px] text-muted-foreground/50">
                        · avg {benchmark}%
                      </span>
                    )}
                  </div>
                  <span className="w-6 shrink-0" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-muted-foreground mt-3 leading-relaxed">
        Counts include all apps at or past each stage · Conversion coloured vs. entry-level SWE industry average
      </p>
    </div>
  );
}
