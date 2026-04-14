"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { computeCompleteness, completenessColor } from "@/lib/utils/completeness";
import { cn } from "@/lib/utils";
import type { JobApplication } from "@/types";

interface Props { applicationId: string }

const RING_SIZE = 52;
const RING_STROKE = 5;

export function CompletenessCard({ applicationId }: Props) {
  const [app, setApp] = useState<JobApplication | null>(null);

  function load(cancelled: { current: boolean }) {
    createClient()
      .from("job_applications")
      .select("*")
      .eq("id", applicationId)
      .single()
      .then(({ data }) => {
        if (!cancelled.current && data) setApp(data as JobApplication);
      });
  }

  useEffect(() => {
    const cancelled = { current: false };
    load(cancelled);
    return () => { cancelled.current = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId]);

  // Re-fetches on tab focus so data reflects any edits made on other pages
  useEffect(() => {
    const handler = () => {
      if (!document.hidden) {
        const cancelled = { current: false };
        load(cancelled);
      }
    };
    document.addEventListener("visibilitychange", handler);
    window.addEventListener("focus", handler);
    return () => {
      document.removeEventListener("visibilitychange", handler);
      window.removeEventListener("focus", handler);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId]);

  if (!app) {
    return (
      <section className="db-content-card space-y-3 animate-pulse">
        <div className="h-4 w-36 rounded bg-muted" />
        <div className="flex items-center gap-3">
          <div className="h-13 w-13 rounded-full bg-muted shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-24 rounded bg-muted" />
            <div className="h-2.5 w-16 rounded bg-muted" />
          </div>
        </div>
      </section>
    );
  }

  const { score, total, missing } = computeCompleteness(app);
  const level = completenessColor(score);
  const pct = (score / total) * 100;

  const r = (RING_SIZE - RING_STROKE * 2) / 2;
  const cx = RING_SIZE / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  const strokeColor =
    level === "emerald" ? "#10b981"
    : level === "amber"  ? "#f59e0b"
    : "#ef4444";

  const textColor =
    level === "emerald" ? "text-emerald-500"
    : level === "amber"  ? "text-amber-500"
    : "text-red-500";

  const allFields: { label: string; met: boolean }[] = [
    { label: "Resume uploaded",  met: !!app.resume_path },
    { label: "Cover letter",     met: !!app.cover_letter_path },
    { label: "Job description",  met: !!app.job_description },
    { label: "Salary range",     met: !!app.salary_range },
    { label: "Job URL",          met: !!app.job_url },
    { label: "Location",         met: !!app.location },
    { label: "Source",           met: !!app.source },
    { label: "Notes",            met: !!app.notes },
    { label: "Job ID",           met: !!app.job_id },
    { label: "ATS scan run",     met: app.ats_score !== null && app.ats_score !== undefined },
  ];

  return (
    <section className="db-content-card">
      {/* Header: ring + label inline */}
      <div className="flex items-center gap-3 mb-3">
        <div className="relative shrink-0">
          <svg width={RING_SIZE} height={RING_SIZE} className="-rotate-90" aria-hidden="true">
            <circle cx={cx} cy={cx} r={r} fill="none" stroke="currentColor"
              strokeWidth={RING_STROKE} className="text-border/30" />
            <circle cx={cx} cy={cx} r={r} fill="none"
              stroke={strokeColor} strokeWidth={RING_STROKE} strokeLinecap="round"
              strokeDasharray={`${dash} ${circ}`}
              className="completeness-ring-progress" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn("text-base font-bold tabular-nums leading-none", textColor)}>{score}</span>
            <span className="text-[9px] text-muted-foreground leading-none mt-0.5">/{total}</span>
          </div>
        </div>

        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground leading-tight">
            {score === total ? "Complete ✓" : score >= 7 ? "Almost there" : score >= 4 ? "Halfway" : "Needs work"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {missing.length === 0
              ? "All fields filled"
              : `${missing.length} of ${total} fields missing`}
          </p>
        </div>
      </div>

      {/* Compact two-column checklist */}
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {allFields.map(({ label, met }) => (
          <li key={label} className="flex items-center gap-1.5">
            {met
              ? <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-500" />
              : <Circle className="h-3 w-3 shrink-0 text-muted-foreground/30" />
            }
            <span className={cn("text-xs truncate", met ? "text-foreground" : "text-muted-foreground/50")}>
              {label}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
