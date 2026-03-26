import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getDashboardAnalytics, getApplications } from "@/services";
import { AtelierStatsCard } from "@/components/dashboard/atelier-stats-card";
import { AtelierChart } from "@/components/dashboard/atelier-chart";
import { AtelierStatusChart } from "@/components/dashboard/atelier-status-chart";
import { AtelierRecentApps } from "@/components/dashboard/atelier-recent-apps";
import { AtelierTasksPanel } from "@/components/dashboard/atelier-tasks-panel";
import { BarChart3, Calendar, Mail, Plus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

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

  // Derive display name
  const rawName: string = user?.user_metadata?.full_name || user?.email || "there";
  const firstName = rawName.split(/[\s@]/)[0];

  // Stat derivations
  const offerCount = stats.statusDistribution
    .filter((s) => s.status === "Offer" || s.status === "Accepted")
    .reduce((sum, s) => sum + s.count, 0);

  const activeCount = stats.statusDistribution
    .filter((s) => ["Applied", "Phone Screen", "Interview", "In Review"].includes(s.status))
    .reduce((sum, s) => sum + s.count, 0);

  const upcomingCount = stats.upcomingInterviews.length;

  const nextInterview = stats.upcomingInterviews[0];
  const nextInterviewLabel = nextInterview
    ? `${(nextInterview as { job_applications?: { company: string } }).job_applications?.company ?? "Upcoming"} (${nextInterview.type})`
    : null;

  return (
    <div className="space-y-8">

      {/* ── Welcome header ── */}
      <header>
        <h1 className="db-headline text-5xl md:text-6xl text-[#1a1c1b] mb-3">
          Welcome back, {firstName}.
        </h1>
        <p className="text-lg text-[#55433d]">
          {activeCount > 0 || upcomingCount > 0
            ? `You have ${upcomingCount > 0 ? `${upcomingCount} interview${upcomingCount !== 1 ? "s" : ""} upcoming` : "no upcoming interviews"}${activeCount > 0 ? ` and ${activeCount} active application${activeCount !== 1 ? "s" : ""}` : ""}.`
            : "Your career workspace is ready. Start tracking your applications."}
        </p>
      </header>

      {/* ── Bento grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

        {/* ── Row 1: Stat cards ── */}
        <div className="md:col-span-4">
          <AtelierStatsCard
            label="Total Applications"
            value={stats.totalApplications.toString().padStart(2, "0")}
            icon={<BarChart3 className="w-5 h-5" />}
            bgClass="bg-[#f4f3f1]"
            footer={
              <span className="flex items-center gap-1.5 text-[#006d34] text-sm font-semibold">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l6-6 4 4 8-8" />
                </svg>
                +{stats.thisWeek} this week
              </span>
            }
          />
        </div>

        <div className="md:col-span-4">
          <AtelierStatsCard
            label="Upcoming Interviews"
            value={upcomingCount.toString().padStart(2, "0")}
            icon={<Calendar className="w-5 h-5" />}
            bgClass="bg-[#e9e8e6]"
            footer={
              nextInterviewLabel ? (
                <p className="text-sm text-[#55433d]">
                  Next: <span className="text-[#1a1c1b] font-semibold">{nextInterviewLabel}</span>
                </p>
              ) : (
                <p className="text-sm text-[#55433d]">No interviews scheduled</p>
              )
            }
          />
        </div>

        <div className="md:col-span-4">
          <AtelierStatsCard
            label="Offers Received"
            value={offerCount.toString().padStart(2, "0")}
            icon={<Mail className="w-5 h-5" />}
            bgClass="bg-[#ffdbd0]/40"
            footer={
              offerCount > 0 ? (
                <Link href="/applications?status=Offer" className="db-btn-primary">
                  Review Offer
                </Link>
              ) : (
                <p className="text-sm text-[#55433d]">Keep going, you&apos;re close!</p>
              )
            }
          />
        </div>

        {/* ── Row 2: Chart + Tasks ── */}
        <div className="md:col-span-8">
          <AtelierChart data={stats.weeklyTrends} />
        </div>

        <div className="md:col-span-4">
          <AtelierTasksPanel reminders={stats.pendingReminders} />
        </div>

        {/* ── Row 3: Status breakdown + Recent apps ── */}
        <div className="md:col-span-4">
          <AtelierStatusChart
            data={stats.statusDistribution}
            total={stats.totalApplications}
          />
        </div>

        <div className="md:col-span-8">
          <AtelierRecentApps applications={recentApps} />
        </div>
      </div>

      {/* ── FAB: New Application ──
           Mobile: bottom-6 (no bottom-nav bar in current app)
           Desktop: bottom-10 ── */}
      <Link
        href="/applications/new"
        className="fixed bottom-6 right-6 md:bottom-10 md:right-10 w-14 h-14 rounded-full flex items-center justify-center z-40 db-fab"
        title="New Application"
      >
        <Plus className="w-6 h-6" />
      </Link>
    </div>
  );
}
