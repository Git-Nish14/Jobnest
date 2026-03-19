import Link from "next/link";
import { Plus, FileText } from "lucide-react";
import { getApplications } from "@/services";
import { Button } from "@/components/ui";
import { ApplicationCard, ApplicationFilters, ExportButton } from "@/components/applications";
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
  }>;
}

export default async function ApplicationsPage({ searchParams }: PageProps) {
  const params = await searchParams;
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

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Applications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage and track your job applications
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <ExportButton />
          <Link href="/applications/new" className="flex-1 sm:flex-none">
            <Button className="gap-2 w-full sm:w-auto shadow-sm">
              <Plus className="h-4 w-4" />
              New Application
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <ApplicationFilters />

      {/* Applications List */}
      <div className="space-y-3 sm:space-y-4">
        {applications && applications.length > 0 ? (
          applications.map((app) => (
            <ApplicationCard key={app.id} application={app} />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-white py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted">
              <FileText className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-base font-semibold">No applications yet</h3>
            <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
              Start tracking your job search by logging your first application.
            </p>
            <Link href="/applications/new" className="mt-6">
              <Button className="gap-2 shadow-sm">
                <Plus className="h-4 w-4" />
                Add Your First Application
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
