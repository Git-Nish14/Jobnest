/**
 * Unit tests — parseSalary()
 *
 * Extracted from the inline implementation in services/analytics.ts into
 * lib/utils/salary-parse.ts so it can be shared with client components
 * (SalaryBenchmark) without pulling in server-only code.
 *
 * Tests cover:
 *  - Basic dollar ranges with and without thousands separators
 *  - Single values
 *  - Shorthand k / M suffixes (new capability vs old inline version)
 *  - Null / empty / gibberish inputs
 *  - Edge cases the old version handled differently (e.g. hyphens in values)
 */
import { describe, it, expect } from "vitest";
import { parseSalary } from "@/lib/utils/salary-parse";

describe("parseSalary — basic ranges", () => {
  it("returns midpoint for 'LOW - HIGH' pattern", () => {
    expect(parseSalary("90000 - 120000")).toBe(105_000);
  });

  it("strips dollar signs and returns midpoint", () => {
    expect(parseSalary("$90,000 - $120,000")).toBe(105_000);
  });

  it("handles range without spaces around dash", () => {
    expect(parseSalary("90000-120000")).toBe(105_000);
  });

  it("returns the single number for a plain value", () => {
    expect(parseSalary("100000")).toBe(100_000);
  });

  it("strips thousands comma from a single value", () => {
    expect(parseSalary("$120,000")).toBe(120_000);
  });
});

describe("parseSalary — shorthand suffixes", () => {
  it("converts 'k' suffix to thousands", () => {
    expect(parseSalary("90k")).toBe(90_000);
  });

  it("converts 'K' suffix (case-insensitive) to thousands", () => {
    expect(parseSalary("90K")).toBe(90_000);
  });

  it("converts decimal k suffix correctly", () => {
    expect(parseSalary("1.5k")).toBe(1_500);
  });

  it("converts 'M' suffix to millions", () => {
    expect(parseSalary("1.2M")).toBe(1_200_000);
  });

  it("returns midpoint for a k-suffix range", () => {
    expect(parseSalary("90k - 120k")).toBe(105_000);
  });

  it("handles dollar sign with k suffix", () => {
    expect(parseSalary("$90k - $120k")).toBe(105_000);
  });
});

describe("parseSalary — null / empty / invalid inputs", () => {
  it("returns null for null input", () => {
    expect(parseSalary(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(parseSalary(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseSalary("")).toBeNull();
  });

  it("returns null for a string with no parseable numbers", () => {
    expect(parseSalary("competitive")).toBeNull();
  });

  it("returns null for a string with only zeros", () => {
    // parseSalary filters out n <= 0
    expect(parseSalary("0")).toBeNull();
  });

  it("returns null for gibberish", () => {
    expect(parseSalary("N/A")).toBeNull();
  });
});

describe("parseSalary — edge cases", () => {
  it("handles commas correctly: '$90,000' is 90000 not 90", () => {
    // Without comma-stripping: "90,000".split → ["90", "000"] → 90 (wrong)
    // With comma-stripping: "90000" → 90000 (correct)
    expect(parseSalary("$90,000")).toBe(90_000);
  });

  it("uses first and last number as the range endpoints", () => {
    // Strings like "$80,000 - $100,000 base + bonus" shouldn't skew the midpoint
    // Only first and last parsed numbers are used.
    expect(parseSalary("80000 90000 100000")).toBe(90_000); // (80k + 100k) / 2
  });
});
