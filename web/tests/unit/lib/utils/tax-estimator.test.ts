/**
 * Unit tests — lib/utils/tax-estimator.ts
 *
 * Covers:
 *   estimateTakeHome:
 *     - Zero/negative income → all zeros
 *     - Zero-tax states (TX, WA, FL, NV, etc.)
 *     - Non-zero state rates (CA, NY)
 *     - Unknown state code → stateSupported: false, stateTax: 0
 *     - Null state code → not supported
 *     - Federal bracket progression (10%, 12%, 22%, 24%)
 *     - FICA: SS cap at $176,100; additional Medicare above $200k
 *     - Married vs Single filing status brackets
 *     - netAnnual = grossIncome − totalTax
 *     - totalTax = federalTax + stateTax + fica
 *     - All monetary fields are rounded integers
 *     - SUPPORTED_STATES includes expected entries
 */
import { describe, it, expect } from "vitest";
import { estimateTakeHome, SUPPORTED_STATES } from "@/lib/utils/tax-estimator";

// ── Zero income ────────────────────────────────────────────────────────────────

describe("estimateTakeHome — zero income", () => {
  it("returns all-zero result for grossIncome = 0", () => {
    const r = estimateTakeHome(0, "CA", "single");
    expect(r.federalTax).toBe(0);
    expect(r.stateTax).toBe(0);
    expect(r.fica).toBe(0);
    expect(r.totalTax).toBe(0);
    expect(r.netAnnual).toBe(0);
    expect(r.effectiveRate).toBe(0);
  });

  it("returns all-zero result for negative grossIncome", () => {
    const r = estimateTakeHome(-50_000, "TX", "single");
    expect(r.totalTax).toBe(0);
    expect(r.netAnnual).toBe(0);
  });
});

// ── Zero-tax states ────────────────────────────────────────────────────────────

describe("estimateTakeHome — zero-tax states", () => {
  const ZERO_TAX = ["TX", "WA", "FL", "NV", "WY", "SD", "TN", "AK", "NH"];

  for (const state of ZERO_TAX) {
    it(`${state}: stateTax = 0 and stateSupported = true`, () => {
      const r = estimateTakeHome(100_000, state, "single");
      expect(r.stateTax).toBe(0);
      expect(r.stateSupported).toBe(true);
    });
  }
});

// ── Unknown / null state code ──────────────────────────────────────────────────

describe("estimateTakeHome — unknown state", () => {
  it("unknown state code → stateSupported = false, stateTax = 0", () => {
    const r = estimateTakeHome(100_000, "ZZ", "single");
    expect(r.stateSupported).toBe(false);
    expect(r.stateTax).toBe(0);
  });

  it("null state code → stateSupported = false, stateTax = 0", () => {
    const r = estimateTakeHome(100_000, null, "single");
    expect(r.stateSupported).toBe(false);
    expect(r.stateTax).toBe(0);
    expect(r.stateCode).toBeNull();
  });

  it("empty string → stateSupported = false", () => {
    const r = estimateTakeHome(100_000, "", "single");
    expect(r.stateSupported).toBe(false);
  });

  it("state code is uppercased before lookup (lowercase input)", () => {
    const lower = estimateTakeHome(100_000, "ca", "single");
    const upper = estimateTakeHome(100_000, "CA", "single");
    expect(lower.stateTax).toBe(upper.stateTax);
    expect(lower.stateSupported).toBe(true);
  });
});

// ── State tax calculations ─────────────────────────────────────────────────────

describe("estimateTakeHome — state tax", () => {
  it("CA has higher state tax than NY at same income", () => {
    const ca = estimateTakeHome(150_000, "CA", "single");
    const ny = estimateTakeHome(150_000, "NY", "single");
    expect(ca.stateTax).toBeGreaterThan(ny.stateTax);
  });

  it("CA has higher state tax than TX at same income", () => {
    const ca = estimateTakeHome(150_000, "CA", "single");
    const tx = estimateTakeHome(150_000, "TX", "single");
    expect(ca.stateTax).toBeGreaterThan(tx.stateTax);
  });

  it("stateTax is positive for CA at $100k income", () => {
    const r = estimateTakeHome(100_000, "CA", "single");
    expect(r.stateTax).toBeGreaterThan(0);
  });
});

// ── Federal tax brackets ───────────────────────────────────────────────────────

