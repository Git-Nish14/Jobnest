import type { SalaryDetails, RSUEquityDetails } from "@/types";

// ── Benefits dollar values (IRS / KFF 2026 benchmarks) ────────────────────────
export const BENEFIT_VALUES = {
  health_insurance: 7_200,  // Average employer premium contribution, KFF 2025
  dental_insurance: 500,
  vision_insurance: 200,
} as const;

/** Sum dollar value of boolean benefits. 401k match is computed separately. */
export function computeBenefitsDollarValue(salary: SalaryDetails): number {
  let total = 0;
  if (salary.health_insurance) total += BENEFIT_VALUES.health_insurance;
  if (salary.dental_insurance)  total += BENEFIT_VALUES.dental_insurance;
  if (salary.vision_insurance)  total += BENEFIT_VALUES.vision_insurance;
  return total;
}

// ── 401(k) match ─────────────────────────────────────────────────────────────

/** Annual employer 401(k) match contribution in dollars. */
export function compute401kMatch(salary: SalaryDetails): number {
  const base = salary.base_salary ?? 0;
  const pct  = salary.retirement_match_percent ?? 0;
  const cap  = salary.retirement_match_cap ?? pct; // if no cap, default to pct
  if (!base || !pct) return 0;
  return Math.min((base * pct) / 100, (base * cap) / 100);
}

// ── RSU / Equity vesting schedule ────────────────────────────────────────────

export interface VestingYear {
  year: number;
  sharesVested: number;
  value: number;
}

/** Compute the first four grant years with a configurable cliff and monthly vesting. */
export function computeVestingSchedule(details: RSUEquityDetails): VestingYear[] {
  const { total_shares, cliff_months, vest_months, current_price } = details;
  if (![total_shares, cliff_months, vest_months, current_price].every(Number.isFinite)
    || total_shares <= 0 || current_price < 0 || vest_months <= 0
    || cliff_months < 0 || cliff_months > vest_months) return [];
  const cumulative = (month: number) => month < cliff_months ? 0
    : total_shares * Math.min(month, vest_months) / vest_months;
  return Array.from({ length: 4 }, (_, index) => {
    const shares = cumulative((index + 1) * 12) - cumulative(index * 12);
    return { year: index + 1, sharesVested: Math.round(shares * 1e6) / 1e6,
      value: Math.round(shares * current_price * 100) / 100 };
  });
}

/** Annual equity value = Year-1 vest value (standard for TC comparison). */
export function computeAnnualEquityValue(details: RSUEquityDetails | null | undefined): number {
  if (!details?.total_shares || !details?.current_price) return 0;
  const schedule = computeVestingSchedule(details);
  return schedule[0]?.value ?? 0;
}

// ── Effective hourly rate ─────────────────────────────────────────────────────

/** Effective hourly rate = TC ÷ (annual_hours_worked − pto_hours). */
export function computeEffectiveHourlyRate(
  tc: number,
  annualHoursWorked: number,
  ptoDays: number | null
): number {
  const ptoHours   = (ptoDays ?? 0) * 8;
  const workHours  = Math.max(annualHoursWorked - ptoHours, 1);
  return tc / workHours;
}

// ── Full TC calculation ───────────────────────────────────────────────────────

export interface TCBreakdown {
  base: number;
  bonus: number;
  signing: number;
  equityAnnual: number;
  match401k: number;
  benefits: number;
  total: number;
}

export function computeFullTC(salary: SalaryDetails): TCBreakdown {
  const base         = salary.base_salary ?? 0;
  const bonus        = salary.bonus ?? 0;
  const signing      = salary.signing_bonus ?? 0;
  const equityAnnual = computeAnnualEquityValue(salary.equity_details);
  const match401k    = compute401kMatch(salary);
  const benefits     = computeBenefitsDollarValue(salary);
  const total        = base + bonus + signing + equityAnnual + match401k + benefits;
  return { base, bonus, signing, equityAnnual, match401k, benefits, total };
}
