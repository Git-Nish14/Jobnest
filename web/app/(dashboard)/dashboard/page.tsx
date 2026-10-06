import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDashboardAnalytics } from "@/services/analytics";
import { getSearchWorkspace } from "@/services/search-workspace";
import { readSearchPreferences, readWeeklyGoal } from "@/lib/job-search/preferences";
import { calendarDate } from "@/lib/job-search/calendar";
import { NextActions } from "@/components/dashboard/next-actions";
import { WeeklySearchPlan } from "@/components/dashboard/weekly-search-plan";
import { AtelierRecentApps } from "@/components/dashboard/atelier-recent-apps";
import { AtelierChart } from "@/components/dashboard/atelier-chart";
import { StageFunnelChart } from "@/components/dashboard/stage-funnel-chart";
import { SourceEffectivenessChart } from "@/components/dashboard/source-effectiveness-chart";
import { WeekdayActivityChart } from "@/components/dashboard/weekday-activity-chart";
import { MonthlyTrendsChart } from "@/components/dashboard/monthly-trends-chart";
import { WeeklyCadence } from "@/components/dashboard/weekly-cadence";
import { Plus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: stats, error } = await getDashboardAnalytics();
  if (error || !stats) throw new Error("Your dashboard could not be loaded. Please try again.");
  const workspace = await getSearchWorkspace(user.id, stats);
  const preferences = readSearchPreferences(user.user_metadata?.search_preferences);
  const goal = readWeeklyGoal(user.user_metadata?.weekly_goal);
  const name = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.split(" ")[0] : "there";
  const insights = params.view === "insights";
  const active = stats.statusDistribution.filter((s) => ["Applied", "Phone Screen", "Interview"].includes(s.status)).reduce((sum, s) => sum + s.count, 0);
  const visibleActions = workspace.actions.filter((a) => a.kind === "reminder" || !workspace.states.some((s) => s.task_key === a.key && s.status !== "pending"));

  return <div className="space-y-6 md:space-y-8">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs uppercase tracking-widest text-muted-foreground">Your job search</p><h1 className="db-headline text-3xl sm:text-5xl md:text-6xl mt-2">{insights ? "Search insights" : `What's next, ${name}?`}</h1><p className="text-sm text-muted-foreground mt-2">{insights ? "Understand your recorded progress and the limits of the data." : "A practical plan for your goal, and the commitments that need attention."}</p></div>
      <div className="flex flex-wrap gap-2"><Link href="/applications/new?status=Saved" className="db-btn-page-secondary min-h-11">Save a role</Link><Link href="/applications/new" className="db-btn-page-primary min-h-11">Log application</Link></div>
    </header>
    <nav aria-label="Dashboard views" className="flex gap-2 border-b border-border pb-3"><Link href="/dashboard" aria-current={!insights ? "page" : undefined} className={!insights ? "db-btn-page-primary" : "db-btn-page-secondary"}>Today & plan</Link><Link href="/dashboard?view=insights" aria-current={insights ? "page" : undefined} className={insights ? "db-btn-page-primary" : "db-btn-page-secondary"}>Insights</Link></nav>
    {!insights ? <>
      {stats.totalApplications === 0 && (stats.savedApplications ?? 0) === 0 && <section className="db-content-card"><h2 className="font-semibold">Start with one suitable role</h2><p className="text-sm text-muted-foreground mt-1">Save a posting, review the requirements, and log it as Applied when you submit. Your existing weekly goal will guide the schedule below.</p><Link href="/applications/new?status=Saved" className="db-link-primary mt-3 inline-block">Save your first role</Link></section>}
      <NextActions actions={visibleActions} today={calendarDate(new Date(stats.generatedAt!), stats.timezone!)} totalReminders={stats.pendingReminderCount ?? 0} overdueCount={stats.overdueReminderCount ?? 0} />
      <WeeklySearchPlan key={`${goal}-${stats.thisWeek}-${JSON.stringify(preferences)}-${JSON.stringify(workspace.states)}`} goal={goal} submitted={stats.thisWeek} preferences={preferences} now={stats.generatedAt!} timezone={stats.timezone!} commitments={workspace.actions} savedRoles={workspace.savedRoles} states={workspace.states} persistenceAvailable={workspace.persistenceAvailable} hasSavedPreferences={!!user.user_metadata?.search_preferences} connectionGoal={typeof user.user_metadata?.connection_goal === "number" ? readWeeklyGoal(user.user_metadata.connection_goal) : undefined} />
      <section aria-label="Search summary" className="grid grid-cols-2 md:grid-cols-4 gap-3">{[
        { label: "Active applications", value: active, href: "/applications" },
        { label: "Saved / preparing", value: stats.savedApplications ?? 0, href: "/applications?status=Saved" },
        { label: "Upcoming interviews", value: stats.upcomingInterviewCount ?? 0, href: "/interviews" },
        { label: "Offers received", value: stats.offersReceived ?? 0, href: "/salary" },
      ].map((metric) => <Link key={metric.label} href={metric.href} className="db-content-card"><strong className="text-2xl">{metric.value}</strong><p className="text-xs text-muted-foreground mt-1">{metric.label}</p></Link>)}</section>
      {(stats.staleApplications ?? 0) > 0 && <section className="db-content-card"><h2 className="font-semibold">Review older applications</h2><p className="text-sm text-muted-foreground mt-1">{stats.staleApplications} applications have no recorded reply after 30 days. Check for missing updates before treating them as closed.</p><Link href="/applications?status=Applied&sort=date_asc" className="db-link-primary mt-2 inline-block">Review waiting roles</Link></section>}
      <AtelierRecentApps applications={workspace.recent} />
      <div className="flex flex-wrap gap-3 text-sm"><Link href="/documents" className="db-link-primary">Documents</Link><Link href="/networking" className="db-link-primary">Networking</Link><Link href="/nestai" className="db-link-primary">Ask NESTAi</Link><Link href="/dashboard?view=insights" className="db-link-primary">Review your progress</Link></div>
    </> : <>
      <p className="text-sm text-muted-foreground">{stats.totalApplications} submitted applications · {stats.historyCoverage ?? 0} with recorded status changes. Imported or skipped stages may be unknown. All dates follow {stats.timezone}; weeks start {preferences.weekStartsOn === 0 ? "Sunday" : "Monday"}.</p>
      <section className="grid sm:grid-cols-3 gap-3" aria-label="Recorded outcomes">{[
        { label: "Any recorded employer reply", value: `${stats.responseRate}%`, detail: "Includes rejection replies. This is not a success rate." },
        { label: "Median recorded response", value: stats.averageTimeToResponse === null ? "Not enough dated history" : `${stats.averageTimeToResponse} days`, detail: `${stats.responseSampleSize ?? 0} usable status-change dates. Recorded dates may differ from actual reply dates.` },
        { label: "Interview to offer", value: stats.interviewToOfferRate === null ? "Not enough resolved interviews" : `${stats.interviewToOfferRate}%`, detail: `${stats.interviewResolved ?? 0} resolved; ${stats.interviewPending ?? 0} still pending. Only observed interviews are included.` },
      ].map((metric) => <div key={metric.label} className="db-content-card"><h2 className="text-sm font-semibold">{metric.label}</h2><p className="text-xl mt-2">{metric.value}</p><p className="text-xs text-muted-foreground mt-2 leading-relaxed">{metric.detail}</p></div>)}</section>
      <div className="grid lg:grid-cols-2 gap-6"><AtelierChart dailyData={stats.dailyTrends} weeklyData={stats.weeklyTrends} monthlyData={stats.monthlyTrends} /><StageFunnelChart data={stats.stageFunnel} /></div>
      <SourceEffectivenessChart data={stats.sourceEffectiveness} />
      <div className="grid lg:grid-cols-2 gap-6"><WeekdayActivityChart data={stats.weekdayActivity} /><MonthlyTrendsChart data={stats.monthlyTrends} /></div>
      <WeeklyCadence key={goal} weeklyTrends={stats.weeklyTrends} thisWeek={stats.thisWeek} initialGoal={goal} />
    </>}
    <p className="text-xs text-muted-foreground">Updated {new Intl.DateTimeFormat("en-US", { timeZone: stats.timezone, hour: "numeric", minute: "2-digit" }).format(new Date(stats.generatedAt!))} · {stats.timezone}</p>
    <Link href="/applications/new" aria-label="Add application" className="flex fixed w-14 h-14 rounded-full items-center justify-center z-40 db-fab bottom-[calc(env(safe-area-inset-bottom,0px)+5.75rem)] right-4 md:bottom-10 md:right-10"><Plus className="w-6 h-6" /></Link>
  </div>;
}
