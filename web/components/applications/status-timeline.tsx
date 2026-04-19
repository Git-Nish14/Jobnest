import { GitCommitHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActivityLog } from "@/types";

interface Props {
  activities: ActivityLog[];
  appliedDate: string;    // ISO date string from job_applications.applied_date
  currentStatus: string;
}

interface Stage {
  status: string;
  enteredAt: Date;
  exitedAt: Date | null;
  daysSpent: number;
  isCurrent: boolean;
  isTerminal: boolean;
}

// ── Status presentation tokens ────────────────────────────────────────────────

const STATUS_META: Record<string, { dot: string; badge: string }> = {
  Applied:        { dot: "bg-amber-400",         badge: "bg-amber-50   text-amber-700   dark:bg-amber-950/40  dark:text-amber-300"  },
  "Phone Screen": { dot: "bg-[#99462a]",          badge: "bg-[#ffdbd0]/40 text-[#99462a] dark:bg-[#99462a]/20 dark:text-[#ccff00]" },
  "In Review":    { dot: "bg-[#d97757]",          badge: "bg-orange-50  text-orange-700  dark:bg-orange-950/30 dark:text-orange-300" },
  Interview:      { dot: "bg-[#006d34]",          badge: "bg-emerald-50 text-[#006d34]   dark:bg-emerald-950/30 dark:text-emerald-300" },
  Offer:          { dot: "bg-[#006d34]",          badge: "bg-emerald-50 text-[#006d34]   dark:bg-emerald-950/30 dark:text-emerald-300" },
  Accepted:       { dot: "bg-[#40a45f]",          badge: "bg-emerald-50 text-[#40a45f]   dark:bg-emerald-950/30 dark:text-emerald-300" },
  Rejected:       { dot: "bg-[#ba1a1a]",          badge: "bg-red-50    text-[#ba1a1a]   dark:bg-red-950/30    dark:text-red-300"    },
  Withdrawn:      { dot: "bg-muted-foreground",   badge: "bg-muted     text-muted-foreground"                                       },
  Ghosted:        { dot: "bg-zinc-400",            badge: "bg-zinc-100  text-zinc-600    dark:bg-zinc-800/40   dark:text-zinc-400"   },
};

const TERMINAL = new Set(["Offer", "Accepted", "Rejected", "Withdrawn", "Ghosted"]);

function getMeta(status: string) {
  return STATUS_META[status] ?? { dot: "bg-border", badge: "bg-muted text-muted-foreground" };
}

// ── Timeline builder ──────────────────────────────────────────────────────────

/** Exported for unit testing. Not part of the public component API. */
export function buildStages(activities: ActivityLog[], appliedDate: string): Stage[] {
  // Activities arrive newest-first from the service; reverse to get chronological order.
  const chronological = [...activities].reverse();

  const stages: Stage[] = [];
  const now = new Date();

  // Seed with the Applied stage using the user-entered applied_date as the anchor.
  // We use noon UTC to avoid day-boundary issues from timezone offsets.
  stages.push({
    status: "Applied",
    enteredAt: new Date(`${appliedDate}T12:00:00Z`),
    exitedAt: null,
    daysSpent: 0,
    isCurrent: true,
    isTerminal: false,
  });

  for (const log of chronological) {
    if (log.activity_type !== "Status Changed") continue;

    const meta = log.metadata as { new_status?: string };
    const newStatus = meta?.new_status;
    if (!newStatus) continue;

    // Close the current last stage
    const exitedAt = new Date(log.created_at);
    const last = stages[stages.length - 1];
    last.exitedAt = exitedAt;
    last.isCurrent = false;
    last.daysSpent = Math.max(
      0,
      Math.floor((exitedAt.getTime() - last.enteredAt.getTime()) / 86_400_000)
    );

    // Open the new stage
    stages.push({
      status: newStatus,
      enteredAt: exitedAt,
      exitedAt: null,
      daysSpent: Math.floor((now.getTime() - exitedAt.getTime()) / 86_400_000),
      isCurrent: true,
      isTerminal: TERMINAL.has(newStatus),
    });
  }

  return stages;
}

