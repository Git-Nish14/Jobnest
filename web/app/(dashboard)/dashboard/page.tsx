import Link from "next/link";
import {
  FileText,
  Calendar,
  TrendingUp,
  Zap,
  Plus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/Button";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { RecentApplications } from "@/components/dashboard/RecentApplications";
import { StatusBreakdown } from "@/components/dashboard/StatusBreakdown";
import { ApplicationStatus, JobApplication } from "@/lib/types/database";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: applications } = await supabase
    .from("job_applications")
    .select("*")
    .order("applied_date", { ascending: false });

  const allApps = (applications || []) as JobApplication[];

  // Calculate stats
  const total = allApps.length;

  // Applications this week
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const thisWeek = allApps.filter(
    (app) => new Date(app.applied_date) >= startOfWeek
  ).length;

  // Applications this month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const thisMonth = allApps.filter(
    (app) => new Date(app.applied_date) >= startOfMonth
  ).length;

  // Count by status
  const statusCounts = allApps.reduce(
    (acc, app) => {
      acc[app.status] = (acc[app.status] || 0) + 1;
      return acc;
    },
    {} as Record<ApplicationStatus, number>
  );

  // Active applications (not rejected or offered)
  const activeCount =
    (statusCounts["Applied"] || 0) +
    (statusCounts["Phone Screen"] || 0) +
    (statusCounts["Interview"] || 0);

  // Recent 5 applications
  const recentApps = allApps.slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Track your job application progress
          </p>
        </div>
        <Link href="/applications/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Application
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Applications"
          value={total}
          icon={<FileText className="h-5 w-5" />}
        />
        <StatsCard
          title="This Week"
          value={thisWeek}
          icon={<Calendar className="h-5 w-5" />}
        />
        <StatsCard
          title="This Month"
          value={thisMonth}
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <StatsCard
          title="Active"
          value={activeCount}
          description="In progress"
          icon={<Zap className="h-5 w-5" />}
        />
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentApplications applications={recentApps} />
        </div>
        <div>
          <StatusBreakdown statusCounts={statusCounts} total={total} />
        </div>
      </div>
    </div>
  );
}
