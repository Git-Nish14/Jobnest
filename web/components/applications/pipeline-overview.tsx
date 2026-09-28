"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Activity, BriefcaseBusiness, MessageCircleMore, Trophy } from "lucide-react";
import type { ApplicationStats } from "@/types";
import { APPLICATION_STATUSES, type ApplicationStatus } from "@/config/constants";

const STATUS_DOTS: Record<ApplicationStatus, string> = {
  Applied: "bg-amber-400",
  "Phone Screen": "bg-orange-500",
  Interview: "bg-emerald-500",
  Offer: "bg-blue-500",
  Rejected: "bg-rose-500",
  Withdrawn: "bg-slate-400",
  Ghosted: "bg-zinc-400",
};

interface PipelineOverviewProps {
  stats: ApplicationStats;
}

export function PipelineOverview({ stats }: PipelineOverviewProps) {
  const searchParams = useSearchParams();
  const conversations =
    (stats.statusCounts["Phone Screen"] ?? 0) +
    (stats.statusCounts.Interview ?? 0);

  function statusHref(status?: ApplicationStatus) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    if (status) params.set("status", status); else params.delete("status");
    const query = params.toString();
    return `/applications${query ? `?${query}` : ""}`;
  }

  const metrics = [
    { label: "All applications", value: stats.total, icon: BriefcaseBusiness },
    { label: "Active pipeline", value: stats.active, icon: Activity },
    { label: "In conversation", value: conversations, icon: MessageCircleMore },
    { label: "Offers", value: stats.statusCounts.Offer ?? 0, icon: Trophy },
  ];

  return (
    <section
      aria-labelledby="pipeline-heading"
      className="mb-5 overflow-hidden rounded-3xl border border-[#dbc1b9]/45 bg-white shadow-[0_18px_50px_-34px_rgba(75,43,32,0.45)] dark:border-white/8 dark:bg-[#0b0b0b]"
    >
      <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[1.15fr_2fr] lg:items-center lg:p-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#99462a] dark:text-[#ccff00]">
            Your pipeline
          </p>
          <h2 id="pipeline-heading" className="db-headline mt-1.5 text-xl font-semibold text-foreground sm:text-2xl">
            Know where every opportunity stands.
          </h2>
          <p className="mt-1.5 max-w-md text-xs leading-relaxed text-muted-foreground sm:text-sm">
            Change a status directly on any application card. Every update saves instantly—no edit form required.
          </p>
        </div>

        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 sm:pb-0">
          {metrics.map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="min-w-34 flex-1 rounded-2xl border border-[#dbc1b9]/35 bg-[#faf9f7] px-3 py-3 dark:border-white/7 dark:bg-white/[0.035] sm:min-w-0"
            >
              <div className="flex items-center">
                <Icon className="h-3.5 w-3.5 text-[#99462a] dark:text-[#ccff00]" aria-hidden="true" />
              </div>
              <p className="mt-2 text-xl font-semibold tabular-nums text-foreground">{value}</p>
              <p className="mt-0.5 text-[10px] font-medium text-muted-foreground sm:text-[11px]">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-[#dbc1b9]/30 px-4 py-2.5 dark:border-white/6 sm:px-5 sm:py-3 lg:px-6">
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto" aria-label="Pipeline breakdown">
          {APPLICATION_STATUSES.map((status) => {
            const count = stats.statusCounts[status] ?? 0;
            return (
              <Link
                key={status}
                href={statusHref(status)}
                className="group inline-flex shrink-0 items-center gap-2 rounded-full px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOTS[status]}`} aria-hidden="true" />
                <span>{status}</span>
                <span className="rounded-full bg-muted px-1.5 py-0.5 font-semibold tabular-nums text-foreground transition-colors group-hover:bg-background">
                  {count}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
