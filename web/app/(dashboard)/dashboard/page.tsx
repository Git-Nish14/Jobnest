import Link from "next/link";
import { FileText, Calendar, TrendingUp, Zap, Plus } from "lucide-react";
import { getApplications, calculateStats } from "@/services";
import { Button } from "@/components/ui";
import { StatsCard, RecentApplications, StatusBreakdown } from "@/components/dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { data: applications } = await getApplications();
  const allApps = applications || [];
  const stats = calculateStats(allApps);
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
          value={stats.total}
          icon={<FileText className="h-5 w-5" />}
        />
        <StatsCard
          title="This Week"
          value={stats.thisWeek}
          icon={<Calendar className="h-5 w-5" />}
        />
        <StatsCard
          title="This Month"
          value={stats.thisMonth}
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <StatsCard
          title="Active"
          value={stats.active}
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
          <StatusBreakdown statusCounts={stats.statusCounts} total={stats.total} />
        </div>
      </div>
    </div>
  );
}
