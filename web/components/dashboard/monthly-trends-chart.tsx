"use client";

import type { MonthlyTrend } from "@/types";

interface Props { data: MonthlyTrend[] }

const CHART_H = 160;

const SERIES = [
  { key: "count",      label: "Applied",   fill: "fill-[#99462a] dark:fill-[#ccff00]",        opacity: "opacity-90" },
  { key: "rejections", label: "Rejected",  fill: "fill-[#c8c6c3] dark:fill-white/20",          opacity: "opacity-80" },
  { key: "offers",     label: "Offers",    fill: "fill-emerald-500 dark:fill-emerald-400",      opacity: "opacity-90" },
] as const;

export function MonthlyTrendsChart({ data }: Props) {
  if (!data.length) return null;

  const maxVal = Math.max(...data.flatMap((d) => [d.count, d.rejections, d.offers]), 1);
  const barW   = 8;  // px per individual bar inside each month group
  const gap    = 2;  // px between bars in a group
  const groupW = SERIES.length * barW + (SERIES.length - 1) * gap;

  const svgW = data.length * (groupW + 12); // 12px gap between month groups

  return (
    <div className="db-panel h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h2 className="db-panel-title">Monthly Breakdown</h2>
        <div className="flex items-center gap-4">
          {SERIES.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5">
              <svg width="10" height="10" aria-hidden="true">
                <rect x="0" y="0" width="10" height="10" rx="2" className={s.fill} />
              </svg>
              <span className="text-[10px] text-muted-foreground font-medium">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-x-auto">
        <svg
          width={Math.max(svgW, 320)}
          height={CHART_H + 24}
          aria-label="Monthly application trends"
          role="img"
          className="w-full"
          viewBox={`0 0 ${Math.max(svgW, 320)} ${CHART_H + 24}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {data.map((month, gi) => {
            const groupX = gi * (groupW + 12) + 6;
            return (
              <g key={gi}>
                {SERIES.map((s, si) => {
                  const val  = month[s.key] as number;
                  const barH = Math.max(Math.round((val / maxVal) * CHART_H * 0.92), val > 0 ? 4 : 0);
                  const x    = groupX + si * (barW + gap);
                  const y    = CHART_H - barH;
                  return (
                    <g key={s.key} className="group">
                      <title>{`${month.month} — ${s.label}: ${val}`}</title>
                      <rect
                        x={x} y={y} width={barW} height={barH}
                        rx="2"
                        className={`${s.fill} ${s.opacity} transition-opacity hover:opacity-100`}
                      />
                    </g>
                  );
                })}
                {/* Month label */}
                <text
                  x={groupX + groupW / 2}
                  y={CHART_H + 16}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[9px] font-semibold uppercase tracking-wide"
                  fontSize="9"
                >
                  {month.month}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
