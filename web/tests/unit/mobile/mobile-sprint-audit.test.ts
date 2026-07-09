/**
 * Structural tests for the mobile UX sprint (June 2026).
 *
 * Covers the following shipped changes (all checked against real source files):
 *   - BottomTabBar: scroll auto-hide, page-nestai CSS class toggle, no conditional render
 *   - dashboard.css: tab-bar-hidden + page-nestai rules
 *   - globals.css: atelier-bottom-bar + atelier-bottom-card CSS classes
 *   - NESTAi page: mobile ⋯ bottom sheet, NESTpro Audit rename, MoreHorizontal fix
 *   - ATSScanner: NESTpro Audit rename (no FAANG in user-visible labels)
 *   - CookieBanner: atelier-bottom-bar, full-width bottom strip, no glass-pill
 *   - NPSFeedback: atelier-bottom-card, responsive width/position
 *   - Application detail: sidebar order-1/order-2 mobile reorder
 *   - Dashboard page: responsive H1, FAB mobile positioning
 *   - Salary page: sticky Company column, hover fix, responsive stat text
 *   - Kanban: scroll hint, hover-only fix
 *   - Notifications: always-visible mobile action buttons h-11
 *   - auth.css: 44px touch targets on back btn, eye icon, forgot link, OAuth btn
 *   - layout.tsx: Apple PWA splash screen meta tags
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

const root = path.resolve(__dirname, "../../../");

function readSrc(rel: string) {
  return readFileSync(path.join(root, rel), "utf-8");
}

// ── 1. BottomTabBar — scroll auto-hide + page-nestai class toggle ─────────────

describe("BottomTabBar — scroll auto-hide + page-nestai", () => {
  const src = readSrc("components/layout/BottomTabBar.tsx");

  it("uses window.location.pathname inside useEffect (not stale React state)", () => {
    expect(src).toContain("window.location.pathname.startsWith");
  });

  it("toggles html.page-nestai class via classList.toggle", () => {
    expect(src).toContain('classList.toggle("page-nestai"');
  });

  it("removes tab-bar-hidden class on every route change", () => {
    expect(src).toContain('classList.remove("tab-bar-hidden")');
  });

  it("uses pathname from usePathname() as useEffect dependency", () => {
    expect(src).toContain("}, [pathname])");
  });

  it("defines a scroll hide threshold constant", () => {
    expect(src).toContain("SCROLL_HIDE_THRESHOLD");
    expect(src).toContain("80");
  });

  it("uses suppressHydrationWarning on the nav element", () => {
    expect(src).toContain("suppressHydrationWarning");
  });

  it("does NOT conditionally return null (avoids hydration mismatch)", () => {
    expect(src).not.toContain("if (isNestAiActive) return null");
  });

  it("does NOT use tabIndex to conditionally block interaction", () => {
    // tabIndex on links was removed — it caused hydration mismatches
    expect(src).not.toContain("tabIndex={isNestAiActive");
  });
});

// ── 2. dashboard.css — new CSS rules ──────────────────────────────────────────

describe("dashboard.css — tab-bar-hidden + page-nestai rules", () => {
  const css = readSrc("app/(dashboard)/dashboard.css");

  it("defines html.tab-bar-hidden .bottom-tab-bar (scroll auto-hide)", () => {
    expect(css).toContain("html.tab-bar-hidden .bottom-tab-bar");
  });

  it("tab-bar-hidden rule sets opacity:0 and translateY", () => {
    const ruleStart = css.indexOf("html.tab-bar-hidden .bottom-tab-bar");
    const ruleChunk = css.slice(ruleStart, ruleStart + 200);
    expect(ruleChunk).toContain("opacity: 0");
    expect(ruleChunk).toContain("translateY");
  });

  it("defines html.page-nestai .bottom-tab-bar (hides bar on NESTAi)", () => {
    expect(css).toContain("html.page-nestai .bottom-tab-bar");
  });

  it("page-nestai rule uses display:none (CSS hide, not conditional render)", () => {
    const ruleStart = css.indexOf("html.page-nestai .bottom-tab-bar");
    const ruleChunk = css.slice(ruleStart, ruleStart + 100);
    expect(ruleChunk).toContain("display: none");
  });

  it("defines html.page-nestai .nestai-input-area (repositions input without tab bar)", () => {
    expect(css).toContain("html.page-nestai .nestai-input-area");
  });

  it("page-nestai input area uses safe-area-inset-bottom for flush bottom", () => {
    const ruleStart = css.indexOf("html.page-nestai .nestai-input-area");
    const ruleChunk = css.slice(ruleStart, ruleStart + 150);
    expect(ruleChunk).toContain("env(safe-area-inset-bottom");
  });

  it("reduced-motion block covers both nav-open and tab-bar-hidden", () => {
    expect(css).toContain("html.tab-bar-hidden .bottom-tab-bar { transform: none");
  });
});

// ── 3. globals.css — atelier-bottom-bar + atelier-bottom-card ─────────────────

describe("globals.css — bottom bar CSS classes", () => {
  const css = readSrc("app/globals.css");

  it("defines .atelier-bottom-bar", () => {
    expect(css).toContain(".atelier-bottom-bar {");
  });

  it("atelier-bottom-bar uses backdrop-filter for blur", () => {
    const ruleStart = css.indexOf(".atelier-bottom-bar {");
    const ruleChunk = css.slice(ruleStart, ruleStart + 300);
    expect(ruleChunk).toContain("backdrop-filter");
  });

  it("atelier-bottom-bar has a top border (not bottom like navbar)", () => {
    const ruleStart = css.indexOf(".atelier-bottom-bar {");
    const ruleChunk = css.slice(ruleStart, ruleStart + 300);
    expect(ruleChunk).toContain("border-top");
  });

  it("defines .dark .atelier-bottom-bar", () => {
    expect(css).toContain(".dark .atelier-bottom-bar {");
  });

  it("defines .atelier-bottom-card (for NPSFeedback floating card)", () => {
    expect(css).toContain(".atelier-bottom-card {");
  });

  it("defines .dark .atelier-bottom-card", () => {
    expect(css).toContain(".dark .atelier-bottom-card {");
  });

  it("does NOT define .glass-pill (removed as dead CSS)", () => {
    expect(css).not.toContain(".glass-pill {");
  });
});

// ── 4. NESTAi page — mobile ⋯ bottom sheet + NESTpro rename ──────────────────

describe("NESTAi page — mobile actions bottom sheet", () => {
  const src = readSrc("app/(dashboard)/nestai/page.tsx");

  it("has a mobileActionsOpen state", () => {
    expect(src).toContain("mobileActionsOpen");
    expect(src).toContain("setMobileActionsOpen");
  });

  it("renders a ⋯ button visible only on mobile (sm:hidden)", () => {
    expect(src).toContain("sm:hidden");
    expect(src).toContain("More actions");
  });

  it("bottom sheet has role=dialog and aria-modal=true", () => {
    expect(src).toContain('role="dialog"');
    expect(src).toContain('aria-modal="true"');
    expect(src).toContain('aria-label="NESTAi Actions"');
  });

  it("bottom sheet has Escape key handler", () => {
    expect(src).toContain('e.key === "Escape"');
  });

  it("bottom sheet has tabIndex=-1 for focus management", () => {
    expect(src).toContain("tabIndex={-1}");
  });

  it("shows NESTpro Audit (not FAANG) in the mobile sheet", () => {
    expect(src).toContain("NESTpro Audit");
    expect(src).not.toContain("FAANG Audit");
    expect(src).not.toContain("FAANG ATS Audit");
  });

  it("session MoreHorizontal button uses sm:opacity-0 (visible on mobile touch)", () => {
    expect(src).toContain("sm:opacity-0 sm:group-hover:opacity-100");
  });

  it("shows NESTpro rename in modal title", () => {
    expect(src).toContain("NESTats — NESTpro Audit");
  });

  it("AI prompt uses NESTpro (not FAANG) terminology", () => {
    expect(src).toContain("NESTpro ATS audit");
    expect(src).not.toContain("FAANG ATS audit");
  });
});

// ── 5. ATSScanner — NESTpro rename ───────────────────────────────────────────

describe("ATSScanner — NESTpro Audit rename", () => {
  const src = readSrc("components/ats/ATSScanner.tsx");

  it("tab label is NESTpro Audit (not FAANG Audit)", () => {
    expect(src).toContain("NESTpro Audit");
    expect(src).not.toContain('label="FAANG Audit"');
  });

  it("info panel heading says NESTpro Audit", () => {
    expect(src).toContain("NESTpro Audit — what it checks");
  });

  it("run button says Run NESTpro Audit", () => {
    expect(src).toContain("Run NESTpro Audit");
    expect(src).not.toContain("Run FAANG Audit");
  });

  it("loading text says Running NESTpro audit", () => {
    expect(src).toContain("Running NESTpro audit");
    expect(src).not.toContain("Running FAANG audit");
  });

  it("helper text says run the NESTpro audit", () => {
    expect(src).toContain("run the NESTpro audit");
  });
});

// ── 6. CookieBanner — full-width atelier-bottom-bar strip ────────────────────

describe("CookieBanner — atelier-bottom-bar redesign", () => {
  const src = readSrc("components/layout/CookieBanner.tsx");

  it("uses atelier-bottom-bar CSS class", () => {
    expect(src).toContain("atelier-bottom-bar");
  });

  it("is fixed full-width at bottom (inset-x-0 bottom-0)", () => {
    expect(src).toContain("inset-x-0");
    expect(src).toContain("bottom-0");
  });

  it("does NOT use glass-pill (removed dead CSS class)", () => {
    expect(src).not.toContain("glass-pill");
  });

  it("uses z-9999 to appear above the bottom tab bar", () => {
    expect(src).toContain("z-9999");
  });

  it("content is constrained inside max-w-7xl (mirrors navbar layout)", () => {
    expect(src).toContain("max-w-7xl");
  });

  it("uses pb-safe on content container (iPhone home indicator clearance)", () => {
    expect(src).toContain("pb-safe");
  });

  it("all buttons have explicit type=button", () => {
    const buttonMatches = src.match(/<button/g) ?? [];
    const typedMatches  = src.match(/<button[^>]*type="button"/g) ?? [];
    expect(typedMatches.length).toBe(buttonMatches.length);
  });
});

// ── 7. NPSFeedback — atelier-bottom-card, responsive layout ──────────────────

describe("NPSFeedback — atelier-bottom-card redesign", () => {
  const src = readSrc("components/layout/NPSFeedback.tsx");

  it("uses atelier-bottom-card CSS class", () => {
    expect(src).toContain("atelier-bottom-card");
  });

  it("does NOT use glass-pill (removed dead CSS class)", () => {
    expect(src).not.toContain("glass-pill");
  });

  it("is full-width on mobile (inset-x-4)", () => {
    expect(src).toContain("inset-x-4");
  });

  it("is right-aligned card on desktop (md:right-6 md:w-96)", () => {
    expect(src).toContain("md:right-6");
    expect(src).toContain("md:w-96");
  });

  it("score button row is overflow-x-auto (all 11 fit on any screen)", () => {
    expect(src).toContain("overflow-x-auto");
  });

  it("comment textarea uses text-[16px] to prevent iOS zoom", () => {
    expect(src).toContain("text-[16px]");
  });

  it("dismiss button has min-h-11 min-w-11 (44px touch target)", () => {
    expect(src).toContain("min-h-11 min-w-11");
  });
});

// ── 8. Application detail — sidebar mobile reorder ───────────────────────────

describe("applications/[id]/page.tsx — mobile sidebar ordering", () => {
  const src = readSrc("app/(dashboard)/applications/[id]/page.tsx");

  it("sidebar column has order-1 lg:order-0 (appears first on mobile)", () => {
    expect(src).toContain("order-1 lg:order-0");
  });

  it("main column has order-2 lg:order-0 (appears second on mobile)", () => {
    expect(src).toContain("order-2 lg:order-0");
  });
});

// ── 9. Dashboard page — responsive H1 + FAB mobile ───────────────────────────

describe("dashboard/page.tsx — responsive H1 + mobile FAB", () => {
  const src = readSrc("app/(dashboard)/dashboard/page.tsx");

  it("H1 uses text-3xl sm:text-5xl md:text-6xl (responsive)", () => {
    expect(src).toContain("text-3xl sm:text-5xl md:text-6xl");
  });

  it("FAB no longer uses hidden md:flex (visible on mobile)", () => {
    expect(src).not.toContain("hidden md:flex");
  });

  it("FAB uses inline safe-area bottom positioning (not app-mobile-fab class)", () => {
    // app-mobile-fab had display:none at sm+ which would hide the FAB on desktop;
    // now uses inline calc() so it's always visible
    expect(src).toContain("bottom-[calc(env(safe-area-inset-bottom");
    expect(src).not.toContain("app-mobile-fab");
  });
});

// ── 10. Salary page — sticky Company column ───────────────────────────────────

describe("salary/page.tsx — sticky first column", () => {
  const src = readSrc("app/(dashboard)/salary/page.tsx");

  it("Company <th> is sticky with left-0 z-10", () => {
    expect(src).toContain("sticky left-0 z-10");
  });

  it("Company <td> is also sticky with left-0 z-10", () => {
    // Both th and td need sticky — count occurrences
    const stickyCount = (src.match(/sticky left-0 z-10/g) ?? []).length;
    expect(stickyCount).toBeGreaterThanOrEqual(2);
  });

  it("sticky <td> has group-hover background for row hover parity", () => {
    expect(src).toContain("group-hover:bg-[#f4f3f1]");
  });

  it("table row has group class for group-hover propagation", () => {
    expect(src).toContain('className="group hover:bg-[#f4f3f1]');
  });

  it("stat card numbers use text-2xl sm:text-3xl (responsive)", () => {
    expect(src).toContain("text-2xl sm:text-3xl");
  });
});

// ── 11. Kanban board — scroll hint + hover fix ────────────────────────────────

describe("kanban-board.tsx — mobile scroll hint + hover fix", () => {
  const src = readSrc("components/applications/kanban-board.tsx");

  it("has a mobile-only scroll hint (lg:hidden)", () => {
    expect(src).toContain("lg:hidden");
    expect(src).toContain("Swipe to see all columns");
  });

  it("view link uses sm:opacity-0 sm:group-hover:opacity-100 (always visible on mobile)", () => {
    expect(src).toContain("sm:opacity-0 sm:group-hover:opacity-100");
  });
});

// ── 12. Notifications — always-visible mobile action buttons ─────────────────

describe("notifications/page.tsx — mobile-accessible action buttons", () => {
  const src = readSrc("app/(dashboard)/notifications/page.tsx");

  it("action button container uses sm:opacity-0 (always visible on mobile)", () => {
    expect(src).toContain("sm:opacity-0 sm:group-hover:opacity-100");
  });

  it("toggle-read button is h-11 w-11 (44px touch target)", () => {
    expect(src).toContain("h-11 w-11 rounded-lg");
  });
});

// ── 13. auth.css — 44px touch targets ────────────────────────────────────────

describe("auth.css — touch target improvements", () => {
  const css = readSrc("app/(auth)/auth.css");

  it("atelier-back-btn has min-height: 2.75rem", () => {
    const ruleStart = css.indexOf(".atelier-back-btn {");
    const ruleChunk = css.slice(ruleStart, ruleStart + 300);
    expect(ruleChunk).toContain("min-height: 2.75rem");
  });

  it("atelier-eye-btn has min-width and min-height: 2.75rem", () => {
    const ruleStart = css.indexOf(".atelier-eye-btn {");
    const ruleChunk = css.slice(ruleStart, ruleStart + 300);
    expect(ruleChunk).toContain("min-width: 2.75rem");
    expect(ruleChunk).toContain("min-height: 2.75rem");
  });

  it("atelier-forgot-link has min-height: 2.75rem", () => {
    const ruleStart = css.indexOf(".atelier-forgot-link {");
    const ruleChunk = css.slice(ruleStart, ruleStart + 300);
    expect(ruleChunk).toContain("min-height: 2.75rem");
  });

  it("atelier-oauth-btn uses 0.875rem vertical padding (meets 44px height)", () => {
    const ruleStart = css.indexOf(".atelier-oauth-btn {");
    const ruleChunk = css.slice(ruleStart, ruleStart + 200);
    expect(ruleChunk).toContain("0.875rem");
  });
});

// ── 14. Root layout — Apple PWA splash screens ───────────────────────────────

describe("layout.tsx — Apple PWA splash screens", () => {
  const src = readSrc("app/layout.tsx");

  it("includes apple-touch-startup-image link tags", () => {
    expect(src).toContain("apple-touch-startup-image");
  });

  it("covers multiple iPhone screen sizes", () => {
    const linkCount = (src.match(/apple-touch-startup-image/g) ?? []).length;
    expect(linkCount).toBeGreaterThanOrEqual(4);
  });

  it("all splash links point to same-origin /new_logo_1.png", () => {
    expect(src).toContain('href="/new_logo_1.png"');
    // No external URLs
    expect(src).not.toMatch(/apple-touch-startup-image.*href="https?:\/\//);
  });
});

// ── 15. Navbar — 44px touch targets ──────────────────────────────────────────

describe("Navbar — 44px touch targets", () => {
  const src = readSrc("components/layout/Navbar.tsx");

  it("hamburger button uses min-h-11 min-w-11", () => {
    expect(src).toContain("min-h-11 min-w-11");
  });

  it("close button uses min-h-11 min-w-11", () => {
    const occurrences = (src.match(/min-h-11 min-w-11/g) ?? []).length;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });

  it("slide panel links use min-h-11 (44px row height)", () => {
    expect(src).toContain("min-h-11");
    expect(src).toContain("py-3");
  });
});
