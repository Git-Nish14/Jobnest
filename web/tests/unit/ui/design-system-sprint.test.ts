/**
 * Structural tests for the design-system modernisation sprint (features-2 branch).
 *
 * All tests run in the Node environment without a browser — they verify the
 * static shape of changed files: CSS properties, animation keyframes, code
 * patterns, and configuration values. This catches regressions immediately
 * in CI without requiring a live Supabase connection.
 *
 * Changes covered:
 *   - globals.css     : color-scheme, foldable @media, animation keyframes, tap highlight
 *   - auth.css        : a11y font sizes, responsive card padding, touch targets
 *   - dashboard.css   : foldable support, color-scheme, scoped .db-root > main
 *   - landing.css     : backdrop-filter, nav-link color transition
 *   - Navbar.tsx      : slide animation, backdrop blur, panel width
 *   - ThemeToggle.tsx : dynamic meta[name="theme-color"] sync
 *   - button.tsx      : sm/lg radius consistency (brand pill style)
 *   - layout.tsx      : themeColor array, colorScheme, msapplication-TileColor
 *   - manifest.json   : orientation "any", display_override, edge_side_panel
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

const root = path.resolve(__dirname, "../../../");
function src(rel: string) { return readFileSync(path.join(root, rel), "utf-8"); }

// ── 1. globals.css — color-scheme, animations, foldable ──────────────────────

describe("globals.css — design system foundations", () => {
  const css = src("app/globals.css");

  it("declares color-scheme: light on :root", () => {
    // Browser uses this to style native scrollbars and form controls correctly
    const rootBlock = css.slice(css.indexOf(":root {"), css.indexOf("}\n\n.dark"));
    expect(rootBlock).toContain("color-scheme: light");
  });

  it("declares color-scheme: dark on .dark", () => {
    const darkBlock = css.slice(css.indexOf(".dark {"), css.indexOf("@theme inline"));
    expect(darkBlock).toContain("color-scheme: dark");
  });

  it("--background token maps to warm cream not pure white", () => {
    // Was `0 0% 100%` (pure white). Must now be a warm value != pure white.
    const rootBlock = css.slice(css.indexOf(":root {"), css.indexOf("}\n\n.dark"));
    expect(rootBlock).toContain("--background:");
    expect(rootBlock).not.toContain("--background: 0 0% 100%");
  });

  it("defines slide-in-right keyframe for mobile panel animation", () => {
    expect(css).toContain("@keyframes slide-in-right");
    expect(css).toContain("translateX(100%)");
  });

  it("defines fade-in-overlay keyframe for backdrop animation", () => {
    expect(css).toContain("@keyframes fade-in-overlay");
  });

  it("defines flyout-in keyframe for dropdown entrance", () => {
    expect(css).toContain("@keyframes flyout-in");
  });

  it("flyout-in keyframe does NOT include translateX(-50%) — Tailwind v4 translate property handles centering separately", () => {
    // CRITICAL: Tailwind v4 uses the `translate` CSS property (not `transform`)
    // for -translate-x-1/2. Including translateX(-50%) in a @keyframes `transform`
    // would compound with Tailwind's `translate: -50%`, shifting the element -100%.
    const keyframeBlock = css.slice(
      css.indexOf("@keyframes flyout-in"),
      css.indexOf("}\n\n.nav-flyout-animate")
    );
    expect(keyframeBlock).not.toContain("translateX(-50%)");
    // Should still animate Y and scale
    expect(keyframeBlock).toContain("translateY");
    expect(keyframeBlock).toContain("scale");
  });

  it("applies .nav-panel-animate class with will-change for GPU compositing", () => {
    expect(css).toContain(".nav-panel-animate");
    expect(css).toContain("will-change: transform, opacity");
  });

  it("prefers-reduced-motion block disables all three nav animations", () => {
    const reducedBlock = css.slice(
      css.indexOf("@media (prefers-reduced-motion: reduce)"),
      css.indexOf("/* ── Atelier Navbar")
    );
    expect(reducedBlock).toContain("nav-panel-animate");
    expect(reducedBlock).toContain("nav-overlay-animate");
    expect(reducedBlock).toContain("nav-flyout-animate");
    expect(reducedBlock).toContain("animation: none");
  });

  it("supports foldable devices with @media (horizontal-viewport-segments: 2)", () => {
    expect(css).toContain("horizontal-viewport-segments: 2");
  });

  it("does NOT set overflow-x: hidden on body in the foldable media query — would break position:sticky", () => {
    const foldableBlock = css.slice(
      css.indexOf("@media (horizontal-viewport-segments: 2)"),
      css.indexOf("/* ── Tap highlight")
    );
    expect(foldableBlock).not.toContain("overflow-x: hidden");
  });

  it("applies -webkit-tap-highlight-color: transparent on * (no blue flash on touch)", () => {
    expect(css).toContain("-webkit-tap-highlight-color: transparent");
  });

  it("applies text-rendering on body only, NOT on * (mobile perf — avoid per-element kerning calc)", () => {
    // text-rendering: optimizeLegibility on * is a known mobile performance regression
    const globalStarBlock = css.slice(css.indexOf("* {"), css.indexOf("body {"));
    expect(globalStarBlock).not.toContain("text-rendering");
    // The property must appear somewhere in the file on a body selector
    expect(css).toContain("text-rendering: optimizeLegibility");
    // And the * selector must NOT contain it
    const starSelectorContent = css.match(/\*\s*\{[^}]*\}/g) ?? [];
    for (const block of starSelectorContent) {
      expect(block).not.toContain("text-rendering");
    }
  });
});

// ── 2. auth.css — accessibility font sizes + responsive padding ───────────────

describe("auth.css — accessibility and mobile UX", () => {
  const css = src("app/(auth)/auth.css");

  it("atelier-back-btn font-size is >= 0.75rem (was 0.625rem/10px — too small)", () => {
    const section = css.slice(css.indexOf(".atelier-back-btn"), css.indexOf(".atelier-otp-box"));
    const match = section.match(/font-size:\s*([\d.]+)rem/);
    expect(match).toBeTruthy();
    expect(parseFloat(match![1])).toBeGreaterThanOrEqual(0.75);
  });

  it("atelier-label font-size is >= 0.75rem (was 0.6875rem — improved readability)", () => {
    const section = css.slice(css.indexOf(".atelier-label {"), css.indexOf(".atelier-label-inline"));
    const match = section.match(/font-size:\s*([\d.]+)rem/);
    expect(match).toBeTruthy();
    expect(parseFloat(match![1])).toBeGreaterThanOrEqual(0.75);
  });

  it("atelier-divider-label font-size is >= 0.625rem (was 0.625rem — minimum acceptable)", () => {
    const section = css.slice(css.indexOf(".atelier-divider-label {"), css.indexOf(".atelier-divider-line"));
    const match = section.match(/font-size:\s*([\d.]+)rem/);
    expect(match).toBeTruthy();
    expect(parseFloat(match![1])).toBeGreaterThanOrEqual(0.625);
  });

  it("atelier-footer-link font-size is >= 0.625rem (was 0.625rem — minimum acceptable)", () => {
    const section = css.slice(css.indexOf(".atelier-footer-link {"), css.indexOf(".atelier-footer-link:hover"));
    const match = section.match(/font-size:\s*([\d.]+)rem/);
    expect(match).toBeTruthy();
    expect(parseFloat(match![1])).toBeGreaterThanOrEqual(0.625);
  });

  it("atelier-forgot-link font-size is >= 0.75rem (was 0.6875rem — improved)", () => {
    const section = css.slice(css.indexOf(".atelier-forgot-link {"), css.indexOf(".atelier-forgot-link:hover"));
    const match = section.match(/font-size:\s*([\d.]+)rem/);
    expect(match).toBeTruthy();
    expect(parseFloat(match![1])).toBeGreaterThanOrEqual(0.75);
  });

  it("atelier-footer-link has min-height for 44px touch target", () => {
    const section = css.slice(css.indexOf(".atelier-footer-link {"), css.indexOf(".atelier-footer-link:hover"));
    expect(section).toContain("min-height: 2.75rem");
  });

  it("atelier-card has responsive padding via @media (min-width: 400px)", () => {
    // Prevents auth card from being too cramped on 320px screens
    const after = css.slice(css.indexOf(".atelier-card {"));
    expect(after).toContain("@media (min-width: 400px)");
    const mediaBlock = after.slice(
      after.indexOf("@media (min-width: 400px)"),
      after.indexOf("@media (min-width: 400px)") + 200
    );
    expect(mediaBlock).toContain("atelier-card");
    expect(mediaBlock).toContain("padding: 2rem");
  });

  it("atelier-card-low has responsive padding via @media (min-width: 400px)", () => {
    const after = css.slice(css.indexOf(".atelier-card-low {"));
    const mediaBlock = after.slice(
      after.indexOf("@media (min-width: 400px)"),
      after.indexOf("@media (min-width: 400px)") + 200
    );
    expect(mediaBlock).toContain("atelier-card-low");
  });
});

// ── 3. dashboard.css — foldable support + color-scheme ───────────────────────

describe("dashboard.css — foldable device support", () => {
  const css = src("app/(dashboard)/dashboard.css");

  it("declares color-scheme: light on .db-root", () => {
    const section = css.slice(css.indexOf(".db-root {"), css.indexOf("/* ── Bar chart area"));
    expect(section).toContain("color-scheme: light");
  });

  it("declares color-scheme: dark on .dark .db-root", () => {
    const darkSection = css.slice(css.indexOf(".dark .db-root {"), css.indexOf("/* ── Panels"));
    expect(darkSection).toContain("color-scheme: dark");
  });

  it("includes foldable @media (horizontal-viewport-segments: 2) block", () => {
    expect(css).toContain("@media (horizontal-viewport-segments: 2)");
  });

  it("foldable block uses .db-root > main (not bare `main`) — avoids breaking auth/landing layouts", () => {
    const foldableBlock = css.slice(
      css.indexOf("@media (horizontal-viewport-segments: 2)"),
      css.indexOf("@media (vertical-viewport-segments: 2)")
    );
    expect(foldableBlock).toContain(".db-root > main");
    // Should NOT contain a bare `main {` selector (too broad)
    expect(foldableBlock).not.toMatch(/^\s+main\s*\{/m);
  });

  it("landscape media query also uses .db-root > main (scoped, not bare main)", () => {
    const landscapeBlock = css.slice(
      css.indexOf("@media screen and (min-width: 768px) and (orientation: landscape)"),
      css.indexOf("/* ── Stat card touch reveal")
    );
    expect(landscapeBlock).toContain(".db-root > main");
    expect(landscapeBlock).not.toMatch(/^\s+main\s*\{/m);
  });

  it("foldable block hides bottom-tab-bar (reduces nav clutter on dual-screen)", () => {
    const foldableBlock = css.slice(
      css.indexOf("@media (horizontal-viewport-segments: 2)"),
      css.indexOf("@media (vertical-viewport-segments: 2)")
    );
    expect(foldableBlock).toContain(".bottom-tab-bar");
    expect(foldableBlock).toContain("display: none");
  });

  it("vertical viewport segments block repositions bottom tab bar", () => {
    expect(css).toContain("@media (vertical-viewport-segments: 2)");
    const block = css.slice(
      css.indexOf("@media (vertical-viewport-segments: 2)"),
      css.indexOf("/* Wide landscape")
    );
    expect(block).toContain("bottom-tab-bar");
  });

  it("touch pointer coarse media makes stat cards tappable", () => {
    expect(css).toContain("hover: none");
    expect(css).toContain("pointer: coarse");
    const coarseBlock = css.slice(css.indexOf("@media (hover: none) and (pointer: coarse)"));
    expect(coarseBlock).toContain("db-stat-card");
    expect(coarseBlock).toContain("cursor: pointer");
  });

  it("foldable block constrains panels to segment width using env() with fallback", () => {
    const foldableBlock = css.slice(
      css.indexOf("@media (horizontal-viewport-segments: 2)"),
      css.indexOf("@media (vertical-viewport-segments: 2)")
    );
    expect(foldableBlock).toContain("env(viewport-segment-width");
    expect(foldableBlock).toContain("50vw"); // safe fallback
  });
});

// ── 4. landing.css — backdrop-filter and transition improvements ──────────────

describe("landing.css — header and nav-link polish", () => {
  const css = src("app/landing.css");

  it("landing-header has backdrop-filter (glass effect on scroll)", () => {
    const headerBlock = css.slice(
      css.indexOf(".landing-header {"),
      css.indexOf(".landing-logo-text")
    );
    expect(headerBlock).toContain("backdrop-filter");
    expect(headerBlock).toContain("blur(");
  });

  it("dark mode landing-header also has backdrop-filter", () => {
    const darkHeader = css.slice(
      css.indexOf(".dark .landing-header {"),
      css.indexOf(".dark .landing-logo-text")
    );
    expect(darkHeader).toContain("backdrop-filter");
  });

  it("landing-nav-link transitions both background-color and color", () => {
    const navLinkBlock = css.slice(
      css.indexOf(".landing-nav-link {"),
      css.indexOf(".landing-nav-link:hover")
    );
    expect(navLinkBlock).toContain("transition:");
    expect(navLinkBlock).toContain("color");
    expect(navLinkBlock).toContain("background-color");
  });

  it("landing-nav-link hover sets color for text feedback (not just background)", () => {
    const hoverBlock = css.slice(
      css.indexOf(".landing-nav-link:hover"),
      css.indexOf(".landing-login-link")
    );
    expect(hoverBlock).toContain("color:");
  });
});

// ── 5. Navbar.tsx — animation classes and mobile panel improvements ───────────

describe("Navbar.tsx — mobile slide panel animation", () => {
  const code = src("components/layout/Navbar.tsx");

  it("overlay uses nav-overlay-animate class for fade-in", () => {
    expect(code).toContain("nav-overlay-animate");
  });

  it("slide panel uses nav-panel-animate class for slide-in", () => {
    expect(code).toContain("nav-panel-animate");
  });

  it("dropdown flyout uses nav-flyout-animate class", () => {
    expect(code).toContain("nav-flyout-animate");
  });

  it("mobile panel width is max-w-sm (384px) not max-w-xs (320px) — better for large phones", () => {
    expect(code).toContain("max-w-sm");
    // max-w-xs should NOT be on the slide panel div
    const panelSection = code.slice(code.indexOf("nav-panel-animate"), code.indexOf("nav-panel-animate") + 200);
    expect(panelSection).not.toContain("max-w-xs");
  });

  it("backdrop overlay has backdropFilter for frosted glass effect", () => {
    expect(code).toContain("backdropFilter");
    expect(code).toContain("blur(4px)");
  });

  it("backdrop uses WebkitBackdropFilter for Safari compatibility", () => {
    expect(code).toContain("WebkitBackdropFilter");
  });

  it("mobile overlay background is semi-transparent (not fully opaque)", () => {
    // rgba is correct — pure bg-black/60 doesn't allow blur to show through
    expect(code).toContain("rgba(0,0,0,0.55)");
  });
});

// ── 6. ThemeToggle.tsx — dynamic meta theme-color sync ───────────────────────

describe("ThemeToggle.tsx — meta[name=theme-color] dynamic sync", () => {
  const code = src("components/layout/ThemeToggle.tsx");

  it("queries all meta[name='theme-color'] elements on toggle", () => {
    expect(code).toContain('meta[name="theme-color"]');
    expect(code).toContain("querySelectorAll");
  });

  it("sets content to #000000 for dark mode", () => {
    expect(code).toContain('"#000000"');
  });

  it("sets content to #faf9f7 for light mode", () => {
    expect(code).toContain('"#faf9f7"');
  });

  it("uses setAttribute to update the meta content value", () => {
    expect(code).toContain('setAttribute("content"');
  });

  it("iterates over all theme-color metas with forEach", () => {
    // Both the light-mode and dark-mode metas need updating
    expect(code).toContain(".forEach");
  });

  it("applies the correct color based on the current theme argument", () => {
    // The applyTheme function must contain both the ternary check AND the meta update
    const applyThemeBlock = code.slice(
      code.indexOf("function applyTheme("),
      code.indexOf("export function ThemeToggle")
    );
    expect(applyThemeBlock).toContain('theme === "dark"');
    expect(applyThemeBlock).toContain('meta[name="theme-color"]');
  });
});

// ── 7. button.tsx — brand-consistent pill shape ───────────────────────────────

describe("button.tsx — radius consistency (pill brand style)", () => {
  const code = src("components/ui/button.tsx");

  it("base buttonVariants uses rounded-full for pill shape", () => {
    expect(code).toContain("rounded-full");
  });

  it("sm size does NOT override with rounded-md (would break pill brand)", () => {
    const sizeBlock = code.slice(code.indexOf("size: {"), code.indexOf("defaultVariants"));
    const smLine = sizeBlock.slice(sizeBlock.indexOf("sm:"), sizeBlock.indexOf("lg:"));
    expect(smLine).not.toContain("rounded-md");
  });

  it("lg size does NOT override with rounded-lg (would break pill brand)", () => {
    const sizeBlock = code.slice(code.indexOf("size: {"), code.indexOf("defaultVariants"));
    const lgLine = sizeBlock.slice(sizeBlock.indexOf("lg:"), sizeBlock.indexOf("icon:"));
    expect(lgLine).not.toContain("rounded-lg");
  });
});

// ── 8. layout.tsx — PWA viewport metadata ────────────────────────────────────

describe("layout.tsx — PWA viewport metadata", () => {
  const code = src("app/layout.tsx");

  it("themeColor is an array supporting both light and dark modes", () => {
    // Static string → array: browser chrome now reflects the actual UI theme
    expect(code).toContain("themeColor: [");
    expect(code).toContain("prefers-color-scheme: light");
    expect(code).toContain("prefers-color-scheme: dark");
  });

  it("light themeColor is warm cream #faf9f7 (matching page background)", () => {
    expect(code).toContain('"#faf9f7"');
  });

  it("dark themeColor is pure black #000000 (matching dark UI)", () => {
    expect(code).toContain('"#000000"');
  });

  it("exports colorScheme as 'light dark' for native control rendering", () => {
    expect(code).toContain('colorScheme: "light dark"');
  });

  it("msapplication-TileColor is brand colour #99462a (not unrelated blue #3b82f6)", () => {
    expect(code).toContain('"#99462a"');
    expect(code).not.toContain('"#3b82f6"');
  });
});

// ── 9. manifest.json — PWA installability improvements ───────────────────────

describe("manifest.json — PWA installability", () => {
  const manifest = JSON.parse(src("public/manifest.json"));

  it("orientation is 'any' (not 'portrait-primary') to support foldables and tablets", () => {
    expect(manifest.orientation).toBe("any");
  });

  it("display_override array is present for progressive enhancement", () => {
    expect(manifest.display_override).toBeDefined();
    expect(Array.isArray(manifest.display_override)).toBe(true);
  });

  it("display_override includes 'window-controls-overlay' for desktop PWA title bar", () => {
    expect(manifest.display_override).toContain("window-controls-overlay");
  });

  it("display_override includes 'standalone' as a fallback", () => {
    expect(manifest.display_override).toContain("standalone");
  });

  it("edge_side_panel is defined for Edge Side Panel installability", () => {
    expect(manifest.edge_side_panel).toBeDefined();
    expect(manifest.edge_side_panel.preferred_width).toBeGreaterThan(0);
  });

  it("theme_color is still present (required by PWA spec)", () => {
    expect(manifest.theme_color).toBeTruthy();
  });

  it("background_color matches light-mode page background", () => {
    // #faf9f7 is the warm cream used on first paint
    expect(manifest.background_color).toBe("#faf9f7");
  });
});
