import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getDashboardAnalytics, getApplications } from "@/services";
import { AtelierStatsCard } from "@/components/dashboard/atelier-stats-card";
import { AtelierChart } from "@/components/dashboard/atelier-chart";
import { AtelierStatusChart } from "@/components/dashboard/atelier-status-chart";
import { AtelierRecentApps } from "@/components/dashboard/atelier-recent-apps";
import { AtelierTasksPanel } from "@/components/dashboard/atelier-tasks-panel";
import { AnalyticsInsights } from "@/components/dashboard/analytics-insights";
import { WeeklyCadence } from "@/components/dashboard/weekly-cadence";
import { OPTCountdownBanner } from "@/components/dashboard/OPTCountdownBanner";
import { H1BTrackerCard } from "@/components/dashboard/H1BTrackerCard";
import { SourceEffectivenessChart } from "@/components/dashboard/source-effectiveness-chart";
import { TierResponseChart } from "@/components/dashboard/tier-response-chart";
import { StageFunnelChart } from "@/components/dashboard/stage-funnel-chart";
import { AvgSalaryChart } from "@/components/dashboard/avg-salary-chart";
import { MonthlyTrendsChart } from "@/components/dashboard/monthly-trends-chart";
import { TopCompaniesChart } from "@/components/dashboard/top-companies-chart";
import { WeekdayActivityChart } from "@/components/dashboard/weekday-activity-chart";
import { BarChart3, Calendar, Mail, Plus, Library, ScanSearch, ChevronRight } from "lucide-react";

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
    averageTimeToResponse: null,
    interviewToOfferRate: null,
    ghostRate: null,
    activePipeline: 0,
    weeklyMomentum: null,
    topSource: null,
    statusDistribution: [],
    dailyTrends: [],
    weeklyTrends: [],
    monthlyTrends: [],
    topCompanies: [],
    upcomingInterviews: [],
    pendingReminders: [],
    avgSalaryBySource: [],
    sourceEffectiveness: [],
    stageFunnel: [],
    weekdayActivity: [],
    tierResponseRate: [],
  };

  // Weekly goal from user_metadata (set in Profile → Job Search Goals)
  const weeklyGoalRaw = user?.user_metadata?.weekly_goal;
  const weeklyGoal: number | undefined =
    typeof weeklyGoalRaw === "number" && weeklyGoalRaw >= 1 && weeklyGoalRaw <= 100
      ? weeklyGoalRaw
      : undefined;

  // OPT / H1B work auth
  const workAuth: string | null = user?.user_metadata?.work_authorization ?? null;
  const optStartDate: string | null = user?.user_metadata?.opt_start_date ?? null;
  const stemExtension: boolean = user?.user_metadata?.stem_extension ?? false;
  const showOPTBanner = workAuth === "OPT (F-1)" && !!optStartDate;
  const showH1BCard = workAuth === "H1B" || workAuth === "OPT (F-1)";

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
        <h1 className="db-headline text-3xl sm:text-5xl md:text-6xl text-foreground mb-3">
          Welcome back, {firstName}.
        </h1>
        <p className="text-lg text-muted-foreground">
          {activeCount > 0 || upcomingCount > 0
            ? `You have ${upcomingCount > 0 ? `${upcomingCount} interview${upcomingCount !== 1 ? "s" : ""} upcoming` : "no upcoming interviews"}${activeCount > 0 ? ` and ${activeCount} active application${activeCount !== 1 ? "s" : ""}` : ""}.`
            : "Your career workspace is ready. Start tracking your applications."}
        </p>
      </header>

      {/* ── OPT Expiry Banner ── */}
      {showOPTBanner && (
        <OPTCountdownBanner optStartDate={optStartDate!} stemExtension={stemExtension} />
      )}

      {/* ── Bento grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

        {/* ── Row 1: Stat cards ── */}
        <div className="md:col-span-4">
          <AtelierStatsCard
            label="Total Applications"
            value={stats.totalApplications.toString().padStart(2, "0")}
            icon={<BarChart3 className="w-5 h-5" />}
            bgClass="bg-[#f4f3f1] dark:bg-[#0f0f0f]"
            footer={
              <span className="flex items-center gap-1.5 text-[#006d34] dark:text-[#4ade80] text-sm font-semibold">
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
            bgClass="bg-[#e9e8e6] dark:bg-[#1a1a1a]"
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
            bgClass="bg-[#ffdbd0]/40 dark:bg-[#0f0f0f] dark:outline dark:outline-1 dark:outline-[#ccff00]/15"
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
          <AtelierChart
            dailyData={stats.dailyTrends}
            weeklyData={stats.weeklyTrends}
            monthlyData={stats.monthlyTrends}
          />
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

        {/* ── Quick-access cards: Document Library + ATS Scanner ── */}
        <div className="md:col-span-6">
          <Link
            href="/documents"
            className="db-content-card flex items-center gap-4 hover:shadow-md transition-all group h-full"
          >
            <div className="h-11 w-11 rounded-xl bg-[#99462a]/10 dark:bg-[#99462a]/20 flex items-center justify-center shrink-0 group-hover:bg-[#99462a]/20 dark:group-hover:bg-[#99462a]/30 transition-colors">
              <Library className="h-5 w-5 text-[#99462a]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground text-sm">Document Library</p>
              <p className="text-xs text-muted-foreground mt-0.5">Resumes, cover letters &amp; all uploads</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
          </Link>
        </div>

        <div className={showH1BCard ? "md:col-span-4" : "md:col-span-6"}>
          <Link
            href="/ats"
            className="db-content-card flex items-center gap-4 hover:shadow-md transition-all group h-full"
          >
            <div className="h-11 w-11 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center shrink-0 group-hover:bg-blue-100 dark:group-hover:bg-blue-950/60 transition-colors">
              <ScanSearch className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground text-sm">ATS Scanner</p>
              <p className="text-xs text-muted-foreground mt-0.5">Match your resume to a job description</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
          </Link>
        </div>

        {showH1BCard && (
          <div className="md:col-span-4">
            <H1BTrackerCard workAuth={workAuth!} />
          </div>
        )}
      </div>

      {/* ── Extended analytics row 1: monthly breakdown + weekday + top companies ── */}
      {stats.totalApplications >= 3 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-6">
          <div className="sm:col-span-2 lg:col-span-6">
            <MonthlyTrendsChart data={stats.monthlyTrends} />
          </div>
          <div className="lg:col-span-3">
            <WeekdayActivityChart data={stats.weekdayActivity} />
          </div>
          <div className="lg:col-span-3">
            <TopCompaniesChart data={stats.topCompanies} />
          </div>
        </div>
      )}

      {/* ── Extended analytics row 2: funnel + salary + source effectiveness + tier response ── */}
      {stats.totalApplications >= 3 && (
        <div className={`grid grid-cols-1 sm:grid-cols-2 gap-6 ${stats.tierResponseRate.length > 0 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
          <StageFunnelChart data={stats.stageFunnel} />
          <AvgSalaryChart data={stats.avgSalaryBySource} />
          <SourceEffectivenessChart data={stats.sourceEffectiveness} />
          {stats.tierResponseRate.length > 0 && (
            <TierResponseChart data={stats.tierResponseRate} />
          )}
        </div>
      )}

      {/* ── Search Intelligence ── */}
      <AnalyticsInsights
        averageTimeToResponse={stats.averageTimeToResponse}
        interviewToOfferRate={stats.interviewToOfferRate}
        ghostRate={stats.ghostRate}
        totalApplications={stats.totalApplications}
        activePipeline={stats.activePipeline}
        weeklyMomentum={stats.weeklyMomentum}
        topSource={stats.topSource}
      />

      {/* ── Weekly Cadence ── */}
      {stats.totalApplications > 0 && (
        <WeeklyCadence
          weeklyTrends={stats.weeklyTrends}
          thisWeek={stats.thisWeek}
          initialGoal={weeklyGoal}
        />
      )}

      <Link
        href="/applications/new"
        className="flex fixed w-14 h-14 rounded-full items-center justify-center z-40 db-fab bottom-[calc(env(safe-area-inset-bottom,0px)+5.75rem)] right-4 md:bottom-10 md:right-10"
        title="New Application"
      >
        <Plus className="w-6 h-6" />
      </Link>
    </div>
  );
}
