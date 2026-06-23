import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Toaster } from "@/components/ui/sonner";
import { CookieBanner } from "@/components/layout/CookieBanner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://jobnest.nishpatel.dev";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Jobnest - Track Your Job Applications",
    template: "%s | Jobnest",
  },
  description:
    "The simple, powerful way to organize your job search. Track every application, manage documents, and land your dream job faster.",
  keywords: [
    "job application tracker",
    "job search organiser",
    "ATS resume scanner",
    "AI job coach",
    "NESTAi",
    "interview tracker",
    "job hunt tool",
    "application status tracker",
    "resume keyword checker",
    "follow-up reminders",
    "salary comparison",
    "ghosted job application",
    "visa sponsorship tracker",
    "career management app",
    "free job tracker",
  ],
  authors: [{ name: "Nish Patel", url: "https://nishpatel.dev" }],
  creator: "Nish Patel",
  publisher: "Nish Patel",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Jobnest",
    title: "Jobnest - Track Your Job Applications",
    description:
      "The simple, powerful way to organize your job search. Track every application, manage documents, and land your dream job faster.",
    images: [
      {
        url: "/new_logo_1.png",
        width: 512,
        height: 512,
        alt: "Jobnest Logo",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Jobnest - Track Your Job Applications",
    description:
      "The simple, powerful way to organize your job search. Track every application, manage documents, and land your dream job faster.",
    images: ["/new_logo_1.png"],
    creator: "@Git-Nish14",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  // File-based icons (app/icon.png, app/apple-icon.png) take priority;
  // these metadata entries are fallbacks for older browsers / crawlers.
  icons: {
    icon: "/new_logo_1.png",
    shortcut: "/new_logo_1.png",
    apple: "/new_logo_1.png",
  },
  manifest: "/manifest.json",
  category: "productivity",
};

export const viewport: Viewport = {
  themeColor: "#99462a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  // Allows content to extend into the notch/home-indicator area so that
  // env(safe-area-inset-*) values are non-zero and our fixed bars sit correctly.
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Nonce injected by proxy.ts via x-nonce header — required for CSP compliance.
  // The anti-flash inline script must carry this nonce or it's blocked when
  // 'unsafe-inline' is ignored (which happens whenever a nonce is present).
  const nonce = (await headers()).get("x-nonce") ?? "";

  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <meta name="application-name" content="Jobnest" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Jobnest" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#3b82f6" />
        <meta name="msapplication-tap-highlight" content="no" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-background font-sans antialiased`}
      >
        {/* Anti-flash: reads localStorage before first paint and sets class on <html>.
            nonce is a per-request value injected by proxy.ts — it intentionally
            differs between the server render and React's client reconciliation,
            so suppressHydrationWarning is correct here (not a bug to work around). */}
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var d=document.documentElement;var t=localStorage.getItem('jobnest_theme');if(t==='dark'){d.classList.add('dark');d.style.backgroundColor='#000000';}else{d.style.backgroundColor='#faf9f7';}}catch(e){}})();`,
          }}
        />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[200] focus:rounded-lg focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-lg focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:outline-none"
        >
          Skip to content
        </a>
        {children}
        <Toaster richColors position="top-right" />
        <CookieBanner />
        <SpeedInsights />
      </body>
    </html>
  );
}
