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
  BriefcaseBusiness,
  MessageSquare,
  TrendingUp,
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
            <Link
              href="/pricing"
              className="text-sm px-3 py-1.5 rounded-lg landing-nav-link"
            >
              Pricing
            </Link>
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
                Your sanctuary for
                <br />
                <span className="landing-gradient-text">career growth.</span>
              </h1>

              <p className="text-xl max-w-xl leading-relaxed landing-subtext">
                Jobnest is a calm, organized home for your entire job search —
                track every application, manage interviews, stay on top of
                contacts, and let AI guide you to the role you deserve.
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
                Free to start. No credit card required.
              </div>
            </div>

            {/* Right — Dashboard mockup */}
            <div className="lg:col-span-5 relative hidden lg:block">
              <div className="rounded-2xl overflow-hidden landing-hero-mockup">
                {/* Browser chrome */}
                <div className="px-4 py-2.5 flex items-center gap-3 landing-hero-chrome">
                  <div className="flex gap-1.5 shrink-0">
                    <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
                    <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
                    <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
                  </div>
                  <div className="flex-1 bg-white/8 rounded-full px-3 py-1 text-[10px] text-white/30 select-none">
                    jobnest.app/dashboard
                  </div>
                </div>

                {/* App header */}
                <div className="px-5 py-3 flex items-center justify-between landing-hero-app-header">
                  <span className="text-sm font-medium text-white/80 italic landing-serif">
                    Jobnest
                  </span>
                  <div className="flex gap-4 text-[11px] text-white/40">
                    <span>Dashboard</span>
                    <span>NESTAi</span>
                    <span>Profile</span>
                  </div>
                  <div className="w-7 h-7 rounded-full bg-[#99462a]/70 flex items-center justify-center text-[11px] text-white font-bold">
                    N
                  </div>
                </div>

                {/* Stats */}
                <div className="px-5 pt-5 pb-4 grid grid-cols-3 gap-3">
                  {[
                    {
                      label: "Applied",
                      value: "24",
                      sub: "+3 this week",
                      Icon: BriefcaseBusiness,
                    },
                    {
                      label: "Interviews",
                      value: "8",
                      sub: "2 upcoming",
                      Icon: MessageSquare,
                    },
                    {
                      label: "Offers",
                      value: "2",
                      sub: "Active",
                      Icon: TrendingUp,
                    },
                  ].map(({ label, value, sub, Icon }) => (
                    <div
                      key={label}
                      className="rounded-xl p-3 landing-hero-stat-card"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] text-white/45">{label}</p>
                        <Icon className="w-3 h-3 text-white/20" />
                      </div>
                      <p className="text-2xl font-bold text-white">{value}</p>
                      <p className="text-[9px] text-white/30 mt-0.5">{sub}</p>
                    </div>
                  ))}
                </div>

                {/* Application list */}
                <div className="px-5 pb-4">
                  <p className="text-[10px] uppercase tracking-[0.15em] text-white/30 mb-3">
                    Recent Applications
                  </p>
                  <div className="space-y-2">
                    {[
                      {
                        company: "Stripe",
                        role: "Product Designer",
                        status: "Interview",
                        badgeClass: "landing-hero-badge-interview",
                        initial: "S",
                      },
                      {
                        company: "Linear",
                        role: "UX Engineer",
                        status: "Applied",
                        badgeClass: "landing-hero-badge-applied",
                        initial: "L",
                      },
                      {
                        company: "Vercel",
                        role: "Design Lead",
                        status: "Offer",
                        badgeClass: "landing-hero-badge-offer",
                        initial: "V",
                      },
                    ].map((app) => (
                      <div
                        key={app.company}
                        className="flex items-center justify-between rounded-xl px-3.5 py-2.5 landing-hero-app-row"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/10 text-[11px] font-bold text-white shrink-0">
                            {app.initial}
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold text-white/80">
                              {app.company}
                            </p>
                            <p className="text-[9px] text-white/35">
                              {app.role}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`text-[9px] font-bold px-2.5 py-1 rounded-full ${app.badgeClass}`}
                        >
                          {app.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* NESTAi snippet */}
                <div className="mx-5 mb-5 rounded-xl p-3.5 landing-hero-nestai">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#d97757]" />
                    <span className="text-[10px] font-bold text-[#d97757]">
                      NESTAi
                    </span>
                  </div>
                  <p className="text-[10px] text-white/50 leading-relaxed">
                    Your Stripe interview is tomorrow. Review system design
                    patterns and check your saved notes.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Features Bento ── */}
        <section id="features" className="max-w-7xl mx-auto px-6 mb-32">
          <div className="mb-16">
            <h2 className="text-3xl md:text-4xl mb-4 landing-serif text-[#1a1c1b]">
              Everything your career journey needs
            </h2>
            <div className="h-1 w-20 rounded-full bg-[#d97757]" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Large card */}
            <div className="md:col-span-2 rounded-xl p-10 flex flex-col justify-between min-h-95 bg-[#f4f3f1]">
              <div>
                <LayoutDashboard className="w-10 h-10 text-[#99462a] mb-6" />
                <h3 className="text-3xl mb-4 landing-serif">
                  One home for your entire search
                </h3>
                <p className="text-lg max-w-md leading-relaxed landing-subtext">
                  From your first application to your final offer — every
                  company, contact, document, and deadline lives in one calm,
                  organized sanctuary. No more scattered spreadsheets.
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
                Never miss a moment
              </h3>
              <p className="relative z-10 leading-relaxed landing-accent-card-subtext">
                Timely reminders for follow-ups, interviews, and deadlines keep
                you present and prepared — so no opportunity slips through.
              </p>
            </div>

            {/* Small cards */}
            {[
              {
                Icon: BarChart3,
                title: "Career Analytics",
                desc: "See your job search clearly — response rates, interview stages, and offer trends at a glance.",
              },
              {
                Icon: PenLine,
                title: "Interview Journal",
                desc: "A quiet space to capture your thoughts, questions, and reflections before and after every conversation.",
              },
              {
                Icon: Lock,
                title: "Yours alone",
                desc: "Your career story is private. Your data is encrypted, never sold, and always under your control.",
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
                From our community
              </p>
              <h2 className="text-4xl landing-serif">What people are saying</h2>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  quote:
                    "Jobnest gave my job search a proper home. I stopped drowning in spreadsheets and started making real progress — it's the clarity I didn't know I needed.",
                  name: "Eleanor Vance",
                  role: "Senior Product Designer",
                  initial: "E",
                },
                {
                  quote:
                    "NESTAi feels like a career coach built right in. It reads my resume, understands the role, and helps me walk into every interview prepared.",
                  name: "Julian Thorne",
                  role: "Technical Architect",
                  initial: "J",
                },
                {
                  quote:
                    "I landed a role I actually love. Jobnest kept me organized, reminded me to follow up, and made the whole search feel manageable instead of overwhelming.",
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

        {/* ── Pricing teaser ── */}
        <section className="max-w-4xl mx-auto px-6 py-16 text-center">
          <p className="text-xs uppercase tracking-[0.2em] mb-4 font-bold text-[#99462a]">
            Pricing
          </p>
          <h2 className="text-4xl landing-serif mb-4">
            Free to start. Pro when you&apos;re ready.
          </h2>
          <p className="text-lg text-[#55433d] max-w-md mx-auto leading-relaxed mb-8">
            Full access to every feature on the Free plan — upgrade to Pro for
            advanced analytics, team tools, and priority support.
          </p>
          <Link
            href="/pricing"
            className="inline-block px-10 py-3.5 rounded-full font-bold text-lg transition-all landing-btn-hero-cta"
          >
            See Pricing
          </Link>
        </section>

        {/* ── Final CTA ── */}
        <section className="max-w-4xl mx-auto px-6 py-32 text-center">
          <h2 className="text-4xl md:text-5xl mb-8 leading-tight landing-serif">
            Your career deserves a dedicated space.
          </h2>
          <p className="text-xl mb-12 max-w-2xl mx-auto landing-subtext">
            Join thousands of professionals who have made Jobnest their career
            sanctuary — where every application is tracked, every opportunity
            captured, and every step feels intentional.
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
              A digital sanctuary for career growth — where every application is
              managed, every opportunity tracked, and every step matters.
            </p>
            <p className="mt-3 text-xs landing-footer-links">
              A product of{" "}
              <a
                href="https://nishpatel.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="landing-creator-link"
              >
                Nish Patel
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
              <li>
                <Link href="/pricing" className="landing-footer-nav-link">
                  Pricing
                </Link>
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
              Build your career sanctuary today — free, forever.
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
              href="https://nishpatel.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="landing-creator-link text-xs font-semibold"
            >
              Nish Patel
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
