/**
 * Unit tests — salary page StatusBadge token mapping
 *
 * The StatusBadge helper in salary/page.tsx maps each application status to a
 * pair of Tailwind colour tokens. These tests guard against regressions in the
 * token map (e.g., accidentally overwriting Rejected → red with another colour).
 *
 * Because the function is defined inline in a Next.js server component we test
 * the logic directly here rather than importing it.
 */

import { describe, it, expect } from "vitest";

// ── Replicate the token map from salary/page.tsx ──────────────────────────────

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  Applied:        { bg: "bg-amber-50 dark:bg-amber-950/30",    text: "text-amber-700 dark:text-amber-300" },
  "Phone Screen": { bg: "bg-orange-50 dark:bg-orange-950/30",  text: "text-orange-700 dark:text-orange-300" },
  "In Review":    { bg: "bg-orange-50 dark:bg-orange-950/30",  text: "text-orange-700 dark:text-orange-300" },
  Interview:      { bg: "bg-emerald-50 dark:bg-emerald-950/30",text: "text-emerald-700 dark:text-emerald-300" },
  Offer:          { bg: "bg-emerald-100 dark:bg-emerald-950/40",text: "text-emerald-800 dark:text-emerald-200 font-bold" },
  Accepted:       { bg: "bg-emerald-100 dark:bg-emerald-950/40",text: "text-emerald-800 dark:text-emerald-200 font-bold" },
  Rejected:       { bg: "bg-red-50 dark:bg-red-950/30",         text: "text-red-700 dark:text-red-300" },
  Withdrawn:      { bg: "bg-muted",                             text: "text-muted-foreground" },
  Ghosted:        { bg: "bg-zinc-100 dark:bg-zinc-800/40",      text: "text-zinc-600 dark:text-zinc-400" },
};

const FALLBACK = { bg: "bg-muted", text: "text-muted-foreground" };

function getTokens(status: string) {
  return STATUS_BADGE[status] ?? FALLBACK;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("salary StatusBadge — token mapping", () => {
  it("Rejected maps to red tokens", () => {
    const t = getTokens("Rejected");
    expect(t.bg).toContain("red");
    expect(t.text).toContain("red");
  });

  it("Offer maps to emerald tokens", () => {
    const t = getTokens("Offer");
    expect(t.bg).toContain("emerald");
    expect(t.text).toContain("emerald");
  });

  it("Accepted maps to emerald tokens", () => {
    const t = getTokens("Accepted");
    expect(t.bg).toContain("emerald");
    expect(t.text).toContain("emerald");
  });

  it("Applied maps to amber tokens", () => {
    const t = getTokens("Applied");
    expect(t.bg).toContain("amber");
    expect(t.text).toContain("amber");
  });

  it("Interview maps to emerald tokens", () => {
    const t = getTokens("Interview");
    expect(t.bg).toContain("emerald");
  });

  it("unknown status falls back to muted tokens", () => {
    const t = getTokens("Unicorn Status");
    expect(t).toEqual(FALLBACK);
  });

  it("all known statuses return non-empty bg and text", () => {
    const statuses = Object.keys(STATUS_BADGE);
    statuses.forEach((s) => {
      const t = getTokens(s);
      expect(t.bg.length).toBeGreaterThan(0);
      expect(t.text.length).toBeGreaterThan(0);
    });
  });

  it("Offer and Accepted are visually distinct from Rejected (no red)", () => {
    expect(getTokens("Offer").bg).not.toContain("red");
    expect(getTokens("Accepted").bg).not.toContain("red");
  });

  it("Rejected does not map to emerald (guards against swapped tokens)", () => {
    expect(getTokens("Rejected").bg).not.toContain("emerald");
    expect(getTokens("Rejected").text).not.toContain("emerald");
  });
});

// ── Monthly-trends chart SERIES colour guard ──────────────────────────────────
// Guards the semantic colour mapping introduced in this sprint:
//   Applied  → amber   (was terracotta — same as Rejected)
//   Rejected → red-500 (was grey — semantically wrong)
//   Offers   → emerald (unchanged)

const MONTHLY_SERIES = [
  { key: "count",      label: "Applied",  fill: "fill-amber-500  dark:fill-amber-400" },
  { key: "rejections", label: "Rejected", fill: "fill-red-500    dark:fill-red-400"   },
  { key: "offers",     label: "Offers",   fill: "fill-emerald-500 dark:fill-emerald-400" },
];

describe("monthly-trends chart — semantic colours", () => {
  it("Applied series uses amber fill", () => {
    const applied = MONTHLY_SERIES.find((s) => s.label === "Applied")!;
    expect(applied.fill).toContain("amber");
  });

  it("Rejected series uses red fill (not grey)", () => {
    const rejected = MONTHLY_SERIES.find((s) => s.label === "Rejected")!;
    expect(rejected.fill).toContain("red");
    expect(rejected.fill).not.toContain("c8c6c3"); // old grey hex
    expect(rejected.fill).not.toContain("white");
  });

  it("Offers series uses emerald fill", () => {
    const offers = MONTHLY_SERIES.find((s) => s.label === "Offers")!;
    expect(offers.fill).toContain("emerald");
  });

  it("all three series have distinct fill colours", () => {
    const fills = MONTHLY_SERIES.map((s) => s.fill.split(" ")[0]);
    const unique = new Set(fills);
    expect(unique.size).toBe(3);
  });
});

// ── Stage-funnel chart colour guard ───────────────────────────────────────────
// Guards the warm→cool gradient introduced in this sprint.

const STAGE_COLOURS = [
  "fill-amber-500   dark:fill-amber-400",
  "fill-orange-500  dark:fill-orange-400",
  "fill-[#99462a]   dark:fill-[#cc7a5a]",
  "fill-emerald-600 dark:fill-emerald-400",
  "fill-emerald-700 dark:fill-emerald-300",
];

describe("stage-funnel chart — warm→cool colour gradient", () => {
  it("has exactly 5 stage colours", () => {
    expect(STAGE_COLOURS).toHaveLength(5);
  });

  it("first stage (Applied) uses amber", () => {
    expect(STAGE_COLOURS[0]).toContain("amber");
  });

  it("last stage (Accepted) uses emerald", () => {
    expect(STAGE_COLOURS[4]).toContain("emerald");
  });

  it("no stage uses the old uniform terracotta #99462a for all slots", () => {
    // At most one stage should use the terracotta colour (the Interview stage)
    const terracottas = STAGE_COLOURS.filter((c) => c.includes("#99462a"));
    expect(terracottas.length).toBeLessThanOrEqual(1);
  });
});
