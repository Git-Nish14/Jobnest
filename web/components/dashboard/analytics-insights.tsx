import { Activity, Clock, Ghost, Target, TrendingUp, Zap } from "lucide-react";
import { InsightCard, type InsightCardProps } from "./insight-card";

interface Props {
  averageTimeToResponse: number | null;
  interviewToOfferRate: number | null;
  ghostRate: number | null;
  totalApplications: number;
  activePipeline: number;
  weeklyMomentum: number | null;
  topSource: { source: string; responseRate: number } | null;
}

/** Renders context-aware insight cards for the six richer analytics metrics.
 *  Hidden entirely when the user has no applications. */
export function AnalyticsInsights({
  averageTimeToResponse,
  interviewToOfferRate,
  ghostRate,
  totalApplications,
  activePipeline,
  weeklyMomentum,
  topSource,
}: Props) {
  if (totalApplications < 1) return null;

  // ── Response time card ──────────────────────────────────────────────────
  const responseValue = averageTimeToResponse != null ? `${averageTimeToResponse}d` : "—";
  const responseTone  = averageTimeToResponse == null  ? "dim"
    : averageTimeToResponse <= 14 ? "positive"
    : averageTimeToResponse <= 30 ? "neutral"
    : "warning";
  const responseSub = averageTimeToResponse == null
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
  const conversionSub = interviewToOfferRate == null
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
  const ghostSub = ghostRate == null
    ? "Need ≥5 applications to calculate."
    : ghostRate <= 10
      ? "Low ghosting rate — most companies are responding. Includes Applied apps silent for 30+ days."
      : ghostRate <= 25
        ? "Typical rate for the current market. Includes Applied apps silent for 30+ days."
        : "High ghosting rate. Target companies with faster hiring cycles. Includes Applied apps silent for 30+ days.";

  // ── Active pipeline card ────────────────────────────────────────────────
  const activePipelineValue = activePipeline.toString().padStart(2, "0");
  const activePipelineTone: InsightCardProps["tone"] = activePipeline === 0 ? "dim"
    : activePipeline >= 4 ? "positive"
    : "neutral";
  const activePipelineSub = activePipeline === 0
    ? "No active conversations. Focus on landing your first phone screen."
    : activePipeline === 1
      ? "One live opportunity — stay sharp and keep applying in parallel."
      : activePipeline <= 3
        ? "You're in active conversations. Stay prepared and follow up promptly."
        : "Strong pipeline. Prioritise your most promising conversations.";

  // ── Weekly momentum card ────────────────────────────────────────────────
  const momentumValue = weeklyMomentum == null ? "—"
    : weeklyMomentum > 0 ? `+${weeklyMomentum}%`
    : `${weeklyMomentum}%`;
  const momentumTone: InsightCardProps["tone"] = weeklyMomentum == null ? "dim"
    : weeklyMomentum > 0  ? "positive"
    : weeklyMomentum === 0 ? "neutral"
    : "warning";
  const momentumSub = weeklyMomentum == null
    ? "Need 4+ weeks of application history to calculate momentum."
    : weeklyMomentum >= 500
      ? "Exceptional burst this week — way above your trailing average. Don't burn out; sustain the quality."
      : weeklyMomentum > 20
        ? "Strong acceleration vs your 4-week average — maintain the pace."
        : weeklyMomentum > 0
          ? "Slightly above your average. Small consistent gains compound over time."
          : weeklyMomentum === 0
            ? "Matching your 4-week average. Consider pushing a little harder this week."
            : "Below your recent average. Re-energise your search — even 2–3 extra apps helps.";

  // ── Top source card ─────────────────────────────────────────────────────
  const topSourceValue = topSource?.source ?? "—";
  const topSourceTone: InsightCardProps["tone"] = topSource == null ? "dim" : "positive";
  const topSourceSub = topSource == null
    ? "Need applications from ≥2 different sources to identify your best channel."
    : `${topSource.responseRate}% response rate — your highest-performing channel. Double down here.`;

  return (
    <section className="db-content-card">
      <div className="mb-5">
        <h2 className="db-headline text-lg font-semibold text-foreground">Search Intelligence</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Derived from your {totalApplications} application{totalApplications !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
        <InsightCard
          icon={<Zap className="h-3.5 w-3.5" />}
          label="Live opportunities"
          value={activePipelineValue}
          sub={activePipelineSub}
          tone={activePipelineTone}
        />
        <InsightCard
          icon={<Activity className="h-3.5 w-3.5" />}
          label="Weekly momentum"
          value={momentumValue}
          sub={momentumSub}
          tone={momentumTone}
        />
        <InsightCard
          icon={<Target className="h-3.5 w-3.5" />}
          label="Best source"
          value={topSourceValue}
          sub={topSourceSub}
          tone={topSourceTone}
        />
      </div>
    </section>
  );
}
