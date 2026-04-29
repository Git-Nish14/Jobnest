/**
 * Unit tests — lib/utils/salary-helpers.ts
 *
 * Covers:
 *   computeBenefitsDollarValue — boolean flags → dollar values
 *   compute401kMatch — match percent/cap arithmetic, null guards
 *   computeVestingSchedule — cliff + monthly vesting over 4 years
 *   computeAnnualEquityValue — year-1 value, null/missing details
 *   computeEffectiveHourlyRate — TC ÷ (hours − PTO), edge cases
 *   computeFullTC — integration: all components summed correctly
 *   BENEFIT_VALUES — static constants
 */
import { describe, it, expect } from "vitest";
import {
  BENEFIT_VALUES,
  computeBenefitsDollarValue,
  compute401kMatch,
  computeVestingSchedule,
  computeAnnualEquityValue,
  computeEffectiveHourlyRate,
  computeFullTC,
} from "@/lib/utils/salary-helpers";
import type { SalaryDetails, RSUEquityDetails } from "@/types";

// ── Fixture helpers ────────────────────────────────────────────────────────────

function makeSalary(overrides: Partial<SalaryDetails> = {}): SalaryDetails {
  return {
    id: "s1",
    application_id: "a1",
    base_salary: 100_000,
    currency: "USD",
    salary_type: "yearly",
    bonus: null,
    equity: null,
    equity_details: null,
    signing_bonus: null,
    health_insurance: false,
    dental_insurance: false,
    vision_insurance: false,
    retirement_401k: false,
    retirement_match: null,
    retirement_match_percent: null,
    retirement_match_cap: null,
    pto_days: null,
    remote_work: null,
    other_benefits: null,
    initial_offer: null,
    final_offer: null,
    negotiation_notes: null,
    state_of_work: null,
    annual_hours_worked: 2080,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeEquity(overrides: Partial<RSUEquityDetails> = {}): RSUEquityDetails {
  return {
    total_shares: 1_000,
    grant_date: "2026-01-01",
    cliff_months: 12,
    vest_months: 48,
    current_price: 100,
    ...overrides,
  };
}

// ── BENEFIT_VALUES ─────────────────────────────────────────────────────────────

describe("BENEFIT_VALUES", () => {
  it("health_insurance is 7200", () => expect(BENEFIT_VALUES.health_insurance).toBe(7_200));
  it("dental_insurance is 500",  () => expect(BENEFIT_VALUES.dental_insurance).toBe(500));
  it("vision_insurance is 200",  () => expect(BENEFIT_VALUES.vision_insurance).toBe(200));
});

// ── computeBenefitsDollarValue ─────────────────────────────────────────────────

describe("computeBenefitsDollarValue", () => {
  it("returns 0 when no benefits selected", () => {
    expect(computeBenefitsDollarValue(makeSalary())).toBe(0);
  });

  it("adds health_insurance only", () => {
    expect(computeBenefitsDollarValue(makeSalary({ health_insurance: true }))).toBe(7_200);
  });

  it("adds dental_insurance only", () => {
    expect(computeBenefitsDollarValue(makeSalary({ dental_insurance: true }))).toBe(500);
  });

  it("adds vision_insurance only", () => {
    expect(computeBenefitsDollarValue(makeSalary({ vision_insurance: true }))).toBe(200);
  });

  it("sums all three benefits", () => {
    const s = makeSalary({ health_insurance: true, dental_insurance: true, vision_insurance: true });
    expect(computeBenefitsDollarValue(s)).toBe(7_200 + 500 + 200);
  });

  it("ignores 401k flag (401k match computed separately)", () => {
    const s = makeSalary({ retirement_401k: true });
    expect(computeBenefitsDollarValue(s)).toBe(0);
  });
});

// ── compute401kMatch ──────────────────────────────────────────────────────────

describe("compute401kMatch", () => {
  it("returns 0 when base_salary is null", () => {
    expect(compute401kMatch(makeSalary({ base_salary: null, retirement_match_percent: 4 }))).toBe(0);
  });

  it("returns 0 when match_percent is null", () => {
    expect(compute401kMatch(makeSalary({ base_salary: 100_000, retirement_match_percent: null }))).toBe(0);
  });

  it("returns 0 when match_percent is 0", () => {
    expect(compute401kMatch(makeSalary({ base_salary: 100_000, retirement_match_percent: 0 }))).toBe(0);
  });

  it("computes basic match: 4% of $100k = $4000", () => {
    expect(compute401kMatch(makeSalary({ base_salary: 100_000, retirement_match_percent: 4 }))).toBe(4_000);
  });

  it("applies cap: match=6%, cap=4% of $100k → $4000 (not $6000)", () => {
    expect(
      compute401kMatch(makeSalary({ base_salary: 100_000, retirement_match_percent: 6, retirement_match_cap: 4 }))
    ).toBe(4_000);
  });

  it("cap equals match → result is same as uncapped", () => {
    expect(
      compute401kMatch(makeSalary({ base_salary: 100_000, retirement_match_percent: 4, retirement_match_cap: 4 }))
    ).toBe(4_000);
  });

  it("cap higher than match → match rate wins", () => {
    expect(
      compute401kMatch(makeSalary({ base_salary: 100_000, retirement_match_percent: 3, retirement_match_cap: 6 }))
    ).toBe(3_000);
  });

  it("when cap is null defaults to match percent (no cap)", () => {
    expect(
      compute401kMatch(makeSalary({ base_salary: 100_000, retirement_match_percent: 5, retirement_match_cap: null }))
    ).toBe(5_000);
  });
});

// ── computeVestingSchedule ────────────────────────────────────────────────────

describe("computeVestingSchedule", () => {
  it("standard 1yr cliff / 4yr vest: 1000 shares at $100 → Year 1 = $25,000", () => {
    const schedule = computeVestingSchedule(makeEquity());
    expect(schedule[0].value).toBe(25_000);  // 250 shares × $100
  });

  it("standard 1yr cliff / 4yr vest: 4 years total shares equals total_shares", () => {
    const schedule = computeVestingSchedule(makeEquity());
    const total = schedule.reduce((s, r) => s + r.sharesVested, 0);
    expect(total).toBe(1_000);
  });

  it("returns exactly 4 year entries", () => {
    const schedule = computeVestingSchedule(makeEquity());
    expect(schedule).toHaveLength(4);
    expect(schedule.map((r) => r.year)).toEqual([1, 2, 3, 4]);
  });

  it("year 1 = cliff shares (25% at 12 months)", () => {
    const schedule = computeVestingSchedule(makeEquity());
    expect(schedule[0].sharesVested).toBe(250); // 1000 × (12/48)
  });

  it("years 2–4 share remaining 750 shares roughly equally", () => {
    const schedule = computeVestingSchedule(makeEquity());
    const remaining = schedule[1].sharesVested + schedule[2].sharesVested + schedule[3].sharesVested;
    expect(remaining).toBe(750);
  });

  it("higher stock price scales value proportionally", () => {
    const s200 = computeVestingSchedule(makeEquity({ current_price: 200 }));
    const s100 = computeVestingSchedule(makeEquity({ current_price: 100 }));
    expect(s200[0].value).toBe(s100[0].value * 2);
  });

  it("2yr cliff / 4yr vest: Year 1 and Year 2 vest = cliff shares split at month 24", () => {
    const schedule = computeVestingSchedule(makeEquity({ cliff_months: 24, vest_months: 48 }));
    // cliff at month 24 = end of Year 2; Year 1 should have 0 shares
    expect(schedule[0].sharesVested).toBe(0);
    expect(schedule[1].sharesVested).toBeGreaterThan(0);
  });
});

// ── computeAnnualEquityValue ──────────────────────────────────────────────────

describe("computeAnnualEquityValue", () => {
  it("returns 0 for null equity_details", () => {
    expect(computeAnnualEquityValue(null)).toBe(0);
  });

  it("returns 0 for undefined equity_details", () => {
    expect(computeAnnualEquityValue(undefined)).toBe(0);
  });

  it("returns 0 when total_shares is 0", () => {
    expect(computeAnnualEquityValue(makeEquity({ total_shares: 0 }))).toBe(0);
  });

  it("returns 0 when current_price is 0", () => {
    expect(computeAnnualEquityValue(makeEquity({ current_price: 0 }))).toBe(0);
  });

  it("returns Year 1 vesting value for valid details", () => {
    // 1000 shares, 12mo cliff/48mo vest, $100 → Year 1 = 250 × $100 = $25,000
    expect(computeAnnualEquityValue(makeEquity())).toBe(25_000);
  });
});

// ── computeEffectiveHourlyRate ────────────────────────────────────────────────

describe("computeEffectiveHourlyRate", () => {
  it("basic: $100k TC / 2080 hours ≈ $48.08/hr", () => {
    const rate = computeEffectiveHourlyRate(100_000, 2080, null);
    expect(rate).toBeCloseTo(48.08, 1);
  });

  it("subtracts PTO days (×8hrs each) from denominator", () => {
    // 2080 − (20 days × 8 hrs) = 1920 work hours
    const rate = computeEffectiveHourlyRate(100_000, 2080, 20);
    expect(rate).toBeCloseTo(100_000 / 1920, 4);
  });

  it("null pto_days treated as 0 PTO", () => {
    const withNull = computeEffectiveHourlyRate(100_000, 2080, null);
    const withZero = computeEffectiveHourlyRate(100_000, 2080, 0);
    expect(withNull).toBe(withZero);
  });

  it("does not divide by zero when PTO exceeds work hours (clamps to 1)", () => {
    // 260 PTO days × 8 = 2080 hrs, leaving 0 — should clamp denominator to 1
    const rate = computeEffectiveHourlyRate(100_000, 2080, 260);
    expect(Number.isFinite(rate)).toBe(true);
    expect(rate).toBeGreaterThan(0);
  });
});

// ── computeFullTC ─────────────────────────────────────────────────────────────

describe("computeFullTC", () => {
  it("all-null salary → total is 0", () => {
    const { total } = computeFullTC(makeSalary({ base_salary: null }));
    expect(total).toBe(0);
  });

  it("base only", () => {
    const { total, base } = computeFullTC(makeSalary({ base_salary: 100_000 }));
    expect(base).toBe(100_000);
    expect(total).toBe(100_000);
  });

  it("base + bonus + signing", () => {
    const { total } = computeFullTC(makeSalary({ base_salary: 100_000, bonus: 10_000, signing_bonus: 5_000 }));
    expect(total).toBe(115_000);
  });

  it("includes equity_annual in total", () => {
    const { total, equityAnnual } = computeFullTC(
      makeSalary({ base_salary: 100_000, equity_details: makeEquity() })
    );
    expect(equityAnnual).toBe(25_000);
    expect(total).toBe(125_000);
  });

  it("includes 401k match in total", () => {
    const { total, match401k } = computeFullTC(
      makeSalary({ base_salary: 100_000, retirement_match_percent: 4 })
    );
    expect(match401k).toBe(4_000);
    expect(total).toBe(104_000);
  });

  it("includes benefits value in total", () => {
    const { total, benefits } = computeFullTC(
      makeSalary({ base_salary: 100_000, health_insurance: true })
    );
    expect(benefits).toBe(7_200);
    expect(total).toBe(107_200);
  });

  it("all components sum correctly", () => {
    const s = makeSalary({
      base_salary: 100_000,
      bonus: 10_000,
      signing_bonus: 5_000,
      equity_details: makeEquity(),         // +25,000
      retirement_match_percent: 4,          // +4,000
      health_insurance: true,               // +7,200
      dental_insurance: true,               // +500
    });
    const { total } = computeFullTC(s);
    expect(total).toBe(100_000 + 10_000 + 5_000 + 25_000 + 4_000 + 7_200 + 500);
  });

  it("breakdown components sum to total", () => {
    const s = makeSalary({
      base_salary: 120_000,
      bonus: 15_000,
      signing_bonus: 10_000,
      equity_details: makeEquity({ total_shares: 2_000, current_price: 150 }),
      retirement_match_percent: 5,
      health_insurance: true,
      dental_insurance: true,
      vision_insurance: true,
    });
    const { base, bonus, signing, equityAnnual, match401k, benefits, total } = computeFullTC(s);
    expect(base + bonus + signing + equityAnnual + match401k + benefits).toBe(total);
  });
});
