// Fonts (--font-newsreader, --font-manrope) cascade from root layout.tsx.
import Link from "next/link";
import type { Metadata } from "next";
import { LandingHeader } from "@/components/layout/LandingHeader";
import { LandingFooter } from "@/components/layout/LandingFooter";
import "./landing.css";

export const metadata: Metadata = {
  title: "Page Not Found | Jobnest",
  description: "The page you're looking for doesn't exist.",
  robots: { index: false, follow: false },
};

const QUICK_LINKS = [
  { href: "/dashboard",    label: "Dashboard" },
  { href: "/applications", label: "Applications" },
  { href: "/nestai",       label: "NESTAi" },
  { href: "/contact",      label: "Contact" },
];

export default function NotFound() {
  return (
    <div className="landing-root flex min-h-screen flex-col">
      <LandingHeader />

      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20 relative overflow-hidden">
        {/* Decorative ring */}
        <div aria-hidden="true" style={ring} />

        {/* 404 hero number */}
        <p aria-hidden="true" style={hero}>404</p>

        <h1 style={heading}>This page has flown the nest.</h1>

        <p style={body}>
          The URL may have changed, or this page never existed.<br />
          Your job search, however, is right where you left it.
        </p>

        <div className="flex flex-wrap gap-3 items-center justify-center relative z-10 mb-10">
          <Link
            href="/"
            className="landing-btn-hero-cta inline-block px-7 py-2.5 rounded-full font-semibold text-sm"
          >
            ← Back to Home
          </Link>
          <Link
            href="/dashboard"
            className="landing-btn-hero-ghost border inline-block px-7 py-2.5 rounded-full font-semibold text-sm"
          >
            Go to Dashboard →
          </Link>
        </div>

        <div aria-hidden="true" style={divider} />

        <nav aria-label="Helpful links" className="flex flex-wrap gap-6 justify-center relative z-10">
          {QUICK_LINKS.map(({ href, label }) => (
            <Link key={href} href={href} className="landing-footer-nav-link text-sm">
              {label}
            </Link>
          ))}
        </nav>
      </main>

      <LandingFooter />
    </div>
  );
}

const ring: React.CSSProperties = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: "clamp(22rem, 55vw, 42rem)",
  height: "clamp(22rem, 55vw, 42rem)",
  borderRadius: "50%",
  border: "1px solid var(--atelier-outline-var)",
  opacity: 0.5,
  pointerEvents: "none",
  zIndex: 0,
};

const hero: React.CSSProperties = {
  fontFamily: "var(--font-newsreader, Georgia, serif)",
  fontStyle: "italic",
  fontWeight: 700,
  fontSize: "clamp(8rem, 24vw, 18rem)",
  lineHeight: 1,
  color: "var(--atelier-primary)",
  opacity: 0.12,
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  pointerEvents: "none",
  userSelect: "none",
  zIndex: 0,
  margin: 0,
};

const heading: React.CSSProperties = {
  fontFamily: "var(--font-newsreader, Georgia, serif)",
  fontStyle: "italic",
  fontWeight: 600,
  fontSize: "clamp(1.6rem, 4.5vw, 2.5rem)",
  color: "var(--atelier-on-surface)",
  marginBottom: "0.85rem",
  position: "relative",
  zIndex: 1,
};

const body: React.CSSProperties = {
  color: "var(--atelier-on-surface-var)",
  fontSize: "1rem",
  lineHeight: 1.75,
  maxWidth: "28rem",
  marginBottom: "2.25rem",
  position: "relative",
  zIndex: 1,
};

const divider: React.CSSProperties = {
  width: "2.5rem",
  height: "1px",
  backgroundColor: "var(--atelier-outline-var)",
  margin: "2.5rem auto 1.75rem",
  position: "relative",
  zIndex: 1,
};
