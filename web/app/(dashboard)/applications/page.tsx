import Link from "next/link";
import { Plus, FileText } from "lucide-react";
import { getApplications } from "@/services";
import { Button } from "@/components/ui";
import { ApplicationCard, ApplicationFilters } from "@/components/applications";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    search?: string;
    status?: string;
  }>;
}

export default async function ApplicationsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { data: applications, error } = await getApplications({
    search: params.search,
    status: params.status,
  });

  if (error) {
    console.error("Error fetching applications:", error.message);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Applications</h1>
          <p className="text-muted-foreground">
            Manage and track your job applications
          </p>
        </div>
        <Link href="/applications/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Application
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <ApplicationFilters />

      {/* Applications List */}
      <div className="space-y-4">
        {applications && applications.length > 0 ? (
          applications.map((app) => (
            <ApplicationCard key={app.id} application={app} />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">No applications yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Start tracking your job applications by adding your first one.
            </p>
            <Link href="/applications/new" className="mt-6">
              <Button className="gap-2">
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
