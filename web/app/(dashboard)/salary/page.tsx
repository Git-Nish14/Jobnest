import Link from "next/link";
import { DollarSign, TrendingUp, Building, Award } from "lucide-react";
import { getAllSalaryDetails, formatSalary, calculateTotalCompensation } from "@/services";

export const dynamic = "force-dynamic";

export default async function SalaryComparisonPage() {
  const { data: salaryData } = await getAllSalaryDetails();

  const offers = (salaryData || []).filter(
    (s) => s.job_applications?.status === "Offer"
  );
  const allWithSalary = salaryData || [];

  const totalOffers = offers.length;
  const highestOffer = offers.reduce((max, s) => {
    const total = calculateTotalCompensation(s);
    const maxTotal = max ? calculateTotalCompensation(max) : 0;
    return total > maxTotal ? s : max;
  }, null as (typeof offers)[0] | null);

  const averageSalary =
    offers.length > 0
      ? offers.reduce((sum, s) => sum + (s.base_salary || 0), 0) / offers.length
      : 0;

  return (
    <div>
      {/* ── Header ── */}
      <header className="db-page-header">
        <div>
          <h1 className="db-page-title">Salary Tracker</h1>
          <p className="db-page-subtitle">
            Compare and track compensation packages across your applications.
          </p>
        </div>
      </header>

      <div className="space-y-8">
        {/* ── Stats ── */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Award,     label: "Total Offers",            value: totalOffers.toString(),               sub: null },
            { icon: TrendingUp, label: "Highest Offer",          value: highestOffer ? formatSalary(calculateTotalCompensation(highestOffer)) : "N/A", sub: highestOffer?.job_applications?.company ?? null },
            { icon: DollarSign, label: "Average Base Salary",    value: averageSalary > 0 ? formatSalary(averageSalary) : "N/A", sub: null },
            { icon: Building,   label: "With Salary Data",       value: allWithSalary.length.toString(), sub: null },
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
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr>
                      <th className="text-left py-3 px-3 text-xs font-bold uppercase tracking-widest text-[#55433d]/60 border-b border-[#dbc1b9]/20">Company</th>
                      <th className="text-left py-3 px-3 text-xs font-bold uppercase tracking-widest text-[#55433d]/60 border-b border-[#dbc1b9]/20">Position</th>
                      <th className="text-right py-3 px-3 text-xs font-bold uppercase tracking-widest text-[#55433d]/60 border-b border-[#dbc1b9]/20">Base</th>
                      <th className="text-right py-3 px-3 text-xs font-bold uppercase tracking-widest text-[#55433d]/60 border-b border-[#dbc1b9]/20">Bonus</th>
                      <th className="text-right py-3 px-3 text-xs font-bold uppercase tracking-widest text-[#55433d]/60 border-b border-[#dbc1b9]/20">Signing</th>
                      <th className="text-right py-3 px-3 text-xs font-bold uppercase tracking-widest text-[#55433d]/60 border-b border-[#dbc1b9]/20">Total</th>
                      <th className="text-center py-3 px-3 text-xs font-bold uppercase tracking-widest text-[#55433d]/60 border-b border-[#dbc1b9]/20">Benefits</th>
                    </tr>
                  </thead>
                  <tbody>
                    {offers.map((offer) => (
                      <tr key={offer.id} className="hover:bg-[#f4f3f1] transition-colors">
                        <td className="py-3 px-3 border-b border-[#dbc1b9]/10">
                          <Link href={`/applications/${offer.application_id}`} className="font-semibold text-[#99462a] hover:underline">
                            {offer.job_applications?.company}
                          </Link>
                        </td>
                        <td className="py-3 px-3 text-[#55433d] border-b border-[#dbc1b9]/10">{offer.job_applications?.position}</td>
                        <td className="py-3 px-3 text-right text-[#1a1c1b] border-b border-[#dbc1b9]/10">{formatSalary(offer.base_salary)}</td>
                        <td className="py-3 px-3 text-right text-[#1a1c1b] border-b border-[#dbc1b9]/10">{formatSalary(offer.bonus)}</td>
                        <td className="py-3 px-3 text-right text-[#1a1c1b] border-b border-[#dbc1b9]/10">{formatSalary(offer.signing_bonus)}</td>
                        <td className="py-3 px-3 text-right font-bold text-[#006d34] border-b border-[#dbc1b9]/10">{formatSalary(calculateTotalCompensation(offer))}</td>
                        <td className="py-3 px-3 border-b border-[#dbc1b9]/10">
                          <div className="flex justify-center gap-1 flex-wrap">
                            {offer.health_insurance && <span className="db-status-badge db-status-offer text-[10px]">Health</span>}
                            {offer.retirement_401k && <span className="db-status-badge db-status-interview text-[10px]">401k</span>}
                            {offer.pto_days && <span className="db-status-badge db-status-phone text-[10px]">{offer.pto_days}d PTO</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* ── All salary data ── */}
        {allWithSalary.length > 0 && allWithSalary.length !== offers.length && (
          <section>
            <h2 className="db-headline text-xl font-semibold text-[#1a1c1b] mb-4">All Salary Information</h2>
            <div className="db-content-card space-y-2">
              {allWithSalary.map((item) => (
                <div key={item.id} className="db-app-row">
                  <div className="flex items-center justify-between gap-4 w-full">
                    <div>
                      <Link href={`/applications/${item.application_id}`} className="font-semibold text-[#99462a] hover:underline text-sm">
                        {item.job_applications?.company}
                      </Link>
                      <p className="text-xs text-[#55433d]/70">{item.job_applications?.position}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-[#1a1c1b] text-sm">{formatSalary(item.base_salary)}</p>
                      <p className="text-xs text-[#55433d]/60">{item.job_applications?.status}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
