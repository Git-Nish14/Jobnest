import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
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
    "The simple, powerful way to organize your job search. Track every application, manage documents, and land your dream job faster. Free forever.",
  keywords: [
    "job tracker",
    "job applications",
    "career",
    "job search",
    "application tracking",
    "job hunting",
    "employment",
    "resume tracker",
    "interview tracker",
  ],
  authors: [{ name: "Techifive", url: "https://techifive.com" }],
  creator: "Techifive",
  publisher: "Techifive",
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
    creator: "@techifive",
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
