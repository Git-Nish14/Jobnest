/**
 * Structural regression tests for the UI/UX audit pass (March 2026).
 *
 * All tests run in the Node environment without a browser — they verify the
 * static shape of the implementation: aria attributes, CSS classes, and code
 * structure, ensuring future refactors don't silently regress accessibility
 * or UX improvements.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

const root = path.resolve(__dirname, "../../../");
function src(rel: string) { return readFileSync(path.join(root, rel), "utf-8"); }

// ── 1. ApplicationCard — mobile actions & aria ────────────────────────────────

describe("ApplicationCard — mobile actions & aria", () => {
  const code = src("components/applications/application-card.tsx");

  it("actions wrapper is visible on mobile (sm:opacity-0, not opacity-0)", () => {
    // Must NOT have the bare `opacity-0` that hides actions on all screens
    expect(code).not.toContain('"flex items-center opacity-0');
    // Must use sm: prefix so mobile always sees actions
    expect(code).toContain("sm:opacity-0");
    expect(code).toContain("sm:group-hover:opacity-100");
  });

  it("external link has aria-label (not just title)", () => {
    expect(code).toContain('aria-label={`View job posting for');
  });

  it("options menu button has aria-label", () => {
    expect(code).toContain('aria-label={`Options for');
  });
});

// ── 2. ApplicationFilters — debounce & aria ───────────────────────────────────

describe("ApplicationFilters — debounce & aria", () => {
  const code = src("components/applications/application-filters.tsx");

  it("imports useEffect for debounce", () => {
    expect(code).toContain("useEffect");
  });

  it("imports useRef for stable callback refs", () => {
    expect(code).toContain("useRef");
  });

  it("debounce timeout of 400ms is set", () => {
    expect(code).toContain("400");
  });

  it("push is stabilised with useCallback", () => {
    expect(code).toContain("useCallback");
    expect(code).toContain("const push = useCallback");
  });

  it("search input has aria-label", () => {
    expect(code).toContain('aria-label="Search applications"');
  });

  it("status filter group has role=group and aria-label", () => {
    expect(code).toContain('role="group"');
    expect(code).toContain('aria-label="Filter by status"');
  });

  it("filter pills use valid string aria-pressed values", () => {
    // Boolean booleans cause ARIA validation errors; must be string literals
    expect(code).toContain('aria-pressed={currentStatus === "all" ? "true" : "false"}');
    expect(code).toContain('aria-pressed={currentStatus === status ? "true" : "false"}');
    // Must NOT have bare boolean expression
    expect(code).not.toMatch(/aria-pressed=\{currentStatus === "all"\}/);
  });

  it("sort trigger has aria-label", () => {
    expect(code).toContain("aria-label={`Sort:");
  });

  it("clears timeout on cleanup (no memory leak)", () => {
    expect(code).toContain("clearTimeout(t)");
    expect(code).toContain("return () => clearTimeout");
  });
});

// ── 3. ReminderList — complete button aria-label ──────────────────────────────

describe("ReminderList — complete button aria-label", () => {
  const code = src("components/reminders/reminder-list.tsx");

  it("complete button has contextual aria-label with reminder title", () => {
    expect(code).toContain('aria-label={`Mark "');
    expect(code).toContain("as complete`}");
  });
});

// ── 4. Skeletons — sync with actual page layout ───────────────────────────────

describe("skeletons.tsx — layout sync", () => {
  const code = src("components/common/skeletons.tsx");

  it("NestAiSkeleton uses -mb-36 (matching the actual page)", () => {
    expect(code).toContain("-mb-36");
    expect(code).not.toMatch(/NestAiSkeleton[\s\S]{0,500}-mb-32/);
  });

  it("ApplicationsSkeleton filter bar uses 2-row layout (flex-col)", () => {
    // Should have flex-col for the stacked mobile layout
    const filterSection = code.slice(
      code.indexOf("Filter bar"),
      code.indexOf("Cards — with left accent bar")
    );
    expect(filterSection).toContain("flex-col");
  });

  it("ApplicationsSkeleton filter bar uses new border-radius token", () => {
    const filterSection = code.slice(
      code.indexOf("Filter bar"),
      code.indexOf("Cards — with left accent bar")
    );
    expect(filterSection).toContain("rounded-[0.875rem]");
  });
});

// ── 5. dashboard.css — performance & accessibility ───────────────────────────

describe("dashboard.css — performance & a11y", () => {
  const css = src("app/(dashboard)/dashboard.css");

  it("FAB has will-change: transform for GPU compositing", () => {
    expect(css).toContain("will-change: transform");
  });

  it("FAB hover enhances box-shadow (depth feedback)", () => {
    const fabSection = css.slice(css.indexOf(".db-fab {"), css.indexOf(".db-fab:active"));
    expect(fabSection).toContain("box-shadow");
  });

  it("prefers-reduced-motion block disables transitions", () => {
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).toContain("transition: none");
  });

  it("prefers-reduced-motion disables FAB transform on hover", () => {
    const reduced = css.slice(css.indexOf("prefers-reduced-motion: reduce"));
    expect(reduced).toContain("transform: none");
  });

  it("nestai-page CSS comment references -mb-36 (not stale -mb-32)", () => {
    // The NESTAi section comment should mention -mb-36 (current value)
    const nestaiSection = css.slice(
      css.indexOf("/* Negative margins in the TSX"),
      css.indexOf(".nestai-page {")
    );
    expect(nestaiSection).toContain("-mb-36");
    expect(nestaiSection).not.toContain("-mb-32");
  });
});

// ── 6. ContactList — existing aria patterns not regressed ─────────────────────

describe("ContactList — aria baseline", () => {
  const code = src("components/contacts/contact-list.tsx");

  it("contact options button has aria-label", () => {
    expect(code).toContain('aria-label="Contact options"');
  });
});
