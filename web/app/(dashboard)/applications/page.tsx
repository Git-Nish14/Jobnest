import Link from "next/link";
import { Plus, FileText } from "lucide-react";
import { getApplications } from "@/services";
import { ExportButton, ApplicationCard, ApplicationFilters, KanbanBoard, ViewToggle } from "@/components/applications";
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

  const { data: applications, error } = await getApplications({
    search: params.search,
    status: params.status,
    location: params.location,
    dateRange: toDateRange(params.dateRange),
    sort: params.sort,
  });

  if (error) {
    console.error("Error fetching applications:", error.message);
  }

  const apps = applications ?? [];

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
          <div className="space-y-4">
            {apps.map((app) => (
              <ApplicationCard key={app.id} application={app} />
            ))}
          </div>
        )
      ) : (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="h-14 w-14 rounded-xl bg-[#f4f3f1] flex items-center justify-center mb-4">
            <FileText className="h-7 w-7 text-[#55433d]/50" />
          </div>
          <h3 className="db-headline text-xl font-semibold text-[#1a1c1b] mt-1">
            No applications yet
          </h3>
          <p className="text-[#55433d] text-sm mt-2 max-w-xs leading-relaxed">
            Start tracking your job search by logging your first application.
          </p>
          <Link href="/applications/new" className="db-btn-page-primary mt-6">
            <Plus className="h-4 w-4" />
            Add Your First Application
          </Link>
        </div>
      )}

      {/* ── Footer quote (list view only) ── */}
      {apps.length > 0 && view === "list" && (
        <footer className="mt-20 flex flex-col items-center text-center">
          <div className="w-12 h-px bg-[#dbc1b9]/30 mb-6" />
          <p className="db-headline italic text-[#55433d]/50 text-sm mb-1">
            Refining the search for meaningful contribution.
          </p>
        </footer>
      )}
    </div>
  );
}
