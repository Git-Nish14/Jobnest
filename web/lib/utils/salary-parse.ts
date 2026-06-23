/**
 * Parse a free-text salary range string (e.g. "$90,000 - $120,000" or "$90k")
 * into a numeric midpoint. Returns null when no number can be extracted.
 *
 * Used by both the server-side analytics service and client-side components
 * (SalaryBenchmark) so it lives in lib/utils rather than inside the service.
 */
export function parseSalary(range: string | null | undefined): number | null {
  if (!range) return null;
  // Strip thousands-separator commas so "$90,000" → "$90000" before the
  // general non-numeric replacement; otherwise "90,000" splits wrong.
  const normalized = range.replace(/,/g, "");
  // Handle shorthand: "90k" → 90000, "1.2M" → 1200000
  const shorthand = normalized.replace(/(\d+(?:\.\d+)?)\s*k/gi, (_, n) =>
    String(parseFloat(n) * 1_000)
  ).replace(/(\d+(?:\.\d+)?)\s*m/gi, (_, n) =>
    String(parseFloat(n) * 1_000_000)
  );
  const nums = shorthand
    .replace(/[^0-9.]/g, " ")   // hyphens → spaces (treated as range separators; salaries are never negative)
    .trim()
    .split(/\s+/)
    .map(Number)
    .filter((n) => !isNaN(n) && n > 0);
  if (nums.length === 0) return null;
  if (nums.length === 1) return nums[0];
  return (nums[0] + nums[nums.length - 1]) / 2;
}
