import Link from "next/link";
import { Plus, FileText, Sparkles, Bell, BrainCircuit } from "lucide-react";
import { getApplications, getApplicationsPage } from "@/services";
import { ExportButton, ApplicationsList, ApplicationFilters, KanbanBoard, ViewToggle } from "@/components/applications";
import type { QueryParams } from "@/types/api";

const DATE_RANGES: QueryParams["dateRange"][] = ["all", "today", "week", "month", "quarter", "year"];
function toDateRange(val?: string): QueryParams["dateRange"] | undefined {
  return DATE_RANGES.includes(val as QueryParams["dateRange"])
    ? (val as QueryParams["dateRange"])
    : undefined;
}

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    search?: string;
    status?: string;
    location?: string;
    dateRange?: string;
    sort?: string;
    view?: string;
  }>;
}

export default async function ApplicationsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const view = params.view === "kanban" ? "kanban" : "list";

  // Kanban view needs all rows (drag-and-drop reorders all columns).
  // List view uses cursor pagination — first page only; ApplicationsList handles "load more".
  const isKanban = view === "kanban";

  let apps: import("@/types").JobApplication[] = [];
  let hasMore = false;
  let nextCursor: string | null = null;

  if (isKanban) {
    const { data: applications, error } = await getApplications({
      search: params.search,
      status: params.status,
      location: params.location,
      dateRange: toDateRange(params.dateRange),
      sort: params.sort,
    });
    if (error) console.error("Error fetching applications:", error.message);
    apps = applications ?? [];
  } else {
    const page = await getApplicationsPage({
      search: params.search,
      status: params.status,
      location: params.location,
      dateRange: toDateRange(params.dateRange),
    });
    if (page.error) console.error("Error fetching applications page:", page.error);
    apps = page.data;
    hasMore = page.hasMore;
    nextCursor = page.nextCursor;
  }

  return (
    <div>
      {/* ── Header ── */}
      <header className="db-page-header">
        <div>
          <h1 className="db-page-title">Applications</h1>
          <p className="db-page-subtitle">
            Manage and track your job applications with thoughtful intentionality.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ViewToggle />
          <ExportButton />
          <Link href="/applications/new" className="db-btn-page-primary">
            <Plus className="h-4 w-4" />
            New Application
          </Link>
        </div>
      </header>

      {/* ── Filters (list view only) ── */}
      {view === "list" && <ApplicationFilters />}

      {/* ── Content ── */}
      {apps.length > 0 ? (
        view === "kanban" ? (
          <KanbanBoard applications={apps} />
        ) : (
          <ApplicationsList
            applications={apps}
            hasMore={hasMore}
            nextCursor={nextCursor}
            filters={{
              search: params.search,
              status: params.status,
              location: params.location,
              dateRange: params.dateRange,
            }}
          />
        )
      ) : (
        /* Empty state — differentiate filtered vs brand-new user */
        params.search || params.status || params.location || params.dateRange ? (
          /* Filtered, no results */
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="h-14 w-14 rounded-xl bg-muted flex items-center justify-center mb-4">
              <FileText className="h-7 w-7 text-muted-foreground/50" />
            </div>
            <h3 className="db-headline text-xl font-semibold text-foreground mt-1">
              No applications match your filters
            </h3>
            <p className="text-muted-foreground text-sm mt-2 max-w-xs leading-relaxed">
              Try adjusting your search or clearing the filters to see all applications.
            </p>
            <Link href="/applications" className="db-btn-page-primary mt-6">
              Clear filters
            </Link>
          </div>
        ) : (
          /* Brand-new user — guided walkthrough */
          <div className="max-w-2xl mx-auto mt-8">
            {/* Hero */}
            <div className="text-center mb-10">
              <div className="h-16 w-16 rounded-2xl bg-[#99462a]/10 dark:bg-[#99462a]/20 flex items-center justify-center mx-auto mb-4">
                <FileText className="h-8 w-8 text-[#99462a]" />
              </div>
              <h2 className="db-headline text-2xl font-semibold text-foreground">
                Start your job search journey
              </h2>
              <p className="text-muted-foreground text-sm mt-2 max-w-sm mx-auto leading-relaxed">
                Track every application, stay organised, and land your next role faster.
              </p>
              <Link href="/applications/new" className="db-btn-page-primary mt-6 inline-flex">
                <Plus className="h-4 w-4" />
                Add your first application
              </Link>
            </div>

            {/* 3-step guide */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  icon: FileText,
                  step: "1",
                  title: "Log an application",
                  desc: "Add the company, role, status, and paste the job description for ATS scanning.",
                  href: "/applications/new",
                  cta: "Add application",
                },
                {
                  icon: BrainCircuit,
                  step: "2",
                  title: "Ask NESTAi anything",
                  desc: "Your AI job coach has full context on your search — ask it to tailor your resume or prep interview questions.",
                  href: "/nestai",
                  cta: "Open NESTAi",
                },
                {
                  icon: Bell,
                  step: "3",
                  title: "Set follow-up reminders",
                  desc: "Auto-reminders are created at Day 7, 14, and 21 — or add your own from the Reminders page.",
                  href: "/reminders",
                  cta: "View reminders",
                },
              ].map(({ icon: Icon, step, title, desc, href, cta }) => (
                <div
                  key={step}
                  className="db-content-card p-5 flex flex-col gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-[#99462a]/10 dark:bg-[#99462a]/20 flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4 text-[#99462a]" />
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Step {step}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{title}</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{desc}</p>
                  </div>
                  <Link
                    href={href}
                    className="mt-auto text-xs font-semibold text-[#99462a] dark:text-[#ccff00] hover:underline underline-offset-2 flex items-center gap-1"
                  >
                    {cta} →
                  </Link>
                </div>
              ))}
            </div>

            {/* Tips strip */}
            <div className="mt-6 rounded-xl border bg-muted/30 px-5 py-4 flex items-start gap-3">
              <Sparkles className="h-4 w-4 text-[#99462a] shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground">Pro tip:</span> paste the full job description when adding an application —
                it powers the ATS keyword scanner and gives NESTAi the context it needs to tailor your resume and prep interview questions.
              </p>
            </div>
          </div>
        )
      )}

      {/* ── Footer quote (list view only) ── */}
      {apps.length > 0 && view === "list" && (
        <footer className="mt-20 flex flex-col items-center text-center">
          <div className="w-12 h-px bg-[#dbc1b9]/30 mb-6" />
          <p className="db-headline italic text-muted-foreground/50 text-sm mb-1">
            Refining the search for meaningful contribution.
          </p>
        </footer>
      )}
    </div>
  );
}
