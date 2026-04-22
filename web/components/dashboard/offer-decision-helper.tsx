"use client";

import { useState, useMemo } from "react";
import { Scale, Plus, X, TrendingUp, MapPin, Heart, Star, Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SalaryDetails } from "@/types";

// Inlined from services/salary — cannot import the service module in a client
// component because it transitively pulls in @/lib/supabase/server.
function formatSalary(amount: number | null, currency = "USD"): string {
  if (!amount) return "N/A";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}
/** Exported for unit testing. */
export function calcTC(s: Pick<SalaryDetails, "base_salary" | "bonus" | "signing_bonus">): number {
  return (s.base_salary || 0) + (s.bonus || 0) + (s.signing_bonus || 0);
}

type OfferRow = SalaryDetails & { job_applications: { company: string; position: string; status: string } };

interface Props { offers: OfferRow[] }

// ── Criteria definition ───────────────────────────────────────────────────────

const CRITERIA = [
  { key: "comp",     label: "Total Comp",       icon: Coins,      hint: "Salary, bonus, equity, signing" },
  { key: "growth",   label: "Career Growth",    icon: TrendingUp, hint: "Learning, title, scope" },
  { key: "location", label: "Location/Remote",  icon: MapPin,     hint: "Commute, WFH flexibility" },
  { key: "culture",  label: "Culture Fit",      icon: Heart,      hint: "Team, values, management" },
  { key: "benefits", label: "Benefits",         icon: Star,       hint: "Health, PTO, perks" },
] as const;

type CriterionKey = (typeof CRITERIA)[number]["key"];

const DEFAULT_WEIGHTS: Record<CriterionKey, number> = {
  comp: 35, growth: 25, location: 15, culture: 15, benefits: 10,
};

