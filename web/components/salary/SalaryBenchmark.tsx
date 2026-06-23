"use client";

import { useState, useMemo } from "react";
import { Info } from "lucide-react";
import { parseSalary } from "@/lib/utils/salary-parse";
import type { CompanyTier } from "@/types/application";

// 2026 US market data for entry-level / junior SWE (0–3 YOE)
// Source: Levels.fyi, LinkedIn Salary, Glassdoor aggregates
const MARKET: Record<string, { p25: number; p50: number; p75: number; label: string }> = {
  All:      { p25: 95_000,  p50: 130_000, p75: 165_000, label: "All tiers" },
  FAANG:    { p25: 155_000, p50: 185_000, p75: 220_000, label: "FAANG" },
  "Tier 1": { p25: 120_000, p50: 150_000, p75: 180_000, label: "Tier 1" },
  "Tier 2": { p25: 95_000,  p50: 120_000, p75: 145_000, label: "Tier 2" },
  Startup:  { p25: 75_000,  p50: 100_000, p75: 130_000, label: "Startup" },
};

const TIERS = ["All", "FAANG", "Tier 1", "Tier 2", "Startup"] as const;
type TierKey = typeof TIERS[number];

interface Application {
  salary_range: string | null;
  company_tier: CompanyTier | null;
}

interface Props {
  applications: Application[];
}

function fmtK(n: number) {
  return `$${Math.round(n / 1_000)}k`;
}

export function SalaryBenchmark({ applications }: Props) {
  const [activeTier, setActiveTier] = useState<TierKey>("All");

  const benchmark = MARKET[activeTier]!;

  // Compute user's average from applications matching the selected tier
  const userAvg = useMemo(() => {
    const filtered = activeTier === "All"
      ? applications
      : applications.filter((a) => a.company_tier === activeTier);
    const parsed = filtered.map((a) => parseSalary(a.salary_range)).filter((n): n is number => n !== null);
    if (parsed.length === 0) return null;
    return Math.round(parsed.reduce((s, n) => s + n, 0) / parsed.length);
  }, [applications, activeTier]);

  // Where the user's average falls on the P25–P75 range
  const userPct = useMemo(() => {
    if (userAvg == null) return null;
    const { p25, p75 } = benchmark;
    if (userAvg <= p25) return 0;
    if (userAvg >= p75) return 100;
    return Math.round(((userAvg - p25) / (p75 - p25)) * 100);
  }, [userAvg, benchmark]);

  const totalWithSalary = applications.filter((a) => a.salary_range).length;

  return (
    <div className="db-content-card">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="db-headline text-lg font-semibold text-foreground">Salary Benchmarking</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Your average vs. market range for entry-level SWE (0–3 YOE)
          </p>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1">
          <Info className="h-3 w-3" />
          <span>Levels.fyi · 2026</span>
        </div>
      </div>

      {/* Tier pills */}
      <div className="flex flex-wrap gap-1.5 mb-6" role="group" aria-label="Filter by company tier">
        {TIERS.map((tier) => (
          <button
            key={tier}
            type="button"
            onClick={() => setActiveTier(tier)}
            className={`rounded-full text-xs font-semibold px-2.5 py-1 transition-all duration-150 ${
              activeTier === tier
                ? "bg-[#99462a] text-white dark:bg-[#ccff00] dark:text-black shadow-sm"
                : "bg-[#f4f3f1] dark:bg-white/7 text-[#55433d] dark:text-white/55 hover:bg-[#e9e8e6] dark:hover:bg-white/12"
            }`}
          >
            {tier}
          </button>
        ))}
      </div>

      {/* Range visualisation */}
      <div className="space-y-3">
        {/* P25 – P75 range bar */}
        <div className="relative h-8">
          {/* Full track */}
          <div className="absolute inset-y-2 inset-x-0 rounded-full bg-[#dbc1b9]/25 dark:bg-white/8" />

          {/* P25–P75 filled range */}
          <div
            className="absolute inset-y-0 rounded-full bg-[#99462a]/15 dark:bg-[#ccff00]/10 border border-[#99462a]/20 dark:border-[#ccff00]/20 flex items-center"
            style={{ left: "0%", right: "0%" }}
          >
            {/* P25 marker */}
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[#99462a]/40 dark:bg-[#ccff00]/30 rounded-full" />
            {/* P50 marker */}
            <div className="absolute left-1/2 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[#99462a]/60 dark:bg-[#ccff00]/50 rounded-full" />
            {/* P75 marker */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[#99462a]/40 dark:bg-[#ccff00]/30 rounded-full" />
          </div>

          {/* User's average dot */}
          {userPct !== null && (
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-[#99462a] dark:bg-[#ccff00] shadow-md ring-2 ring-background z-10"
              style={{ left: `${userPct}%` }}
              title={`Your avg: ${fmtK(userAvg!)}`}
            />
          )}
        </div>

        {/* Range labels */}
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>{fmtK(benchmark.p25)} P25</span>
          <span className="font-semibold text-[#99462a] dark:text-[#ccff00]">{fmtK(benchmark.p50)} median</span>
          <span>{fmtK(benchmark.p75)} P75</span>
        </div>
      </div>

      {/* User stat */}
      <div className="mt-5 rounded-xl border border-border bg-[#f4f3f1]/60 dark:bg-[#0f0f0f] px-4 py-3">
        {userAvg != null ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                Your average ({benchmark.label})
              </p>
              <p className="text-2xl font-bold text-[#99462a] dark:text-[#ccff00] tabular-nums">
                {fmtK(userAvg)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground mb-1">vs. market median</p>
              <p className={`text-sm font-semibold ${
                userAvg >= benchmark.p50 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
              }`}>
                {userAvg >= benchmark.p50
                  ? `+${fmtK(userAvg - benchmark.p50)} above`
                  : `${fmtK(benchmark.p50 - userAvg)} below`
                }
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {totalWithSalary} application{totalWithSalary !== 1 ? "s" : ""} with salary data
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-1">
            Add salary ranges to applications to see your benchmark comparison.
          </p>
        )}
      </div>

      {/* Footnote */}
      <p className="text-[10px] text-muted-foreground/60 mt-3 leading-relaxed">
        Benchmarks: Levels.fyi / LinkedIn Salary 2026, entry-level SWE, US market. Based on listed salary ranges across your applications — not verified offers. Aggregated real-user benchmarks (Pro) coming soon.
      </p>
    </div>
  );
}
