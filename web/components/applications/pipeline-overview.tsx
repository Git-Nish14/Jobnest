import { Activity, CalendarDays, CalendarPlus, MessageCircleMore } from "lucide-react";
import type { ApplicationStats } from "@/types";

interface PipelineOverviewProps {
  stats: ApplicationStats;
}

export function PipelineOverview({ stats }: PipelineOverviewProps) {
  const conversations =
    (stats.statusCounts["Phone Screen"] ?? 0) +
    (stats.statusCounts.Interview ?? 0);

  const metrics = [
    { label: "Added this week", value: stats.thisWeek, icon: CalendarPlus },
    { label: "Added this month", value: stats.thisMonth, icon: CalendarDays },
    { label: "Active pipeline", value: stats.active, icon: Activity },
    { label: "In conversation", value: conversations, icon: MessageCircleMore },
  ];

  return (
    <section
      aria-labelledby="pipeline-heading"
      className="application-pipeline-overview mb-4 overflow-hidden rounded-2xl border border-[#dbc1b9]/45 bg-white shadow-[0_18px_50px_-34px_rgba(75,43,32,0.45)] dark:border-white/8 dark:bg-[#0b0b0b] sm:mb-5 sm:rounded-3xl"
    >
      <div className="grid gap-3 p-3.5 sm:gap-5 sm:p-5 lg:grid-cols-[1.15fr_2fr] lg:items-center lg:p-6">
        <div className="hidden sm:block">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#99462a] dark:text-[#ccff00]">
            Search momentum
          </p>
          <h2 id="pipeline-heading" className="db-headline mt-1.5 text-xl font-semibold text-foreground sm:text-2xl">
            Know what is moving.
          </h2>
          <p className="mt-1.5 max-w-md text-xs leading-relaxed text-muted-foreground sm:text-sm">
            Change a status directly on any application card. Every update saves instantly—no edit form required.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-1.5 sm:mx-0 sm:grid-cols-4 sm:gap-2 sm:px-0 sm:pb-0">
          {metrics.map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className={`min-w-0 rounded-xl border border-[#dbc1b9]/35 bg-[#faf9f7] px-1.5 py-2.5 text-center dark:border-white/7 dark:bg-white/[0.035] sm:rounded-2xl sm:px-3 sm:py-3 sm:text-left ${label === "Added this month" ? "hidden sm:block" : ""}`}
            >
              <div className="hidden items-center sm:flex">
                <Icon className="h-3.5 w-3.5 text-[#99462a] dark:text-[#ccff00]" aria-hidden="true" />
              </div>
              <p className="text-lg font-semibold tabular-nums text-foreground sm:mt-2 sm:text-xl">{value}</p>
              <p className="mt-0.5 text-[10px] font-medium leading-tight text-muted-foreground sm:text-[11px]">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