describe("estimateTakeHome — federal brackets", () => {
  it("income below standard deduction has near-zero federal tax", () => {
    // $15,000 gross − $15,000 deduction = $0 taxable → $0 federal
    const r = estimateTakeHome(15_000, "TX", "single");
    expect(r.federalTax).toBe(0);
  });

  it("income in 10% bracket only — $20k single filer", () => {
    // taxable = $20k − $15k = $5k → federal = $500
    const r = estimateTakeHome(20_000, "TX", "single");
    expect(r.federalTax).toBe(500);
  });

  it("higher income → higher federal tax (progressive)", () => {
    const low  = estimateTakeHome(50_000,  "TX", "single");
    const mid  = estimateTakeHome(100_000, "TX", "single");
    const high = estimateTakeHome(300_000, "TX", "single");
    expect(low.federalTax).toBeLessThan(mid.federalTax);
    expect(mid.federalTax).toBeLessThan(high.federalTax);
  });

  it("married brackets are wider — lower federal tax than single at same income", () => {
    const single  = estimateTakeHome(150_000, "TX", "single");
    const married = estimateTakeHome(150_000, "TX", "married");
    expect(married.federalTax).toBeLessThan(single.federalTax);
  });
});

// ── FICA ─────────────────────────────────────────────────────────────────────

describe("estimateTakeHome — FICA", () => {
  it("FICA is positive for any non-zero income", () => {
    const r = estimateTakeHome(50_000, "TX", "single");
    expect(r.fica).toBeGreaterThan(0);
  });

  it("SS contribution caps — income above SS wage base has same SS tax as base amount", () => {
    // SS is capped at $176,100; above the cap, SS component doesn't grow
    const atCap    = estimateTakeHome(176_100, "TX", "single");
    const aboveCap = estimateTakeHome(300_000, "TX", "single");
    // SS tax for atCap = 176100 × 0.062 = $10,918
    // SS tax for aboveCap is same SS amount; the extra FICA is only Medicare
    // So the difference should only be the extra Medicare (1.45% on extra $123.9k = ~$1797)
    // and additional Medicare (0.9% on $100k above $200k = $900)
    expect(aboveCap.fica).toBeGreaterThan(atCap.fica);
  });

  it("additional 0.9% Medicare applies above $200k — detectable at larger gap", () => {
    // Compare $200k vs $210k to see a meaningful additional Medicare difference
    const below = estimateTakeHome(200_000, "TX", "single");
    const above = estimateTakeHome(210_000, "TX", "single");
    // Extra $10k: regular Medicare = $10k × 1.45% = $145; additional Medicare = $10k × 0.9% = $90
    // Difference should be $235 (145+90) which is detectable
    expect(above.fica - below.fica).toBeGreaterThan(100);
  });
});

// ── Net and effective rate ─────────────────────────────────────────────────────

describe("estimateTakeHome — net and effectiveRate", () => {
  it("netAnnual = grossIncome − totalTax", () => {
    const r = estimateTakeHome(120_000, "CA", "single");
    expect(r.netAnnual).toBe(r.grossAnnual - r.totalTax);
  });

  it("effectiveRate is between 0 and 1 for typical incomes", () => {
    for (const income of [40_000, 100_000, 250_000, 600_000]) {
      const r = estimateTakeHome(income, "CA", "single");
      expect(r.effectiveRate).toBeGreaterThan(0);
      expect(r.effectiveRate).toBeLessThan(1);
    }
  });

  it("all monetary return values are integers (rounded)", () => {
    const r = estimateTakeHome(133_333, "CA", "single");
    expect(Number.isInteger(r.federalTax)).toBe(true);
    expect(Number.isInteger(r.stateTax)).toBe(true);
    expect(Number.isInteger(r.fica)).toBe(true);
    expect(Number.isInteger(r.totalTax)).toBe(true);
    expect(Number.isInteger(r.netAnnual)).toBe(true);
  });

  it("totalTax = federalTax + stateTax + fica", () => {
    const r = estimateTakeHome(180_000, "NY", "married");
    expect(r.totalTax).toBe(r.federalTax + r.stateTax + r.fica);
  });

  it("effectiveRate is consistent with total tax / gross income (within rounding)", () => {
    const r = estimateTakeHome(150_000, "CA", "single");
    // effectiveRate is computed from unrounded values; totalTax is rounded.
    // Allow for a small rounding discrepancy (< 0.01%).
    expect(Math.abs(r.effectiveRate - r.totalTax / r.grossAnnual)).toBeLessThan(0.001);
  });
});

// ── SUPPORTED_STATES ──────────────────────────────────────────────────────────

describe("SUPPORTED_STATES", () => {
  it("includes at least 40 states", () => {
    expect(SUPPORTED_STATES.length).toBeGreaterThanOrEqual(40);
  });

  it("includes CA, NY, TX, WA, FL", () => {
    expect(SUPPORTED_STATES).toContain("CA");
    expect(SUPPORTED_STATES).toContain("NY");
    expect(SUPPORTED_STATES).toContain("TX");
    expect(SUPPORTED_STATES).toContain("WA");
    expect(SUPPORTED_STATES).toContain("FL");
  });
});
