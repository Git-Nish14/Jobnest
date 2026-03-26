import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Newsreader, Manrope } from "next/font/google";
import {
  BarChart3,
  PenLine,
  Lock,
  Sparkles,
  LayoutDashboard,
  BadgeCheck,
  Clock,
  Star,
} from "lucide-react";
import {
  LandingScrollLink,
  LandingScrollToTop,
} from "@/components/landing/LandingScrollLink";
import "./landing.css";

export const dynamic = "force-dynamic";

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

export default async function Home() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) redirect("/dashboard");
  } catch {
    // Supabase not configured yet, show landing page
  }

  return (
    <div
      className={`${newsreader.variable} ${manrope.variable} min-h-screen landing-root`}
    >
      {/* ── Header ── */}
      <header className="fixed top-0 w-full z-50 backdrop-blur-md border-b landing-header">
        <div className="flex justify-between items-center px-6 py-3.5 w-full max-w-7xl mx-auto">
          {/* Logo */}
          <LandingScrollToTop className="flex items-center gap-2.5 cursor-pointer bg-transparent border-none p-0">
            <Image
              src="/new_logo_1.png"
              alt="Jobnest"
              width={36}
              height={36}
              priority
            />
            <span className="text-xl landing-logo-text">Jobnest</span>
          </LandingScrollToTop>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-2">
            <LandingScrollToTop className="font-semibold text-sm px-3 py-1.5 rounded-lg landing-nav-active bg-transparent border-none cursor-pointer">
              Overview
            </LandingScrollToTop>
            <LandingScrollLink
              sectionId="features"
              className="text-sm px-3 py-1.5 rounded-lg landing-nav-link"
            >
              Features
            </LandingScrollLink>
            <LandingScrollLink
              sectionId="testimonials"
              className="text-sm px-3 py-1.5 rounded-lg landing-nav-link"
            >
              Testimonials
            </LandingScrollLink>
          </nav>

          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="hidden sm:block text-sm font-medium landing-login-link"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="px-6 py-2 rounded-full font-medium text-sm transition-all landing-btn-primary"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <main className="pt-28 pb-24">
        {/* ── Hero ── */}
        <section className="max-w-7xl mx-auto px-6 mb-24 lg:mb-32">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            {/* Left */}
            <div className="lg:col-span-7 space-y-8">
              <h1 className="text-5xl md:text-7xl tracking-tight leading-[1.1] landing-serif">
                Organize your job Application.
                <br />
                <span className="landing-gradient-text">Land faster.</span>
              </h1>

              <p className="text-xl max-w-xl leading-relaxed landing-subtext">
                The thoughtful workspace for the modern professional. Track
                applications, manage interviews, and curate your career path
                with editorial precision.
              </p>

              <div className="flex flex-wrap gap-4 pt-4">
                <Link
                  href="/signup"
                  className="px-10 py-4 rounded-full font-bold text-lg transition-all landing-btn-hero-cta"
                >
                  Get Started Free
                </Link>
                <Link
                  href="/login"
                  className="px-10 py-4 rounded-full font-bold text-lg transition-all border landing-btn-hero-ghost"
                >
                  Sign In
                </Link>
              </div>

              <div className="flex items-center gap-2 text-sm font-medium pt-2 landing-verified-text">
                <BadgeCheck className="w-4 h-4 text-[#006d34]" />
                Free for individuals during early access.
              </div>
            </div>

            {/* Right — visual */}
            <div className="lg:col-span-5 relative">
              <div className="aspect-square rounded-xl relative overflow-hidden landing-hero-visual">
                {/* Decorative dashboard skeleton */}
                <div className="absolute inset-0 p-8 flex flex-col gap-3 opacity-25">
                  <div className="flex gap-2 mb-2">
                    <div className="h-2 w-16 rounded-full bg-[#99462a]" />
                    <div className="h-2 w-24 rounded-full bg-white/20" />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[...Array(3)].map((_, i) => (
                      <div
                        key={i}
                        className="h-16 rounded-lg border border-white/10 bg-white/4"
                      />
                    ))}
                  </div>
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="h-8 rounded-lg border border-white/10 bg-white/3"
                    />
                  ))}
                </div>
                <div className="absolute inset-0 bg-linear-to-tr from-[#99462a]/15 to-transparent" />
              </div>

              {/* Floating card */}
              <div className="absolute -bottom-6 -left-6 p-6 rounded-lg max-w-xs border landing-floating-card">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[#ffdbd0]">
                    <Sparkles className="w-5 h-5 text-[#99462a]" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest landing-subtext">
                      Next Step
                    </p>
                    <p className="text-sm font-bold">
                      Interview with Design Studio
                    </p>
                  </div>
                </div>
                <div className="h-2 w-full rounded-full overflow-hidden bg-[#efeeec]">
                  <div className="h-full rounded-full w-3/4 bg-[#d97757]" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Features Bento ── */}
        <section id="features" className="max-w-7xl mx-auto px-6 mb-32">
          <div className="mb-16">
            <h2 className="text-3xl md:text-4xl mb-4 landing-serif text-[#1a1c1b]">
              Features for the focused mind
            </h2>
            <div className="h-1 w-20 rounded-full bg-[#d97757]" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Large card */}
            <div className="md:col-span-2 rounded-xl p-10 flex flex-col justify-between min-h-95 bg-[#f4f3f1]">
              <div>
                <LayoutDashboard className="w-10 h-10 text-[#99462a] mb-6" />
                <h3 className="text-3xl mb-4 landing-serif">
                  Centralized Intelligence
                </h3>
                <p className="text-lg max-w-md leading-relaxed landing-subtext">
                  A single source of truth for your professional journey. From
                  first contact to final offer, every detail is meticulously
                  organized.
                </p>
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                {["Application Tracker", "Contact CRM", "Document Vault"].map(
                  (tag) => (
                    <span
                      key={tag}
                      className="px-4 py-2 rounded-full text-xs font-bold uppercase tracking-tighter bg-[#e3e2e0]"
                    >
                      {tag}
                    </span>
                  ),
                )}
              </div>
            </div>

            {/* Accent tall card */}
            <div className="rounded-xl p-10 flex flex-col justify-end relative overflow-hidden group min-h-95 bg-[#99462a] text-white">
              <div className="absolute top-0 right-0 p-8 opacity-20 group-hover:scale-110 transition-transform duration-500">
                <Clock className="w-28 h-28" />
              </div>
              <h3 className="text-3xl mb-4 relative z-10 landing-serif">
                Smart Alerts
              </h3>
              <p className="relative z-10 leading-relaxed landing-accent-card-subtext">
                Never miss a follow-up. Our intelligent notification system
                keeps you one step ahead of the competition.
              </p>
            </div>

            {/* Small cards */}
            {[
              {
                Icon: BarChart3,
                title: "Insightful Analytics",
                desc: "Visualize your conversion rates across different stages of the funnel.",
              },
              {
                Icon: PenLine,
                title: "Interview Journal",
                desc: "Refined space for note-taking during and after your conversations.",
              },
              {
                Icon: Lock,
                title: "Privacy First",
                desc: "Your data is encrypted and never sold. You are the curator of your story.",
              },
            ].map(({ Icon, title, desc }) => (
              <div key={title} className="rounded-xl p-10 bg-[#f4f3f1]">
                <Icon className="w-7 h-7 text-[#99462a] mb-6" />
                <h3 className="text-2xl mb-2 landing-serif">{title}</h3>
                <p className="text-sm leading-relaxed landing-subtext">
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Testimonials ── */}
        <section id="testimonials" className="py-24 bg-[#f4f3f1]">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
              <p className="text-xs uppercase tracking-[0.2em] mb-4 font-bold text-[#99462a]">
                Trusted by the best
              </p>
              <h2 className="text-4xl landing-serif">Words from the Atelier</h2>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  quote:
                    "Jobnest transformed my chaotic search into a refined strategy. I felt like I was managing a gallery, not a spreadsheet.",
                  name: "Eleanor Vance",
                  role: "Senior Product Designer",
                  initial: "E",
                },
                {
                  quote:
                    "The editorial feel of the UI makes me actually want to log in and update my progress. A true sanctuary for focus.",
                  name: "Julian Thorne",
                  role: "Technical Architect",
                  initial: "J",
                },
                {
                  quote:
                    "Finally, a tool that respects the complexity of a modern career. The design is as intelligent as the features it holds.",
                  name: "Sophia Chen",
                  role: "Director of Operations",
                  initial: "S",
                },
              ].map(({ quote, name, role, initial }) => (
                <div
                  key={name}
                  className="p-8 rounded-lg landing-testimonial-card"
                >
                  <div className="flex gap-1 mb-6">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className="w-4 h-4 fill-[#99462a] text-[#99462a]"
                      />
                    ))}
                  </div>
                  <p className="text-xl mb-8 leading-relaxed landing-quote">
                    &ldquo;{quote}&rdquo;
                  </p>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white shrink-0 bg-[#99462a]">
                      {initial}
                    </div>
                    <div>
                      <p className="font-bold text-sm">{name}</p>
                      <p className="text-xs landing-subtext">{role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing ── */}
        <section className="max-w-5xl mx-auto px-6 py-24">
          <div className="text-center mb-14">
            <p className="text-xs uppercase tracking-[0.2em] mb-4 font-bold text-[#99462a]">
              Pricing
            </p>
            <h2 className="text-4xl landing-serif">Simple, transparent pricing</h2>
            <p className="text-lg text-[#55433d] mt-4 max-w-md mx-auto leading-relaxed">
              Every feature, every application, no credit card required.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* Free plan */}
            <div className="relative bg-[#f4f3f1] rounded-2xl p-8 flex flex-col">
              <div className="mb-6">
                <p className="text-xs font-bold uppercase tracking-widest text-[#55433d] mb-2">Free</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-bold text-[#1a1c1b] landing-serif">$0</span>
                  <span className="text-[#55433d]">/ forever</span>
                </div>
                <p className="text-sm text-[#55433d] mt-2">Everything you need to land your dream job.</p>
              </div>
              <ul className="space-y-3 flex-1 mb-8">
                {[
                  "Unlimited job applications",
                  "AI-powered assistant (NESTAi)",
                  "Interview tracking & reminders",
                  "Document storage & management",
                  "Salary comparison tracker",
                  "Email templates library",
                  "Contact relationship manager",
                  "Data export (CSV & JSON)",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm text-[#55433d]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#99462a] shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className="block text-center px-8 py-3.5 rounded-full font-bold text-white bg-[#99462a] hover:bg-[#d97757] transition-colors"
              >
                Get Started Free
              </Link>
            </div>

            {/* Pro plan — coming soon */}
            <div className="relative bg-[#1a1c1b] rounded-2xl p-8 flex flex-col overflow-hidden">
              <div className="absolute top-4 right-4">
                <span className="px-3 py-1 rounded-full bg-[#d97757]/20 text-[#d97757] text-xs font-bold uppercase tracking-widest">
                  Coming Soon
                </span>
              </div>
              {/* Subtle glow */}
              <div className="absolute -bottom-16 -right-16 w-48 h-48 rounded-full bg-[#99462a]/15 blur-3xl" />
              <div className="mb-6 relative">
                <p className="text-xs font-bold uppercase tracking-widest text-[#d97757] mb-2">Pro</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-bold text-white landing-serif">$?</span>
                  <span className="text-white/50">/ month</span>
                </div>
                <p className="text-sm text-white/60 mt-2">Advanced features for power users.</p>
              </div>
              <ul className="space-y-3 flex-1 mb-8 relative">
                {[
                  "Everything in Free",
                  "Advanced analytics & insights",
                  "Priority support",
                  "Custom integrations",
                  "Team collaboration",
                  "Bulk import & advanced export",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm text-white/70">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#d97757] shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled
                className="relative block text-center w-full px-8 py-3.5 rounded-full font-bold text-[#1a1c1b] bg-[#d97757]/60 cursor-not-allowed"
              >
                Join Waitlist
              </button>
            </div>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="max-w-4xl mx-auto px-6 py-32 text-center">
          <h2 className="text-4xl md:text-5xl mb-8 leading-tight landing-serif">
            Elevate your search from a task to a craft.
          </h2>
          <p className="text-xl mb-12 max-w-2xl mx-auto landing-subtext">
            Join a community of thousands who have traded the noise for the
            nuance of Jobnest.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link
              href="/signup"
              className="px-12 py-5 rounded-full font-bold text-xl transition-all landing-btn-cta-primary"
            >
              Get Started Free
            </Link>
            <Link
              href="/login"
              className="px-12 py-5 rounded-full font-bold text-xl transition-all border landing-btn-cta-secondary"
            >
              Sign In
            </Link>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t py-16 landing-footer">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-12">
          {/* Brand */}
          <div className="col-span-2">
            <div className="flex items-center gap-2.5 mb-5">
              <Image
                src="/new_logo_1.png"
                alt="Jobnest"
                width={32}
                height={32}
              />
              <span className="text-xl landing-logo-text">Jobnest</span>
            </div>
            <p className="text-sm leading-relaxed max-w-xs landing-footer-links">
              A digital sanctuary for career growth. Designed for clarity, built
              for progress.
            </p>
            <p className="mt-3 text-xs landing-footer-links">
              A product of{" "}
              <a
                href="https://techifive.com"
                target="_blank"
                rel="noopener noreferrer"
                className="landing-techifive-link"
              >
                Techifive
              </a>
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-bold text-sm mb-6 uppercase tracking-widest">
              Product
            </h4>
            <ul className="space-y-4 text-sm landing-footer-links">
              <li>
                <LandingScrollToTop className="landing-footer-nav-link bg-transparent border-none cursor-pointer p-0 text-sm">
                  Overview
                </LandingScrollToTop>
              </li>
              <li>
                <LandingScrollLink
                  sectionId="features"
                  className="landing-footer-nav-link bg-transparent border-none cursor-pointer p-0 text-sm"
                >
                  Features
                </LandingScrollLink>
              </li>
              <li>
                <LandingScrollLink
                  sectionId="testimonials"
                  className="landing-footer-nav-link bg-transparent border-none cursor-pointer p-0 text-sm"
                >
                  Testimonials
                </LandingScrollLink>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-bold text-sm mb-6 uppercase tracking-widest">
              Legal
            </h4>
            <ul className="space-y-4 text-sm">
              <li>
                <Link href="/privacy" className="landing-footer-nav-link">
                  Privacy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="landing-footer-nav-link">
                  Terms
                </Link>
              </li>
              <li>
                <Link href="/contact" className="landing-footer-nav-link">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Get Access */}
          <div className="col-span-2">
            <h4 className="font-bold text-sm mb-6 uppercase tracking-widest">
              Get Access
            </h4>
            <p className="text-xs mb-4 landing-footer-links">
              Start tracking your job search for free today.
            </p>
            <Link
              href="/signup"
              className="inline-block px-6 py-2 rounded-lg text-sm font-bold transition-all landing-footer-signup"
            >
              Sign Up Free
            </Link>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="max-w-7xl mx-auto px-6 mt-16 pt-8 border-t flex flex-col md:flex-row justify-between gap-4 landing-footer-divider">
          <p className="text-xs landing-copyright">
            © {new Date().getFullYear()} Jobnest — a{" "}
            <a
              href="https://techifive.com"
              target="_blank"
              rel="noopener noreferrer"
              className="landing-techifive-link text-xs font-semibold"
            >
              Techifive
            </a>{" "}
            product. All rights reserved.
          </p>
          <div className="flex gap-6 text-xs">
            <Link href="/privacy" className="landing-footer-nav-link">
              Privacy
            </Link>
            <Link href="/terms" className="landing-footer-nav-link">
              Terms
            </Link>
            <Link href="/contact" className="landing-footer-nav-link">
              Contact
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
