import Link from "next/link";
import type { StatusCount } from "@/types";

interface AtelierStatusChartProps {
  data: StatusCount[];
  total: number;
}

// Status pipeline colours — original Atelier warm palette (light mode)
const STATUS_META: Record<string, { color: string; label: string }> = {
  Applied:        { color: "#dbc1b9", label: "Applied" },
  "Phone Screen": { color: "#88726c", label: "Phone Screen" },
  "In Review":    { color: "#d97757", label: "In Review" },
  Interview:      { color: "#99462a", label: "Interviewing" },
  Offer:          { color: "#006d34", label: "Offer Received" },
  Accepted:       { color: "#40a45f", label: "Accepted" },
  Rejected:       { color: "#ba1a1a", label: "Rejected" },
  Withdrawn:      { color: "#c8c6c3", label: "Withdrawn" },
};

function getMeta(status: string) {
  return STATUS_META[status] ?? { color: "#6b7280", label: status };
}

export function AtelierStatusChart({ data, total }: AtelierStatusChartProps) {
  const active = data.filter((d) => d.count > 0);

  const inProgress = data
    .filter((d) => ["Applied", "Phone Screen", "In Review", "Interview"].includes(d.status))
    .reduce((s, d) => s + d.count, 0);
  const offers = data
    .filter((d) => ["Offer", "Accepted"].includes(d.status))
    .reduce((s, d) => s + d.count, 0);
  const responseCount = data
    .filter((d) => ["Phone Screen", "In Review", "Interview", "Offer", "Accepted", "Rejected"].includes(d.status))
    .reduce((s, d) => s + d.count, 0);
  const responseRate = total > 0 ? Math.round((responseCount / total) * 100) : 0;

  if (total === 0 || active.length === 0) {
    return (
      <div className="db-panel h-full flex flex-col">
        <h2 className="db-panel-title mb-1">Application Pipeline</h2>
        <p className="text-xs text-muted-foreground mb-6">Track your progress through each stage</p>
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
          <p className="text-muted-foreground text-sm">No applications yet.</p>
          <Link href="/applications/new" className="db-btn-primary">Add first application</Link>
        </div>
      </div>
    );
  }

  const segments = active.reduce<
    Array<StatusCount & { pct: number; start: number; color: string; label: string }>
  >((acc, item) => {
    const start = acc.length === 0 ? 0 : acc[acc.length - 1].start + acc[acc.length - 1].pct;
    const meta = getMeta(item.status);
    return [...acc, { ...item, pct: (item.count / total) * 100, start, ...meta }];
  }, []);

  const gradient = segments
    .map((s) => `${s.color} ${s.start.toFixed(1)}% ${(s.start + s.pct).toFixed(1)}%`)
    .join(", ");

  return (
    <div className="db-panel h-full flex flex-col gap-5">
      <div>
        <h2 className="db-panel-title">Application Pipeline</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Your progress through each hiring stage</p>
      </div>

      {/* Donut + key metrics */}
      <div className="flex items-center gap-5">
        <div className="relative shrink-0">
          <div
            className="w-24 h-24 rounded-full"
            style={{ background: `conic-gradient(${gradient})` }}
          />
          {/* Hole — matches the panel surface color */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="w-14 h-14 rounded-full flex flex-col items-center justify-center"
              style={{ backgroundColor: "var(--atelier-surface)" }}
            >
              <span className="text-base font-bold text-foreground leading-none">{total}</span>
              <span className="text-[9px] text-muted-foreground uppercase tracking-wide font-semibold">total</span>
            </div>
          </div>
        </div>

        {/* Funnel KPIs */}
        <div className="flex-1 space-y-2.5 min-w-0">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Response rate</span>
            <span className="text-xs font-bold text-primary">{responseRate}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary" style={{ width: `${responseRate}%` }} />
          </div>
          <div className="flex justify-between items-baseline pt-1">
            <div className="text-center">
              <p className="text-base font-bold text-foreground">{inProgress}</p>
              <p className="text-[10px] text-muted-foreground">In progress</p>
            </div>
            <div className="text-center">
              <p className="text-base font-bold text-[#34d399]">{offers}</p>
              <p className="text-[10px] text-muted-foreground">Offer{offers !== 1 ? "s" : ""}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="space-y-2 flex-1">
        {segments.map((s) => (
          <div key={s.status} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-xs text-muted-foreground flex-1 truncate">{s.label}</span>
            <span className="text-xs font-semibold text-foreground shrink-0 tabular-nums">{s.count}</span>
            <span className="text-[10px] text-muted-foreground w-8 text-right shrink-0">{s.pct.toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
