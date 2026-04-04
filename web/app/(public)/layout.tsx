import { Newsreader, Manrope } from "next/font/google";
import { LandingHeader } from "@/components/layout/LandingHeader";
import { LandingFooter } from "@/components/layout/LandingFooter";
import type { ReactNode } from "react";
import "../landing.css";

// Fonts declared once here for all public pages; Next.js deduplicates them.
const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
  style: ["normal", "italic"],
  weight: ["400", "500", "600", "700"],
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

// Canonical layout for all public-facing pages:
//   /  /pricing  /privacy  /terms  /contact  /cookies
//
// Renders the landing-style sticky header (LandingHeader) and the
// multi-column landing footer (LandingFooter) consistently across every
// public page. Auth state is handled client-side inside LandingHeader so
// this layout can remain a plain (non-async) Server Component.
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${newsreader.variable} ${manrope.variable} landing-root flex min-h-screen flex-col`}>
      <LandingHeader />
      <main className="flex-1">
        {children}
      </main>
      <LandingFooter />
    </div>
  );
}