const DEFAULT_RATINGS: Record<CriterionKey, number> = {
  comp: 5, growth: 5, location: 5, culture: 5, benefits: 5,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Exported for unit testing. */
export function weightedScore(
  ratings: Record<CriterionKey, number>,
  weights: Record<CriterionKey, number>
): number {
  const totalWeight = Object.values(weights).reduce((s, w) => s + w, 0);
  if (totalWeight === 0) return 0;
  const raw = CRITERIA.reduce(
    (s, c) => s + (ratings[c.key] / 10) * weights[c.key],
    0
  );
  return Math.round((raw / totalWeight) * 100);
}

function scoreColor(score: number) {
  if (score >= 70) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function scoreBg(score: number) {
  if (score >= 70) return "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800";
  if (score >= 50) return "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800";
  return "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800";
}

// ── Winner callout sub-component ─────────────────────────────────────────────

function WinnerCallout({
  selected,
  getRatings,
  weights,
}: {
  selected: OfferRow[];
  getRatings: (id: string) => Record<CriterionKey, number>;
  weights: Record<CriterionKey, number>;
}) {
  const scored = [...selected]
    .map((o) => ({ o, score: weightedScore(getRatings(o.id), weights) }))
    .sort((a, b) => b.score - a.score);
  const winner = scored[0];
  const isTie  = winner.score === scored[1].score;

  if (isTie) {
    return (
      <p className="text-xs text-center text-muted-foreground">
        It&apos;s a tie! Adjust the weights or ratings to break it.
      </p>
    );
  }
  return (
    <p className="text-xs text-center text-muted-foreground">
      Based on your ratings and weights,{" "}
      <span className="font-semibold text-foreground">{winner.o.job_applications.company}</span>{" "}
      scores highest at{" "}
      <span className={cn("font-bold", scoreColor(winner.score))}>{winner.score}</span>.
    </p>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function OfferDecisionHelper({ offers }: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [ratings, setRatings] = useState<Record<string, Record<CriterionKey, number>>>({});
  const [weights, setWeights] = useState<Record<CriterionKey, number>>(DEFAULT_WEIGHTS);

  const totalWeight = Object.values(weights).reduce((s, w) => s + w, 0);

  const selected = useMemo(
    () => offers.filter((o) => selectedIds.includes(o.id)),
    [offers, selectedIds]
  );

  function getRatings(id: string): Record<CriterionKey, number> {
    return ratings[id] ?? { ...DEFAULT_RATINGS };
  }

  function setRating(id: string, key: CriterionKey, val: number) {
    setRatings((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? DEFAULT_RATINGS), [key]: val },
    }));
  }

  function toggleOffer(id: string) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return prev; // max 3
      return [...prev, id];
    });
  }

  if (offers.length === 0) {
    return (
      <section className="db-content-card flex flex-col items-center py-10 text-center gap-3">
        <Scale className="h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm font-medium text-muted-foreground">No offers to compare yet</p>
        <p className="text-xs text-muted-foreground/70">
          Add salary details to applications with Offer or Accepted status to use this tool.
        </p>
      </section>
    );
  }

  return (
    <section className="db-content-card space-y-6">
      <div>
        <h2 className="db-headline text-xl font-semibold text-foreground flex items-center gap-2">
          <Scale className="h-5 w-5 text-[#99462a] dark:text-[#ccff00]" />
          Offer Decision Helper
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Select up to 3 offers, rate each criterion, adjust weights — get a weighted score to guide your decision.
        </p>
      </div>

      {/* ── Offer picker ── */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
          Select offers to compare ({selectedIds.length}/3)
        </p>
        <div className="flex flex-wrap gap-2">
          {offers.map((o) => {
            const isSelected = selectedIds.includes(o.id);
            const tc = calcTC(o);
            return (
              <button
                key={o.id}
                type="button"
                disabled={!isSelected && selectedIds.length >= 3}
                onClick={() => toggleOffer(o.id)}
                className={cn(
                  "flex items-center gap-2 text-xs px-3 py-2 rounded-xl border transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
                  isSelected
                    ? "border-[#99462a] bg-[#99462a]/8 text-[#99462a] dark:border-[#ccff00] dark:bg-[#ccff00]/8 dark:text-[#ccff00]"
                    : "border-border text-muted-foreground hover:border-[#99462a]/40 hover:text-foreground"
                )}
              >
                {isSelected ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                <span className="font-semibold">{o.job_applications.company}</span>
                {tc > 0 && <span className="text-[10px] opacity-70">{formatSalary(tc, o.currency)}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {selected.length > 0 && (
        <>
          {/* ── Criteria weights ── */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
              Adjust what matters to you
              {totalWeight !== 100 && (
                <span className="ml-2 text-amber-600 dark:text-amber-400 normal-case font-normal">
                  (weights sum to {totalWeight}% — adjust to 100% for best results)
                </span>
              )}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
              {CRITERIA.map((c) => (
                <div key={c.key} className="flex items-center gap-3">
                  <c.icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs text-foreground w-28 shrink-0">{c.label}</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={weights[c.key]}
                    onChange={(e) =>
                      setWeights((w) => ({ ...w, [c.key]: Number(e.target.value) }))
                    }
                    aria-label={`${c.label} weight`}
                    title={`${c.label} importance weight`}
                    className="flex-1 accent-[#99462a] dark:accent-[#ccff00] h-1"
                  />
                  <span className="text-xs tabular-nums text-muted-foreground w-8 text-right shrink-0">
                    {weights[c.key]}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Side-by-side comparison ── */}
          <div className={cn(
            "grid gap-4",
            selected.length === 1 ? "grid-cols-1 max-w-sm" :
            selected.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3"
          )}>
            {selected.map((offer) => {
              const r = getRatings(offer.id);
              const score = weightedScore(r, weights);
              const tc = calcTC(offer);

              return (
                <div key={offer.id} className={cn(
                  "rounded-xl border p-4 space-y-4",
                  scoreBg(score)
                )}>
                  {/* Header */}
                  <div>
                    <p className="font-bold text-sm text-foreground truncate">
                      {offer.job_applications.company}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {offer.job_applications.position}
                    </p>
                    {tc > 0 && (
                      <p className="text-xs font-semibold text-foreground mt-1">
                        {formatSalary(tc, offer.currency)} TC
                      </p>
                    )}
                  </div>

                  {/* Score */}
                  <div className="text-center">
                    <p className={cn("text-4xl font-bold tabular-nums", scoreColor(score))}>
                      {score}
                    </p>
                    <p className="text-[10px] text-muted-foreground">weighted score</p>
                  </div>

                  {/* Per-criterion sliders */}
                  <div className="space-y-3">
                    {CRITERIA.map((c) => (
                      <div key={c.key}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <c.icon className="h-2.5 w-2.5" />
                            {c.label}
                          </span>
                          <span className="text-[10px] font-semibold tabular-nums text-foreground">
                            {r[c.key]}/10
                          </span>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={10}
                          step={1}
                          value={r[c.key]}
                          onChange={(e) => setRating(offer.id, c.key, Number(e.target.value))}
                          aria-label={`${c.label} rating for ${offer.job_applications.company}`}
                          title={c.hint}
                          className="w-full accent-[#99462a] dark:accent-[#ccff00] h-1"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Winner callout ── */}
          {selected.length > 1 && <WinnerCallout selected={selected} getRatings={getRatings} weights={weights} />}
        </>
      )}
    </section>
  );
}
