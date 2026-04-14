import type { JobApplication } from "@/types";

export interface CompletenessResult {
  score: number;   // 0–10
  total: 10;
  missing: string[];
  pct: number;     // 0–100
}

const CHECKS: { label: string; met: (a: JobApplication) => boolean }[] = [
  { label: "Resume uploaded",   met: (a) => !!a.resume_path },
  { label: "Cover letter",      met: (a) => !!a.cover_letter_path },
  { label: "Job description",   met: (a) => !!a.job_description },
  { label: "Salary range",      met: (a) => !!a.salary_range },
  { label: "Job URL",           met: (a) => !!a.job_url },
  { label: "Location",          met: (a) => !!a.location },
  { label: "Source",            met: (a) => !!a.source },
  { label: "Notes",             met: (a) => !!a.notes },
  { label: "Job ID",            met: (a) => !!a.job_id },
  { label: "ATS scan run",      met: (a) => a.ats_score !== null && a.ats_score !== undefined },
];

export function computeCompleteness(app: JobApplication): CompletenessResult {
  const results = CHECKS.map((c) => ({ label: c.label, met: c.met(app) }));
  const score = results.filter((r) => r.met).length as CompletenessResult["score"];
  const missing = results.filter((r) => !r.met).map((r) => r.label);
  return { score, total: 10, missing, pct: score * 10 };
}

/** Tailwind colour token based on completeness score */
export function completenessColor(score: number): "emerald" | "amber" | "red" {
  if (score >= 8) return "emerald";
  if (score >= 5) return "amber";
  return "red";
}
