import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  CalendarClock,
  ChevronRight,
  ClipboardList,
  FilePlus2,
  ScanSearch,
  Sparkles,
  Target,
} from "lucide-react";
import type { JobApplication } from "@/types";
import { formatDate } from "@/lib/utils/date";

interface MobileJobSearchHomeProps {
  firstName: string;
  totalApplications: number;
  thisWeek: number;
  activeCount: number;
  upcomingCount: number;
  pendingCount: number;
  responseRate: number;
  nextInterviewLabel: string | null;
  recentApplications: JobApplication[];
}

function statusTone(status: string) {
  if (status === "Interview" || status === "In Review") {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/12 dark:text-emerald-300";
  }
  if (status === "Phone Screen") {
    return "bg-orange-100 text-orange-800 dark:bg-orange-400/12 dark:text-orange-300";
  }
  if (status === "Offer" || status === "Accepted") {
    return "bg-blue-100 text-blue-800 dark:bg-blue-400/12 dark:text-blue-300";
  }
  return "bg-black/5 text-muted-foreground dark:bg-white/8 dark:text-white/60";
}

export function MobileJobSearchHome({
  firstName,
  totalApplications,
  thisWeek,
  activeCount,
  upcomingCount,
  pendingCount,
  responseRate,
  nextInterviewLabel,
  recentApplications,
}: MobileJobSearchHomeProps) {
  const hasPipeline = totalApplications > 0;
  const priorityCopy = upcomingCount > 0
    ? nextInterviewLabel ?? `${upcomingCount} interviews are coming up`
    : activeCount > 0
      ? `${activeCount} active application${activeCount === 1 ? "" : "s"} need your attention`
      : "Add a role to start building your search pipeline";

  return (
    <div className="mobile-dashboard md:hidden">
      <header className="mb-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#99462a] dark:text-[#ccff00]">
          Your job search
        </p>
        <h1 className="db-headline mt-1 text-[2rem] leading-tight text-foreground">
          Hi {firstName}, what&apos;s next?
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Focus on the next useful move, not another spreadsheet.
        </p>
      </header>

      <section className="mobile-focus-card" aria-labelledby="mobile-focus-heading">
        <div className="flex items-start gap-3">
          <div className="mobile-focus-icon" aria-hidden="true">
            {upcomingCount > 0 ? <CalendarClock className="h-5 w-5" /> : <Target className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#99462a]/75 dark:text-[#ccff00]/75">
              Best next move
            </p>
            <h2 id="mobile-focus-heading" className="mt-1 text-base font-semibold leading-snug text-foreground">
              {priorityCopy}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {upcomingCount > 0
                ? "Review the role and prepare your strongest stories before the conversation."
                : activeCount > 0
                  ? "Open your pipeline, update stale statuses, and send any due follow-ups."
                  : "Capture the posting now so reminders, ATS insights, and prep stay connected."}
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link href={upcomingCount > 0 ? "/interviews" : "/applications"} className="mobile-primary-action">
            {upcomingCount > 0 ? "Prepare now" : "Open pipeline"}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/applications/new" className="mobile-secondary-action">
            <FilePlus2 className="h-4 w-4" />
            Add role
          </Link>
        </div>
      </section>

      <section className="mt-4" aria-label="Job search summary">
        <div className="grid grid-cols-3 gap-2">
          <div className="mobile-metric-card">
            <strong>{activeCount}</strong>
            <span>Active</span>
          </div>
          <div className="mobile-metric-card">
            <strong>{thisWeek}</strong>
            <span>This week</span>
          </div>
          <div className="mobile-metric-card">
            <strong>{Math.round(responseRate)}%</strong>
            <span>Response</span>
          </div>
        </div>
      </section>

      <section className="mt-6" aria-labelledby="mobile-actions-heading">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Today</p>
            <h2 id="mobile-actions-heading" className="db-headline mt-0.5 text-2xl text-foreground">Stay moving</h2>
          </div>
          {pendingCount > 0 && (
            <Link href="/reminders" className="text-xs font-semibold text-[#99462a] dark:text-[#ccff00]">
              {pendingCount} reminder{pendingCount === 1 ? "" : "s"}
            </Link>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Link href="/reminders" className="mobile-quick-action">
            <BellRing className="h-5 w-5" />
            <span>Follow ups</span>
          </Link>
          <Link href="/ats" className="mobile-quick-action">
            <ScanSearch className="h-5 w-5" />
            <span>ATS match</span>
          </Link>
          <Link href="/nestai" className="mobile-quick-action">
            <Sparkles className="h-5 w-5" />
            <span>Ask NESTAi</span>
          </Link>
        </div>
      </section>

      <section className="mt-7" aria-labelledby="mobile-pipeline-heading">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Pipeline</p>
            <h2 id="mobile-pipeline-heading" className="db-headline mt-0.5 text-2xl text-foreground">
              Recent roles
            </h2>
          </div>
          {hasPipeline && (
            <Link href="/applications" className="inline-flex items-center gap-0.5 text-xs font-semibold text-[#99462a] dark:text-[#ccff00]">
              See all <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>

        {recentApplications.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#dbc1b9] bg-white/60 px-5 py-7 text-center dark:border-white/12 dark:bg-white/[0.025]">
            <ClipboardList className="mx-auto h-6 w-6 text-[#99462a] dark:text-[#ccff00]" />
            <p className="mt-2 text-sm font-semibold text-foreground">Your pipeline starts here</p>
            <p className="mx-auto mt-1 max-w-64 text-xs leading-relaxed text-muted-foreground">
              Save your first role and Jobnest will keep the timeline, documents, and follow-ups together.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentApplications.slice(0, 4).map((application) => (
              <article key={application.id} className="mobile-pipeline-row">
                <div className="mobile-company-mark" aria-hidden="true">
                  {application.company.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1 py-0.5">
                  <Link href={`/applications/${application.id}`} className="block min-w-0">
                    <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">{application.position}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {application.company} · {formatDate(application.applied_date)}
                    </p>
                  </Link>
                  <span className={`mt-2 inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${statusTone(application.status)}`}>
                    {application.status}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

    </div>
  );
}
