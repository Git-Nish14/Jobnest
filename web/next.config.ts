import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

// Scope Next.js image optimisation to the specific Supabase project — using
// a wildcard (*.supabase.co) would let anyone use our image endpoint as a proxy
// for any Supabase project's storage, a minor SSRF surface we want to avoid.
const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : null;

const nextConfig: NextConfig = {
  // Enforce HTTPS in production
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io https://*.ingest.sentry.io",
              "frame-src 'self' blob:",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },

  // Redirect HTTP to HTTPS in production
  async redirects() {
    if (process.env.NODE_ENV === "production") {
      return [
        {
          source: "/:path*",
          has: [
            {
              type: "header",
              key: "x-forwarded-proto",
              value: "http",
            },
          ],
          destination: "https://:host/:path*",
          permanent: true,
        },
      ];
    }
    return [];
  },

  // Image optimisation: serve AVIF/WebP to browsers that support them,
  // fall back to the original format. Cache optimised images for 30 days.
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 2592000, // 30 days
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      // Scoped to the specific project hostname so /_next/image cannot be used
      // as an open proxy for arbitrary Supabase storage buckets.
      ...(supabaseHostname
        ? [{ protocol: "https" as const, hostname: supabaseHostname }]
        : []),
    ],
  },

  // Keep native Node.js modules out of the webpack client bundle
  serverExternalPackages: ["pdf-parse", "mammoth", "@react-pdf/renderer"],

  // PPR (Partial Prerendering): cacheComponents: true is incompatible with
  // force-dynamic (used on all auth-gated dashboard routes for session safety).
  // PPR would require migrating auth to a Suspense streaming boundary — deferred.

  experimental: {
    // Tree-shake large packages so only the icons/components actually imported
    // end up in the client bundle. Lucide-react alone ships 1400+ icons;
    // without this, all of them would be included even if only 30 are used.
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-avatar",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-label",
      "@radix-ui/react-select",
      "@radix-ui/react-separator",
      "@radix-ui/react-slot",
      "@radix-ui/react-toast",
      "sonner",
    ],
  },

  // Disable x-powered-by header
  poweredByHeader: false,
};

export default withBundleAnalyzer(withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Only upload source maps when DSN is configured (skips local / preview envs)
  silent: !process.env.SENTRY_DSN,
  widenClientFileUpload: true,
  // Tunnel Sentry requests through own domain so ad-blockers don't drop them
  tunnelRoute: "/monitoring",
  disableLogger: true,
  automaticVercelMonitors: true,
}));
