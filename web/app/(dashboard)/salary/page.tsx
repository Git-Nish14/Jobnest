import Link from "next/link";
import { DollarSign, TrendingUp, Building, Award, Clock } from "lucide-react";
import { getAllSalaryDetails, formatSalary, getApplications } from "@/services";
import { OfferDecisionHelper } from "@/components/dashboard/offer-decision-helper";
import { SalaryPageClient } from "@/components/salary/SalaryPageClient";
import { SalaryBenchmark } from "@/components/salary/SalaryBenchmark";
import { computeFullTC, computeEffectiveHourlyRate, computeBenefitsDollarValue } from "@/lib/utils/salary-helpers";
import { estimateTakeHome } from "@/lib/utils/tax-estimator";

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  Applied:        { bg: "bg-amber-50 dark:bg-amber-950/30",   text: "text-amber-700 dark:text-amber-300" },
  "Phone Screen": { bg: "bg-orange-50 dark:bg-orange-950/30", text: "text-orange-700 dark:text-orange-300" },
  "In Review":    { bg: "bg-orange-50 dark:bg-orange-950/30", text: "text-orange-700 dark:text-orange-300" },
  Interview:      { bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-300" },
  Offer:          { bg: "bg-emerald-100 dark:bg-emerald-950/40", text: "text-emerald-800 dark:text-emerald-200 font-bold" },
  Accepted:       { bg: "bg-emerald-100 dark:bg-emerald-950/40", text: "text-emerald-800 dark:text-emerald-200 font-bold" },
  Rejected:       { bg: "bg-red-50 dark:bg-red-950/30",       text: "text-red-700 dark:text-red-300" },
  Withdrawn:      { bg: "bg-muted",                            text: "text-muted-foreground" },
  Ghosted:        { bg: "bg-zinc-100 dark:bg-zinc-800/40",    text: "text-zinc-600 dark:text-zinc-400" },
};