// ── Format helpers ────────────────────────────────────────────────────────────

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function dayLabel(n: number, isCurrent: boolean, isTerminal: boolean): string {
  if (n === 0) return isCurrent ? "Today" : "Same day";
  if (isCurrent && !isTerminal) return `${n}d ongoing`;
  return `${n}d`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function StatusTimeline({ activities, appliedDate, currentStatus }: Props) {
  // Guard: applied_date is required but be defensive against empty/malformed values.
  // new Date("T12:00:00Z") or new Date("undefinedT12:00:00Z") both produce NaN,
  // which would render "NaNd" in the UI. Bail out silently instead.
  if (!appliedDate || isNaN(new Date(`${appliedDate}T12:00:00Z`).getTime())) return null;

  const stages = buildStages(activities, appliedDate);

  // If we have only the Applied seed and the current status is still Applied
  // there's nothing interesting to show yet — omit the section entirely.
  // We still render it when there's been at least one status change.
  if (stages.length < 2 && currentStatus === "Applied") return null;

  return (
    <section className="db-content-card">
      <h2 className="db-headline text-xl font-semibold text-foreground flex items-center gap-2 mb-6">
        <GitCommitHorizontal className="h-5 w-5 text-[#99462a] dark:text-[#ccff00]" />
        Status Journey
      </h2>

      {/* ── Desktop: horizontal stepper ── */}
      <div className="hidden sm:block overflow-x-auto pb-2">
        <div className="flex items-start min-w-max gap-0">
          {stages.map((stage, i) => {
            const { dot, badge } = getMeta(stage.status);
            const isLast = i === stages.length - 1;

            return (
              <div key={i} className="flex items-start">
                {/* Stage node */}
                <div className="flex flex-col items-center gap-2 w-32">
                  {/* Dot */}
                  <div className="relative flex items-center justify-center">
                    <div className={cn(
                      "w-3 h-3 rounded-full shrink-0 ring-4 ring-background",
                      dot,
                      stage.isCurrent && "ring-[#99462a]/20 dark:ring-[#ccff00]/20"
                    )} />
                  </div>

                  {/* Status badge */}
                  <span className={cn(
                    "text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap",
                    badge
                  )}>
                    {stage.status}
                  </span>

                  {/* Date */}
                  <span className="text-[10px] text-muted-foreground">
                    {fmtDate(stage.enteredAt)}
                  </span>

                  {/* Days spent */}
                  <span className={cn(
                    "text-[10px] tabular-nums font-medium",
                    stage.isCurrent && !stage.isTerminal
                      ? "text-[#99462a] dark:text-[#ccff00]"
                      : "text-muted-foreground"
                  )}>
                    {dayLabel(stage.daysSpent, stage.isCurrent, stage.isTerminal)}
                  </span>
                </div>

                {/* Connector line between stages */}
                {!isLast && (
                  <div className="mt-1.5 flex-1 h-px w-12 bg-border mx-1 shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Mobile: vertical stack ── */}
      <div className="sm:hidden relative space-y-0">
        {/* Vertical guide line */}
        <div className="absolute left-2.25 top-3 bottom-3 w-px bg-border" />

        {stages.map((stage, i) => {
          const { dot, badge } = getMeta(stage.status);
          const isLast = i === stages.length - 1;

          return (
            <div key={i} className={cn("relative flex items-start gap-3", !isLast && "pb-5")}>
              {/* Dot */}
              <div className={cn(
                "mt-0.5 w-4.5 h-4.5 rounded-full shrink-0 flex items-center justify-center z-10",
                "ring-4 ring-background",
                dot
              )} />

              {/* Content */}
              <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                <div>
                  <span className={cn(
                    "text-[11px] font-semibold px-2 py-0.5 rounded-full",
                    badge
                  )}>
                    {stage.status}
                  </span>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {fmtDate(stage.enteredAt)}
                  </p>
                </div>
                <span className={cn(
                  "text-[10px] tabular-nums font-medium shrink-0",
                  stage.isCurrent && !stage.isTerminal
                    ? "text-[#99462a] dark:text-[#ccff00]"
                    : "text-muted-foreground"
                )}>
                  {dayLabel(stage.daysSpent, stage.isCurrent, stage.isTerminal)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Total days in search */}
      {stages.length >= 2 && (
        <p className="mt-5 pt-4 border-t text-xs text-muted-foreground">
          Total time in search:{" "}
          <span className="font-semibold text-foreground">
            {Math.floor(
              (new Date().getTime() - new Date(`${appliedDate}T12:00:00Z`).getTime()) / 86_400_000
            )}d
          </span>
        </p>
      )}
    </section>
  );
}
