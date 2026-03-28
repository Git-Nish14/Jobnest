/**
 * Structural tests for the mobile responsive changes.
 *
 * These tests run in the Node environment (no jsdom / browser) so they verify
 * the static shape of our implementation: CSS class definitions, component
 * structure, and configuration values — rather than rendering behaviour.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

const root = path.resolve(__dirname, "../../../");

function readSrc(rel: string) {
  return readFileSync(path.join(root, rel), "utf-8");
}

// ── 1. Bottom Tab Bar component ───────────────────────────────────────────────

describe("BottomTabBar component", () => {
  const src = readSrc("components/layout/BottomTabBar.tsx");

  it("exports BottomTabBar", () => {
    expect(src).toContain("export function BottomTabBar");
  });

  it("includes the four primary tabs", () => {
    expect(src).toContain('href: "/dashboard"');
    expect(src).toContain('href: "/applications"');
    expect(src).toContain('href: "/interviews"');
    expect(src).toContain('href: "/nestai"');
  });

  it("is hidden on md+ screens (md:hidden)", () => {
    expect(src).toContain("md:hidden");
  });

  it("is fixed at the bottom with z-50", () => {
    expect(src).toContain("fixed");
    expect(src).toContain("bottom-0");
    expect(src).toContain("z-50");
  });

  it("applies active/inactive CSS classes", () => {
    expect(src).toContain("bottom-tab-active");
    expect(src).toContain("bottom-tab-inactive");
  });

  it("marks current page with aria-current", () => {
    expect(src).toContain('aria-current');
  });
});

// ── 2. Bottom Tab Bar exported from layout index ──────────────────────────────

describe("layout/index.ts exports", () => {
  const src = readSrc("components/layout/index.ts");

  it("re-exports BottomTabBar", () => {
    expect(src).toContain('export { BottomTabBar }');
  });
});

// ── 3. Dashboard layout includes BottomTabBar ─────────────────────────────────

describe("dashboard layout", () => {
  const src = readSrc("app/(dashboard)/layout.tsx");

  it("imports BottomTabBar", () => {
    expect(src).toContain("BottomTabBar");
  });

  it("renders <BottomTabBar />", () => {
    expect(src).toContain("<BottomTabBar />");
  });
});

// ── 4. Dashboard CSS — new classes ────────────────────────────────────────────

describe("dashboard.css — mobile additions", () => {
  const css = readSrc("app/(dashboard)/dashboard.css");

  it("defines .bottom-tab-bar", () => {
    expect(css).toContain(".bottom-tab-bar");
  });

  it("defines .bottom-tab-active and .bottom-tab-inactive", () => {
    expect(css).toContain(".bottom-tab-active");
    expect(css).toContain(".bottom-tab-inactive");
  });

  it("positions nestai-input-area above the bottom tab bar (4rem offset)", () => {
    expect(css).toContain(".nestai-input-area");
    expect(css).toContain("4rem");
  });

  it("defines .db-mobile-action-bar for sticky app-detail Edit button", () => {
    expect(css).toContain(".db-mobile-action-bar");
  });

  it(".db-mobile-action-bar hides on md+ screens", () => {
    // It must have a @media (min-width: 768px) rule that sets display: none
    const afterClass = css.slice(css.indexOf(".db-mobile-action-bar"));
    expect(afterClass).toContain("display: none");
  });

  it("defines .db-scroll-x for horizontal table scroll", () => {
    expect(css).toContain(".db-scroll-x");
    expect(css).toContain("overflow-x: auto");
  });

  it("defines .pb-safe utility", () => {
    expect(css).toContain(".pb-safe");
    expect(css).toContain("env(safe-area-inset-bottom");
  });
});

// ── 5. NESTAi page — full-screen mobile sidebar ───────────────────────────────

describe("nestai/page.tsx — mobile sidebar", () => {
  const src = readSrc("app/(dashboard)/nestai/page.tsx");

  it("uses w-full for full-screen sidebar on mobile", () => {
    expect(src).toContain("w-full");
  });

  it("sidebar stops at bottom-16 on mobile (above tab bar)", () => {
    expect(src).toContain("bottom-16");
  });

  it("uses pb-52 on messages area (clears input + tab bar)", () => {
    expect(src).toContain("pb-52");
  });

  it("backdrop also ends at bottom-16 on mobile", () => {
    // Both the backdrop div and the aside should reference bottom-16
    const count = (src.match(/bottom-16/g) ?? []).length;
    expect(count).toBeGreaterThanOrEqual(2);
  });
});

// ── 6. Application detail — sticky mobile action bar ─────────────────────────

describe("applications/[id]/page.tsx — mobile sticky bar", () => {
  const src = readSrc("app/(dashboard)/applications/[id]/page.tsx");

  it("uses db-mobile-action-bar class", () => {
    expect(src).toContain("db-mobile-action-bar");
  });

  it("hides the header Edit button on mobile (hidden sm:inline-flex)", () => {
    expect(src).toContain("hidden sm:inline-flex");
  });

  it("sticky bar contains Edit Application label", () => {
    expect(src).toContain("Edit Application");
  });
});

// ── 7. Root layout — viewport-fit=cover ──────────────────────────────────────

describe("root layout — viewport", () => {
  const src = readSrc("app/layout.tsx");

  it("sets viewportFit to cover for safe-area-inset support", () => {
    expect(src).toContain('viewportFit: "cover"');
  });
});

// ── 8. Salary page — scroll-x table ──────────────────────────────────────────

describe("salary/page.tsx — horizontal scroll", () => {
  const src = readSrc("app/(dashboard)/salary/page.tsx");

  it("wraps the table in db-scroll-x", () => {
    expect(src).toContain("db-scroll-x");
  });

  it("sets min-w on table to prevent squishing", () => {
    expect(src).toContain("min-w-");
  });
});
