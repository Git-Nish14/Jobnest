import Link from "next/link";
import { DollarSign, TrendingUp, Building, Award, Clock } from "lucide-react";
import { getAllSalaryDetails, formatSalary } from "@/services";
import { OfferDecisionHelper } from "@/components/dashboard/offer-decision-helper";
import { SalaryPageClient } from "@/components/salary/SalaryPageClient";
import { computeFullTC, computeEffectiveHourlyRate, computeBenefitsDollarValue } from "@/lib/utils/salary-helpers";
import { estimateTakeHome } from "@/lib/utils/tax-estimator";

export const dynamic = "force-dynamic";

export default async function SalaryComparisonPage() {
  const { data: salaryData } = await getAllSalaryDetails();

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
              <p className="db-headline text-3xl font-medium text-[#1a1c1b]">{value}</p>
              {sub && <p className="text-xs text-[#55433d]/70 mt-1">{sub}</p>}
            </div>
          ))}
        </div>

        {/* ── Offer Comparison Table ── */}
        <section>
          <h2 className="db-headline text-xl font-semibold text-[#1a1c1b] mb-4">Offer Comparison</h2>
          <div className="db-content-card">
            {offers.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <DollarSign className="h-10 w-10 text-[#55433d]/30 mb-3" />
                <p className="text-[#55433d] font-medium">No offers with salary data yet</p>
                <p className="text-sm text-[#55433d]/60 mt-1">
                  Add salary details to your applications to compare them here
                </p>
              </div>
            ) : (
              <div className="db-scroll-x">
                <table className="w-full text-sm min-w-225">
                  <thead>
                    <tr>
                      {[
                        { label: "Company",      align: "left"  },
                        { label: "Position",     align: "left"  },
                        { label: "Base",         align: "right" },
                        { label: "Bonus",        align: "right" },
                        { label: "Equity/yr",    align: "right" },
                        { label: "401k Match",   align: "right" },
                        { label: "Benefits",     align: "right" },
                        { label: "Total TC",     align: "right" },
                        { label: "Take-Home",    align: "right" },
                        { label: "Eff. $/hr",    align: "right" },
                      ].map(({ label, align }) => (
                        <th
                          key={label}
                          className={`py-3 px-3 text-xs font-bold uppercase tracking-widest text-[#55433d]/60 border-b border-[#dbc1b9]/20 ${align === "right" ? "text-right" : "text-left"}`}
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {offersWithTC.map((offer) => {
                      const cur        = offer.currency ?? "USD";
                      const takeHome   = offer.state_of_work
                        ? estimateTakeHome(offer.tc.total, offer.state_of_work, "single")
                        : null;
                      const hourlyRate = computeEffectiveHourlyRate(
                        offer.tc.total,
                        offer.annual_hours_worked ?? 2080,
                        offer.pto_days
                      );
                      return (
                        <tr key={offer.id} className="hover:bg-[#f4f3f1] transition-colors">
                          <td className="py-3 px-3 border-b border-[#dbc1b9]/10">
                            <Link href={`/applications/${offer.application_id}`} className="font-semibold text-[#99462a] hover:underline">
                              {offer.job_applications?.company}
                            </Link>
                            {offer.state_of_work && (
                              <span className="ml-1.5 text-[10px] bg-muted rounded px-1 py-0.5 text-muted-foreground">{offer.state_of_work}</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-[#55433d] border-b border-[#dbc1b9]/10">{offer.job_applications?.position}</td>
                          <td className="py-3 px-3 text-right text-[#1a1c1b] border-b border-[#dbc1b9]/10">{formatSalary(offer.base_salary, cur)}</td>
                          <td className="py-3 px-3 text-right text-[#1a1c1b] border-b border-[#dbc1b9]/10">{formatSalary(offer.bonus, cur)}</td>
                          <td className="py-3 px-3 text-right border-b border-[#dbc1b9]/10">
                            {offer.tc.equityAnnual > 0
                              ? <span className="font-medium text-violet-700 dark:text-violet-300">{formatSalary(offer.tc.equityAnnual, cur)}</span>
                              : <span className="text-muted-foreground text-xs">—</span>
                            }
                          </td>
                          <td className="py-3 px-3 text-right border-b border-[#dbc1b9]/10">
                            {offer.tc.match401k > 0
                              ? <span className="font-medium text-emerald-700 dark:text-emerald-300">{formatSalary(offer.tc.match401k, cur)}</span>
                              : (offer.retirement_match_percent ? <span className="text-muted-foreground text-xs">N/A</span> : <span className="text-muted-foreground text-xs">—</span>)
                            }
                          </td>
                          <td className="py-3 px-3 text-right border-b border-[#dbc1b9]/10">
                            <span className="text-sky-700 dark:text-sky-300 font-medium">
                              {formatSalary(computeBenefitsDollarValue(offer), cur)}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-[#006d34] border-b border-[#dbc1b9]/10">
                            {formatSalary(offer.tc.total, cur)}
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
        {offers.length > 0 && (
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

        {/* ── All salary data ── */}
        {allWithSalary.length > 0 && allWithSalary.length !== offers.length && (
          <section>
            <h2 className="db-headline text-xl font-semibold text-[#1a1c1b] mb-4">All Salary Information</h2>
            <div className="db-content-card space-y-2">
              {allWithSalary.map((item) => {
                const tc = computeFullTC(item);
                return (
                  <div key={item.id} className="db-app-row">
                    <div className="flex items-center justify-between gap-4 w-full">
                      <div>
                        <Link href={`/applications/${item.application_id}`} className="font-semibold text-[#99462a] hover:underline text-sm">
                          {item.job_applications?.company}
                        </Link>
                        <p className="text-xs text-[#55433d]/70">{item.job_applications?.position}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold text-[#1a1c1b] text-sm">{formatSalary(item.base_salary, item.currency)}</p>
                        <p className="text-xs text-[#55433d]/60">TC: {formatSalary(tc.total, item.currency)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

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
