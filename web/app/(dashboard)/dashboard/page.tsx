import Link from "next/link";
import { FileText, Calendar, TrendingUp, Zap, Plus } from "lucide-react";
import { getDashboardAnalytics } from "@/services";
import { Button } from "@/components/ui";
import {
  StatsCard,
  RecentApplications,
  ApplicationChart,
  StatusPieChart,
  UpcomingInterviews,
  PendingReminders,
  ResponseRateCard,
} from "@/components/dashboard";
import { getApplications } from "@/services";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [{ data: analytics }, { data: applications }] = await Promise.all([
    getDashboardAnalytics(),
    getApplications(),
  ]);

  const allApps = applications || [];
  const recentApps = allApps.slice(0, 5);

  const stats = analytics || {
    totalApplications: 0,
    thisWeek: 0,
    thisMonth: 0,
    responseRate: 0,
    statusDistribution: [],
    weeklyTrends: [],
    upcomingInterviews: [],
    pendingReminders: [],
  };

  // Calculate active applications
  const activeCount = stats.statusDistribution
    .filter((s) => ["Applied", "Phone Screen", "Interview"].includes(s.status))
    .reduce((sum, s) => sum + s.count, 0);

  // Calculate responses for response rate card
  const responses = stats.statusDistribution
    .filter((s) => ["Phone Screen", "Interview", "Offer", "Rejected"].includes(s.status))
    .reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track your job application progress
          </p>
        </div>
        <Link href="/applications/new" className="w-full sm:w-auto">
          <Button className="gap-2 w-full sm:w-auto shadow-sm">
            <Plus className="h-4 w-4" />
            New Application
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatsCard
          title="Total Applications"
          value={stats.totalApplications}
          icon={<FileText className="h-4 w-4 sm:h-5 sm:w-5" />}
        />
        <StatsCard
          title="This Week"
          value={stats.thisWeek}
          icon={<Calendar className="h-4 w-4 sm:h-5 sm:w-5" />}
        />
        <StatsCard
          title="This Month"
          value={stats.thisMonth}
          icon={<TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />}
        />
        <StatsCard
          title="Active"
          value={activeCount}
          description="In progress"
          icon={<Zap className="h-4 w-4 sm:h-5 sm:w-5" />}
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <ApplicationChart data={stats.weeklyTrends} title="Weekly Applications" />
        <StatusPieChart data={stats.statusDistribution} total={stats.totalApplications} />
      </div>

      {/* Response Rate & Recent Activity */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentApplications applications={recentApps} />
        </div>
        <ResponseRateCard
          rate={stats.responseRate}
          total={stats.totalApplications}
          responses={responses}
        />
      </div>

      {/* Interviews & Reminders */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <UpcomingInterviews interviews={stats.upcomingInterviews} />
        <PendingReminders reminders={stats.pendingReminders} />
      </div>
    </div>
  );
}
