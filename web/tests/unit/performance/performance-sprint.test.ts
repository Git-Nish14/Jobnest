/**
 * Structural tests for the performance sprint (August 2026).
 *
 * These tests read source files directly and assert that the code changes are
 * present, correct, and do not regress.  They cover:
 *
 *   - Bundle analysis : @next/bundle-analyzer wired into next.config.ts,
 *                       "analyze" npm script, optimizePackageImports for
 *                       lucide-react and all Radix UI packages.
 *   - Image optimisation : AVIF/WebP formats, 30-day cache TTL,
 *                          specific Supabase hostname (not wildcard),
 *                          no hardcoded project ID in remotePatterns.
 *   - Font consolidation : Newsreader + Manrope declared once in root
 *                          layout.tsx, not duplicated across the five
 *                          sub-layouts that previously each loaded them.
 *   - Security fixes     : Supabase URL derived from env var (not hardcoded),
 *                          *.supabase.co wildcard removed from remotePatterns.
 *   - Service worker     : v2 cache names, /offline pre-caching in install,
 *                          navigate branch with null-guard 503 fallback,
 *                          successful HTML never cached.
 *   - Offline page       : force-static, no user-data imports, correct links.
 *   - Manifest           : icon-192.png and icon-512.png used, not new_logo_1.png.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

// Root = web/ (three levels up from tests/unit/performance/)
const root = path.resolve(__dirname, "../../../");

function readSrc(rel: string): string {
  return readFileSync(path.join(root, rel), "utf-8");
}

// ─── Bundle analysis ──────────────────────────────────────────────────────────

describe("Bundle analysis — next.config.ts", () => {
  const cfg = readSrc("next.config.ts");

  it("imports @next/bundle-analyzer", () => {
    expect(cfg).toContain(`from "@next/bundle-analyzer"`);
  });

  it("creates withBundleAnalyzer gated on ANALYZE env var", () => {
    expect(cfg).toContain(`process.env.ANALYZE === "true"`);
  });

  it("wraps the final export with withBundleAnalyzer", () => {
    expect(cfg).toContain("withBundleAnalyzer(withSentryConfig(");
  });

  it("has optimizePackageImports with lucide-react", () => {
    expect(cfg).toContain(`"lucide-react"`);
    expect(cfg).toContain("optimizePackageImports");
  });

  it("includes all Radix UI packages in optimizePackageImports", () => {
    expect(cfg).toContain(`"@radix-ui/react-avatar"`);
    expect(cfg).toContain(`"@radix-ui/react-dialog"`);
    expect(cfg).toContain(`"@radix-ui/react-dropdown-menu"`);
    expect(cfg).toContain(`"@radix-ui/react-select"`);
  });
});

describe("Bundle analysis — package.json", () => {
  const pkg = JSON.parse(readSrc("package.json"));

  it('has an "analyze" npm script', () => {
    expect(pkg.scripts).toHaveProperty("analyze");
  });

  it("analyze script passes ANALYZE=true to next build", () => {
    expect(pkg.scripts.analyze).toContain("ANALYZE=true");
    expect(pkg.scripts.analyze).toContain("next build");
  });

  it("@next/bundle-analyzer is in devDependencies", () => {
    expect(pkg.devDependencies).toHaveProperty("@next/bundle-analyzer");
  });
});

// ─── Image optimisation ───────────────────────────────────────────────────────

describe("Image optimisation — next.config.ts", () => {
  const cfg = readSrc("next.config.ts");

  it("serves AVIF format (highest compression, served first)", () => {
    expect(cfg).toContain(`"image/avif"`);
  });

  it("serves WebP format as fallback", () => {
    expect(cfg).toContain(`"image/webp"`);
  });

  it("sets 30-day minimumCacheTTL for CDN caching", () => {
    expect(cfg).toContain("minimumCacheTTL");
    expect(cfg).toContain("2592000");
  });

  it("derives Supabase hostname from env var — no wildcard", () => {
    expect(cfg).toContain("process.env.NEXT_PUBLIC_SUPABASE_URL");
    expect(cfg).toContain("supabaseHostname");
    // Wildcard would allow any Supabase project to be proxied
    expect(cfg).not.toContain(`"*.supabase.co"`);
  });

  it("does not have a hardcoded Supabase project ID in config", () => {
    // Project ID must never be hardcoded in source — use env var only
    expect(cfg).not.toContain("vyqpmmaowjlvuusilssr");
  });
});

// ─── Font consolidation ───────────────────────────────────────────────────────

describe("Font consolidation — root app/layout.tsx", () => {
  const layout = readSrc("app/layout.tsx");

  it("imports Newsreader from next/font/google", () => {
    expect(layout).toMatch(/import\s*\{[^}]*Newsreader[^}]*\}\s*from\s*["']next\/font\/google["']/);
  });

  it("imports Manrope from next/font/google", () => {
    expect(layout).toMatch(/import\s*\{[^}]*Manrope[^}]*\}\s*from\s*["']next\/font\/google["']/);
  });

  it("applies newsreader CSS variable to body", () => {
    expect(layout).toContain("newsreader.variable");
  });

  it("applies manrope CSS variable to body", () => {
    expect(layout).toContain("manrope.variable");
  });

  it("derives Supabase preconnect origin from env var, not hardcoded URL", () => {
    expect(layout).toContain("process.env.NEXT_PUBLIC_SUPABASE_URL");
    expect(layout).toContain("supabaseOrigin");
    // Must not hardcode the project ref — breaks staging / dev environments
    expect(layout).not.toContain("vyqpmmaowjlvuusilssr");
  });

  it("does not preconnect to Google Fonts CDN (next/font self-hosts)", () => {
    expect(layout).not.toContain("fonts.googleapis.com");
    expect(layout).not.toContain("fonts.gstatic.com");
  });
});

describe("Font consolidation — child layouts have no duplicate declarations", () => {
  const layouts = [
    "app/(dashboard)/layout.tsx",
    "app/(auth)/layout.tsx",
    "app/(public)/layout.tsx",
    "app/onboarding/layout.tsx",
    "app/not-found.tsx",
  ];

  for (const file of layouts) {
    it(`${file} does not import Newsreader or Manrope`, () => {
      const src = readSrc(file);
      // next/font/google import of these specific fonts must be absent
      expect(src).not.toMatch(/import\s*\{[^}]*Newsreader[^}]*\}\s*from\s*["']next\/font\/google["']/);
      expect(src).not.toMatch(/import\s*\{[^}]*Manrope[^}]*\}\s*from\s*["']next\/font\/google["']/);
    });
  }
});

// ─── Service worker ───────────────────────────────────────────────────────────

describe("Service worker — public/sw.js", () => {
  const sw = readSrc("public/sw.js");

  it("uses v2 asset cache name (forces old cache purge on activate)", () => {
    expect(sw).toContain(`"jobnest-assets-v2"`);
  });

  it("defines a separate offline cache name", () => {
    expect(sw).toContain(`"jobnest-offline-v2"`);
  });

  it('sets OFFLINE_URL to "/offline"', () => {
    expect(sw).toContain(`"/offline"`);
  });

  it("pre-caches the offline page during install using cache.add (not cache.addAll)", () => {
    expect(sw).toContain("cache.add(OFFLINE_URL)");
    // cache.addAll with navigation pages would be a security risk
    expect(sw).not.toContain("cache.addAll");
  });

  it("install handler uses event.waitUntil so failures abort SW installation", () => {
    expect(sw).toContain("event.waitUntil");
  });

  it("activate handler deletes both old asset and offline caches, then claims clients", () => {
    expect(sw).toContain("k !== ASSET_CACHE && k !== OFFLINE_CACHE");
    expect(sw).toContain("self.clients.claim()");
  });

  it("navigate fetch uses event.respondWith with network-first strategy", () => {
    // Must intercept navigate so we can serve offline fallback
    expect(sw).toContain(`request.mode === "navigate"`);
    expect(sw).toContain("event.respondWith");
  });

  it("navigate fallback has null-guard so undefined cache miss does not crash SW", () => {
    // caches.match() returns undefined on miss — respondWith(undefined) is invalid
    expect(sw).toMatch(/\|\|\s*new Response/);
  });

  it("null-guard fallback returns 503 status code", () => {
    expect(sw).toContain("status: 503");
  });

  it("navigate handler uses network-first (.catch) not cache-first", () => {
    // The navigate branch must fall back to offline cache on failure — not store
    // the successful response.  We verify the navigate section only has .catch(),
    // not a cache write.  (cache.put IS present in the static-asset branch below.)
    const navigateStart = sw.indexOf(`request.mode === "navigate"`);
    const staticStart   = sw.indexOf("STATIC_EXT.test(url.pathname)");
    // Extract just the navigate block (between the navigate check and the static-asset check)
    const navigateSection = sw.slice(navigateStart, staticStart);
    expect(navigateSection).toContain(".catch(");
    expect(navigateSection).not.toContain("cache.put");
  });

  it("does not pre-cache /dashboard or any authenticated page", () => {
    expect(sw).not.toContain("/dashboard");
    expect(sw).not.toContain("cache.addAll");
  });

  it("static asset cache-first path still present and unchanged", () => {
    expect(sw).toContain("STATIC_EXT.test(url.pathname)");
    expect(sw).toContain("caches.match(request)");
  });
});

// ─── Offline page ─────────────────────────────────────────────────────────────

describe("Offline page — app/offline/page.tsx", () => {
  const page = readSrc("app/offline/page.tsx");

  it("is force-static so Next.js pre-renders it at build time", () => {
    expect(page).toContain(`export const dynamic = "force-static"`);
  });

  it('does not use "use client" (must work without hydration)', () => {
    expect(page).not.toContain('"use client"');
  });

  it("does not import Supabase or auth utilities", () => {
    expect(page).not.toContain("supabase");
    expect(page).not.toContain("@/lib/auth");
    expect(page).not.toContain("getUser");
  });

  it("contains retry Link pointing to /dashboard", () => {
    // Link renders as <a href="/dashboard"> in the DOM; source has href="/dashboard"
    expect(page).toContain('href="/dashboard"');
  });

  it("contains fallback Link pointing to home page", () => {
    expect(page).toContain('href="/"');
  });

  it("imports Link from next/link (not bare <a> tag)", () => {
    expect(page).toContain(`from "next/link"`);
  });
});

// ─── Manifest icons ───────────────────────────────────────────────────────────

describe("PWA manifest — public/manifest.json", () => {
  const manifest = JSON.parse(readSrc("public/manifest.json"));

  it("uses icon-192.png for the 192×192 any-purpose icon", () => {
    const icon = manifest.icons.find(
      (i: { sizes: string }) => i.sizes === "192x192"
    );
    expect(icon).toBeDefined();
    expect(icon.src).toBe("/icon-192.png");
  });

  it("uses icon-512.png for the 512×512 maskable icon", () => {
    const icon = manifest.icons.find(
      (i: { sizes: string }) => i.sizes === "512x512"
    );
    expect(icon).toBeDefined();
    expect(icon.src).toBe("/icon-512.png");
    expect(icon.purpose).toBe("maskable");
  });

  it("shortcuts reference icon-192.png, not new_logo_1.png", () => {
    for (const shortcut of manifest.shortcuts ?? []) {
      for (const icon of shortcut.icons ?? []) {
        if (icon.sizes === "192x192") {
          expect(icon.src).toBe("/icon-192.png");
        }
      }
    }
  });
});
