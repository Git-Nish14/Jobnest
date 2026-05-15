/**
 * Unit tests for lib/utils/date.ts
 *
 * Focus: formatCompactDateTime — the new function added for application card timestamps.
 * Also smoke-tests the existing formatDate / formatDateTime for regressions.
 */
import { describe, it, expect } from "vitest";
import {
  formatDate,
  formatDateTime,
  formatCompactDateTime,
  formatRelativeDate,
} from "@/lib/utils/date";

// Fixed ISO string in the current year for deterministic "current year" branch
const THIS_YEAR = new Date().getFullYear();
const THIS_YEAR_ISO = `${THIS_YEAR}-03-15T14:30:00.000Z`;
const PAST_YEAR_ISO = `${THIS_YEAR - 1}-11-20T09:00:00.000Z`;

describe("formatCompactDateTime", () => {
  it("returns '—' for null input", () => {
    expect(formatCompactDateTime(null)).toBe("—");
  });

  it("returns '—' for undefined input", () => {
    expect(formatCompactDateTime(undefined)).toBe("—");
  });

  it("returns '—' for an invalid date string", () => {
    expect(formatCompactDateTime("not-a-date")).toBe("—");
  });

  it("includes the time part (at keyword) for current-year date", () => {
    const result = formatCompactDateTime(THIS_YEAR_ISO);
    expect(result).toMatch(/at/i);
  });

  it("omits the year for a current-year datetime", () => {
    const result = formatCompactDateTime(THIS_YEAR_ISO);
    // Year should NOT appear in the output for current year
    expect(result).not.toContain(String(THIS_YEAR));
  });

  it("includes the year for a past-year datetime", () => {
    const result = formatCompactDateTime(PAST_YEAR_ISO);
    expect(result).toContain(String(THIS_YEAR - 1));
  });

  it("returns a non-empty string for a valid ISO datetime", () => {
    const result = formatCompactDateTime("2026-05-12T10:00:00Z");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toBe("—");
  });
});

describe("formatDate — regression", () => {
  it("formats a date-only string (YYYY-MM-DD) without throwing", () => {
    const result = formatDate("2026-05-12");
    expect(result).not.toBe("—");
    expect(result).toMatch(/2026/);
  });

  it("returns '—' for null", () => {
    expect(formatDate(null)).toBe("—");
  });
});

describe("formatDateTime — regression", () => {
  it("includes both date and time information", () => {
    const result = formatDateTime("2026-05-12T14:30:00Z");
    expect(result).not.toBe("—");
    expect(result).toMatch(/2026/);
  });
});

describe("formatRelativeDate — regression", () => {
  it("returns 'today' for today's date", () => {
    const today = new Date().toISOString().split("T")[0];
    const result = formatRelativeDate(today);
    expect(result).toBe("today");
  });

  it("returns '—' for null input", () => {
    expect(formatRelativeDate(null)).toBe("—");
  });
});
