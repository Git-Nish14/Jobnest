import { Clock, TrendingUp, Ghost } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  averageTimeToResponse: number | null;
  interviewToOfferRate: number | null;
  ghostRate: number | null;
  totalApplications: number;
}

interface InsightCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  tone: "positive" | "neutral" | "warning" | "dim";
}

function InsightCard({ icon, label, value, sub, tone }: InsightCardProps) {
  const toneClasses = {
    positive: "text-emerald-600 dark:text-emerald-400",
    neutral:  "text-[#99462a] dark:text-[#ccff00]",
    warning:  "text-amber-600 dark:text-amber-400",
    dim:      "text-muted-foreground",
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-[#f4f3f1]/60 dark:bg-[#0f0f0f] px-5 py-4">
      <div className={cn("flex items-center gap-2 text-xs font-semibold uppercase tracking-widest", toneClasses[tone])}>
        {icon}
        {label}
      </div>
      <div>
        <p className={cn("text-3xl font-bold leading-none tabular-nums", toneClasses[tone])}>
          {value}
        </p>
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{sub}</p>
      </div>
    </div>
  );
}

/** Renders context-aware insight cards for the three richer analytics metrics.
 *  Hidden entirely when the user has fewer than 3 applications — numbers
 *  aren't meaningful yet and "0 / 0" would be misleading. */
export function AnalyticsInsights({
  averageTimeToResponse,
  interviewToOfferRate,
  ghostRate,
  totalApplications,
}: Props) {
  // Don't render on a completely empty dashboard — the empty-state UI is more appropriate there.
  if (totalApplications < 1) return null;

  // ── Response time card ──────────────────────────────────────────────────
  const responseValue  = averageTimeToResponse != null ? `${averageTimeToResponse}d` : "—";
  const responseTone   = averageTimeToResponse == null  ? "dim"
    : averageTimeToResponse <= 14 ? "positive"
    : averageTimeToResponse <= 30 ? "neutral"
    : "warning";
  const responseSub    = averageTimeToResponse == null
    ? "Need responses from ≥2 applications to calculate."
    : averageTimeToResponse <= 14
      ? "Strong response velocity — companies are engaging quickly."
      : averageTimeToResponse <= 30
        ? "Typical range. Consider following up on older applications."
        : "Longer than average. Review application quality or targeting.";

  // ── Interview → Offer rate card ─────────────────────────────────────────
  const conversionValue = interviewToOfferRate != null ? `${interviewToOfferRate}%` : "—";
  const conversionTone  = interviewToOfferRate == null  ? "dim"
    : interviewToOfferRate >= 30 ? "positive"
    : interviewToOfferRate >= 15 ? "neutral"
    : "warning";
  const conversionSub   = interviewToOfferRate == null
    ? "Need ≥3 applications at interview stage to calculate."
    : interviewToOfferRate >= 30
      ? "Excellent conversion — you're closing interviews well."
      : interviewToOfferRate >= 15
        ? "Solid rate. Focus on final-round preparation."
        : "Low conversion from interview to offer. Review your negotiation and final-round prep.";

  // ── Ghost rate card ─────────────────────────────────────────────────────
  const ghostValue = ghostRate != null ? `${ghostRate}%` : "—";
  const ghostTone  = ghostRate == null  ? "dim"
    : ghostRate <= 10 ? "positive"
    : ghostRate <= 25 ? "neutral"
    : "warning";
  const ghostSub   = ghostRate == null
    ? "Need ≥5 applications to calculate."
    : ghostRate <= 10
      ? "Low ghosting rate — most companies are responding."
      : ghostRate <= 25
        ? "Typical ghosting rate for the current market."
        : "High ghosting rate. Consider targeting companies with faster hiring cycles.";

  return (
    <section className="db-content-card">
      <div className="mb-5">
        <h2 className="db-headline text-lg font-semibold text-foreground">Search Intelligence</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Derived from your {totalApplications} application{totalApplications !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <InsightCard
          icon={<Clock className="h-3.5 w-3.5" />}
          label="Avg. response time"
          value={responseValue}
          sub={responseSub}
          tone={responseTone}
        />
        <InsightCard
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          label="Interview → Offer"
          value={conversionValue}
          sub={conversionSub}
          tone={conversionTone}
        />
        <InsightCard
          icon={<Ghost className="h-3.5 w-3.5" />}
          label="Ghosting rate"
          value={ghostValue}
          sub={ghostSub}
          tone={ghostTone}
        />
      </div>
    </section>
  );
}
