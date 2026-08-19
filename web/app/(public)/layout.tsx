import { LandingHeader } from "@/components/layout/LandingHeader";
import { LandingFooter } from "@/components/layout/LandingFooter";
import type { ReactNode } from "react";
import "../landing.css";

// Fonts (--font-newsreader, --font-manrope) cascade from root layout.tsx.
// PPR would apply here (fully static pages), but cacheComponents is globally
// incompatible with the force-dynamic dashboard routes — deferred.

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="landing-root flex min-h-screen flex-col">
      <LandingHeader />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <LandingFooter />
    </div>
  );
}