function StatusBadge({ status }: { status: string }) {
  const tokens = STATUS_BADGE[status] ?? { bg: "bg-muted", text: "text-muted-foreground" };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${tokens.bg} ${tokens.text}`}>
      {status}
    </span>
  );
}

export const dynamic = "force-dynamic";

export default async function SalaryComparisonPage() {
  const [{ data: salaryData }, { data: allApplicationsData }] = await Promise.all([
    getAllSalaryDetails(),
    getApplications(),
  ]);

  const offers = (salaryData || []).filter(
    (s) => s.job_applications?.status === "Offer"
  );
  const allWithSalary = salaryData || [];

  const totalOffers = offers.length;

  const offersWithTC = offers.map((offer) => ({
    ...offer,
    tc: computeFullTC(offer),
  }));

  const highestOffer = offersWithTC.reduce(
    (max, s) => (s.tc.total > (max?.tc.total ?? 0) ? s : max),
    null as (typeof offersWithTC)[0] | null
  );

  const averageSalary =
    offers.length > 0
      ? offers.reduce((sum, s) => sum + (s.base_salary || 0), 0) / offers.length
      : 0;

  const averageTC =
    offersWithTC.length > 0
      ? offersWithTC.reduce((sum, s) => sum + s.tc.total, 0) / offersWithTC.length
      : 0;

  return (
    <div>
      {/* ── Header ── */}
      <header className="db-page-header">
        <div>
          <h1 className="db-page-title">Salary Tracker</h1>
          <p className="db-page-subtitle">
            Compare and track total compensation packages across your applications.
          </p>
        </div>
        {offers.length > 0 && (
          <SalaryPageClient
            offerIds={offers.map((o) => o.application_id)}
          />
        )}
      </header>

      <div className="space-y-8">
        {/* ── Stats ── */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: Award,
              label: "Total Offers",
              value: totalOffers.toString(),
              sub: null,
            },
            {
              icon: TrendingUp,
              label: "Highest TC",
              value: highestOffer ? formatSalary(highestOffer.tc.total, highestOffer.currency) : "N/A",
              sub: highestOffer?.job_applications?.company ?? null,
            },
            {
              icon: DollarSign,
              label: "Average Base",
              value: averageSalary > 0 ? formatSalary(averageSalary) : "N/A",
              sub: null,
            },
            {
              icon: Building,
              label: "With Salary Data",
              value: allWithSalary.length.toString(),
              sub: averageTC > 0 ? `Avg TC: ${formatSalary(averageTC)}` : null,
            },
          ].map(({ icon: Icon, label, value, sub }) => (
            <div key={label} className="db-content-card">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="h-4 w-4 text-[#99462a]" />
                <span className="text-xs text-[#55433d] font-semibold uppercase tracking-widest">{label}</span>
              </div>
              <p className="db-headline text-2xl sm:text-3xl font-medium text-[#1a1c1b]">{value}</p>
              {sub && <p className="text-xs text-[#55433d]/70 mt-1">{sub}</p>}
            </div>
          ))}
        </div>

        {/* ── Salary Comparison Table — all apps with salary data ── */}
        <section>
          <h2 className="db-headline text-xl font-semibold text-[#1a1c1b] mb-4">Salary Comparison</h2>
          <div className="db-content-card">
            {allWithSalary.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <DollarSign className="h-10 w-10 text-[#55433d]/30 mb-3" />
                <p className="text-[#55433d] font-medium">No applications with salary data yet</p>
                <p className="text-sm text-[#55433d]/60 mt-1">
                  Add salary details to your applications to compare them here
                </p>
              </div>
            ) : (
              <div className="db-scroll-x">
                <table className="w-full text-sm min-w-240">
                  <thead>
                    <tr>
                      {[
                        { label: "Company",      align: "left",  sticky: true  },
                        { label: "Position",     align: "left",  sticky: false },
                        { label: "Status",       align: "left",  sticky: false },
                        { label: "Base",         align: "right", sticky: false },
                        { label: "Bonus",        align: "right", sticky: false },
                        { label: "Equity/yr",    align: "right", sticky: false },
                        { label: "401k Match",   align: "right", sticky: false },
                        { label: "Benefits",     align: "right", sticky: false },
                        { label: "Total TC",     align: "right", sticky: false },
                        { label: "Take-Home",    align: "right", sticky: false },
                        { label: "Eff. $/hr",    align: "right", sticky: false },
                      ].map(({ label, align, sticky }) => (
                        <th
                          key={label}
                          className={`py-3 px-3 text-xs font-bold uppercase tracking-widest text-[#55433d]/60 border-b border-[#dbc1b9]/20 ${align === "right" ? "text-right" : "text-left"} ${sticky ? "sticky left-0 z-10 bg-background" : ""}`}
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allWithSalary.map((item) => {
                      const tc         = computeFullTC(item);
                      const cur        = item.currency ?? "USD";
                      const takeHome   = item.state_of_work
                        ? estimateTakeHome(tc.total, item.state_of_work, "single")
                        : null;
                      const hourlyRate = computeEffectiveHourlyRate(
                        tc.total,
                        item.annual_hours_worked ?? 2080,
                        item.pto_days
                      );
                      const appStatus  = item.job_applications?.status ?? "";
                      return (
                        <tr key={item.id} className="group hover:bg-[#f4f3f1] transition-colors">
                          <td className="py-3 px-3 border-b border-[#dbc1b9]/10 sticky left-0 z-10 bg-[#faf9f7] dark:bg-[#0a0a0a] group-hover:bg-[#f4f3f1] dark:group-hover:bg-[#1a1a1a] transition-colors">
                            <Link href={`/applications/${item.application_id}`} className="font-semibold text-[#99462a] hover:underline">
                              {item.job_applications?.company}
                            </Link>
                            {item.state_of_work && (
                              <span className="ml-1.5 text-[10px] bg-muted rounded px-1 py-0.5 text-muted-foreground">{item.state_of_work}</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-[#55433d] border-b border-[#dbc1b9]/10">{item.job_applications?.position}</td>
                          <td className="py-3 px-3 border-b border-[#dbc1b9]/10">
                            <StatusBadge status={appStatus} />
                          </td>
                          <td className="py-3 px-3 text-right text-[#1a1c1b] border-b border-[#dbc1b9]/10">{formatSalary(item.base_salary, cur)}</td>
                          <td className="py-3 px-3 text-right text-[#1a1c1b] border-b border-[#dbc1b9]/10">{formatSalary(item.bonus, cur)}</td>
                          <td className="py-3 px-3 text-right border-b border-[#dbc1b9]/10">
                            {tc.equityAnnual > 0
                              ? <span className="font-medium text-violet-700 dark:text-violet-300">{formatSalary(tc.equityAnnual, cur)}</span>
                              : <span className="text-muted-foreground text-xs">—</span>
                            }
                          </td>
                          <td className="py-3 px-3 text-right border-b border-[#dbc1b9]/10">
                            {tc.match401k > 0
                              ? <span className="font-medium text-emerald-700 dark:text-emerald-300">{formatSalary(tc.match401k, cur)}</span>
                              : (item.retirement_match_percent ? <span className="text-muted-foreground text-xs">N/A</span> : <span className="text-muted-foreground text-xs">—</span>)
                            }
                          </td>
                          <td className="py-3 px-3 text-right border-b border-[#dbc1b9]/10">
                            <span className="text-sky-700 dark:text-sky-300 font-medium">
                              {formatSalary(computeBenefitsDollarValue(item), cur)}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-[#006d34] border-b border-[#dbc1b9]/10">
                            {formatSalary(tc.total, cur)}
                          </td>
                          <td className="py-3 px-3 text-right border-b border-[#dbc1b9]/10">
                            {takeHome
                              ? <div>
                                  <p className="font-medium text-[#1a1c1b]">{formatSalary(takeHome.netAnnual, cur)}</p>
                                  <p className="text-[10px] text-muted-foreground">{(takeHome.effectiveRate * 100).toFixed(1)}% eff. rate</p>
                                </div>
                              : <span className="text-[10px] text-muted-foreground">Set state →</span>
                            }
                          </td>
                          <td className="py-3 px-3 text-right border-b border-[#dbc1b9]/10">
                            <div className="flex items-center justify-end gap-1">
                              <Clock className="h-3 w-3 text-muted-foreground/60" />
                              <span className="text-xs font-medium text-[#55433d]">
                                {formatSalary(Math.round(hourlyRate), cur)}/hr
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* ── TC Legend ── */}
        {allWithSalary.length > 0 && (
          <div className="db-content-card">
            <p className="text-xs font-semibold text-[#55433d] mb-3">TC Breakdown Key</p>
            <div className="flex flex-wrap gap-3">
              {[
                { color: "text-[#1a1c1b]",                     label: "Base, Bonus, Signing — your cash components" },
                { color: "text-violet-700 dark:text-violet-300", label: "Equity/yr — Year 1 RSU vesting value at current price" },
                { color: "text-emerald-700 dark:text-emerald-300",label: "401(k) Match — employer contribution up to cap" },
                { color: "text-sky-700 dark:text-sky-300",       label: "Benefits Value — health $7.2k, dental $500, vision $200" },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span className={`text-xs font-semibold ${color}`}>●</span>
                  <span className="text-xs text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              Take-Home uses a single-filer, standard-deduction estimate for the selected state. Not tax advice. Add RSU and 401k details on the application detail page.
            </p>
          </div>
        )}

        {/* ── Salary Benchmarking ── */}
        <SalaryBenchmark applications={allApplicationsData ?? []} />

        {/* ── Offer Decision Helper ── */}
        <OfferDecisionHelper
          offers={(salaryData || []).filter(
            (s) => s.job_applications?.status === "Offer" || s.job_applications?.status === "Accepted"
          )}
        />
      </div>
    </div>
  );
}
