import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isStripeConfigured, isStripeAnnualConfigured } from "@/lib/stripe";
import Link from "next/link";
import Image from "next/image";
import { Newsreader, Manrope } from "next/font/google";
import {
  BadgeCheck,
  HelpCircle,
  ShieldCheck,
  RefreshCw,
  GraduationCap,
  Clock,
  Building2,
  Check,
} from "lucide-react";
import { PricingPlans } from "@/components/pricing/PricingPlans";
import type { User } from "@supabase/supabase-js";
import "../landing.css";
import "./pricing.css";

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

// ── Feature comparison data ─────────────────────────────────────────────────
type FeatureRow = {
  group?: string; // section heading (no free/pro cells)
  name?: string;
  free?: boolean | string;
  pro?: boolean | string;
};

const COMPARISON: FeatureRow[] = [
  { group: "Core" },
  { name: "Job applications", free: "Unlimited", pro: "Unlimited" },
  { name: "NESTAi AI assistant", free: true, pro: true },
  { name: "Interview tracking & reminders", free: true, pro: true },
  { name: "Deadline & follow-up alerts", free: true, pro: true },
  { name: "Document storage & management", free: true, pro: true },
  { name: "Email templates library", free: true, pro: true },
  { name: "Contact relationship manager", free: true, pro: true },
  { name: "Salary comparison tracker", free: true, pro: true },
  { name: "Data export (CSV & JSON)", free: true, pro: true },
  { group: "Pro" },
  { name: "Advanced analytics & insights", free: false, pro: true },
  { name: "Team collaboration", free: false, pro: true },
  { name: "API access", free: false, pro: true },
  { name: "Bulk import & advanced export", free: false, pro: true },
  { name: "Custom integrations", free: false, pro: true },
  { name: "Early access to new features", free: false, pro: true },
  { group: "Support" },
  { name: "Support level", free: "Community", pro: "Priority" },
  { name: "Response time", free: "Best effort", pro: "< 24 h" },
];

// ── Trust badges ────────────────────────────────────────────────────────────
const TRUST = [
  {
    Icon: ShieldCheck,
    label: "Secured by Stripe",
    sub: "Bank-grade encryption",
  },
  { Icon: RefreshCw, label: "Cancel anytime", sub: "No lock-in, ever" },
  {
    Icon: GraduationCap,
    label: "Student discount",
    sub: "1 month free trial",
  },
  { Icon: Clock, label: "30-day free trial", sub: "No card during trial" },
];

// ── FAQ ─────────────────────────────────────────────────────────────────────
const FAQ = [
  {
    q: "Can I cancel anytime?",
    a: "Yes, always. Cancel from your account settings at any time. Your Pro access stays active until the end of the billing period, then you drop back to the Free plan — all your data stays intact.",
  },
  {
    q: "What happens when my student trial ends?",
    a: "After 30 days you'll be charged the standard monthly or annual rate depending on which plan you chose at checkout. We'll email you a reminder before the trial ends. Cancel before then and you won't be billed a penny.",
  },
  {
    q: "Is there an annual billing option?",
    a: "Yes — switch to annual billing and save around 22% compared to paying monthly. You can choose your billing interval when subscribing.",
  },
  {
    q: "What payment methods do you accept?",
    a: "All major credit and debit cards (Visa, Mastercard, Amex, Discover) through Stripe's secure hosted checkout. Apple Pay and Google Pay are supported where your browser allows. You can also apply promo codes at checkout.",
  },
  {
    q: "Do you offer refunds?",
    a: "If you run into a billing issue, reach out within 7 days of a charge and we'll make it right. We handle refunds case by case and aim to be fair.",
  },
  {
    q: "Will my data be safe if I downgrade?",
    a: "Absolutely. Every application, contact, document, and note you've created is preserved when you move between plans. You never lose anything.",
  },
  {
    q: "Can I use a promo code?",
    a: "Yes — there's a promo code field at the Stripe checkout page. If you have a code, enter it there for an instant discount.",
  },
];

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; canceled?: string }>;
}) {
  const params = await searchParams;
  const success = params.success === "true";
  const canceled = params.canceled === "true";

  let user: User | null = null;
  let isSubscribed = false;

  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;

    if (user) {
      const adminClient = createAdminClient();
      const { data: sub } = await adminClient
        .from("subscriptions")
        .select("plan, status")
        .eq("user_id", user.id)
        .maybeSingle();
      isSubscribed = sub?.plan === "pro" && sub?.status === "active";
    }
  } catch {
    // Supabase not configured — show page unauthenticated
  }

  const stripeReady = isStripeConfigured();
  const annualReady = isStripeAnnualConfigured();

  return (
    <div
      className={`${newsreader.variable} ${manrope.variable} min-h-screen landing-root`}
    >
      {/* ── Header ── */}
      <header className="fixed top-0 w-full z-50 backdrop-blur-md border-b landing-header">
        <div className="flex justify-between items-center px-6 py-3.5 w-full max-w-7xl mx-auto">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/new_logo_1.png"
              alt="Jobnest"
              width={36}
              height={36}
              priority
            />
            <span className="text-xl landing-logo-text">Jobnest</span>
          </Link>

          <nav className="hidden md:flex items-center gap-2">
            <Link
              href="/"
              className="text-sm px-3 py-1.5 rounded-lg landing-nav-link"
            >
              Overview
            </Link>
            <Link
              href="/#features"
              className="text-sm px-3 py-1.5 rounded-lg landing-nav-link"
            >
              Features
            </Link>
            <Link
              href="/#testimonials"
              className="text-sm px-3 py-1.5 rounded-lg landing-nav-link"
            >
              Testimonials
            </Link>
            <span className="font-semibold text-sm px-3 py-1.5 rounded-lg landing-nav-active">
              Pricing
            </span>
          </nav>

          <div className="flex items-center gap-4">
            {user ? (
              <Link
                href="/dashboard"
                className="hidden sm:block text-sm font-medium landing-login-link"
              >
                Dashboard
              </Link>
            ) : (
              <Link
                href="/login"
                className="hidden sm:block text-sm font-medium landing-login-link"
              >
                Log in
              </Link>
            )}
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
        {/* ── Toast banners ── */}
        {(success || canceled) && (
          <div className="max-w-4xl mx-auto px-6 mb-8">
            {success && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 border border-green-200 text-green-800">
                <BadgeCheck className="w-5 h-5 shrink-0 text-green-600" />
                <p className="text-sm font-semibold">
                  Welcome to Pro! Your subscription is now active. Enjoy the
                  full sanctuary.
                </p>
              </div>
            )}
            {canceled && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800">
                <HelpCircle className="w-5 h-5 shrink-0 text-amber-600" />
                <p className="text-sm font-semibold">
                  Checkout canceled — no charges were made. You can subscribe
                  anytime.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Hero ── */}
        <section className="max-w-3xl mx-auto px-6 text-center pt-8 pb-14">
          <p className="text-xs uppercase tracking-[0.2em] mb-5 font-bold text-[#99462a]">
            Pricing
          </p>
          <h1 className="text-5xl md:text-6xl mb-6 leading-tight landing-serif">
            Simple, honest pricing
          </h1>
          <p className="text-xl text-[#55433d] max-w-lg mx-auto leading-relaxed">
            Start free and stay free forever. Upgrade to Pro when you&apos;re
            ready for advanced tools — or claim a free month as a student.
          </p>
        </section>

        {/* ── Interactive plan cards (client component) ── */}
        <section className="max-w-4xl mx-auto px-6 pb-16">
          <PricingPlans
            user={user}
            isSubscribed={isSubscribed}
            stripeReady={stripeReady}
            annualReady={annualReady}
          />
        </section>

        {/* ── Trust badges ── */}
        <section className="max-w-4xl mx-auto px-6 pb-20">
          <div className="pricing-trust-grid">
            {TRUST.map(({ Icon, label, sub }) => (
              <div key={label} className="pricing-trust-item">
                <div className="pricing-trust-icon">
                  <Icon className="w-5 h-5 text-[#99462a]" />
                </div>
                <p className="font-bold text-sm text-[#1a1c1b] mt-3 mb-1">
                  {label}
                </p>
                <p className="text-xs text-[#55433d]">{sub}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Feature comparison table ── */}
        <section className="max-w-4xl mx-auto px-6 pb-20">
          <h2 className="text-3xl landing-serif text-center mb-10">
            Compare plans
          </h2>

          <div className="pricing-table-wrapper">
            <table className="pricing-table">
              <thead>
                <tr>
                  <th className="pricing-th-feature">Feature</th>
                  <th className="pricing-th-plan">Free</th>
                  <th className="pricing-th-plan pricing-th-pro">Pro</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, i) =>
                  row.group ? (
                    <tr key={`group-${i}`}>
                      <td
                        colSpan={3}
                        className="pricing-td-group"
                      >
                        {row.group}
                      </td>
                    </tr>
                  ) : (
                    <tr key={row.name} className="pricing-tr">
                      <td className="pricing-td-name">{row.name}</td>
                      <td className="pricing-td-cell">
                        {row.free === true ? (
                          <Check className="w-4 h-4 text-[#99462a] mx-auto" />
                        ) : row.free === false ? (
                          <span className="pricing-td-dash">—</span>
                        ) : (
                          <span className="pricing-td-text">{row.free}</span>
                        )}
                      </td>
                      <td className="pricing-td-cell pricing-td-pro-col">
                        {row.pro === true ? (
                          <Check className="w-4 h-4 text-[#d97757] mx-auto" />
                        ) : row.pro === false ? (
                          <span className="pricing-td-dash">—</span>
                        ) : (
                          <span className="pricing-td-pro-text">{row.pro}</span>
                        )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Enterprise section ── */}
        <section className="max-w-4xl mx-auto px-6 pb-20">
          <div className="pricing-enterprise-card">
            <div className="pricing-enterprise-icon">
              <Building2 className="w-6 h-6 text-[#d97757]" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl landing-serif text-white mb-2">
                Teams &amp; Enterprise
              </h2>
              <p className="text-sm text-white/60 leading-relaxed max-w-lg">
                Running a bootcamp, university career centre, or recruiting
                team? We offer custom plans with volume pricing, onboarding
                support, and dedicated account management.
              </p>
            </div>
            <Link
              href="/contact"
              className="shrink-0 pricing-enterprise-btn"
            >
              Get in touch →
            </Link>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="max-w-2xl mx-auto px-6 pb-24">
          <h2 className="text-3xl landing-serif text-center mb-12">
            Common questions
          </h2>
          <div className="space-y-4">
            {FAQ.map(({ q, a }) => (
              <div key={q} className="p-7 rounded-2xl bg-[#f4f3f1] pricing-faq-card">
                <h3 className="font-bold text-[#1a1c1b] mb-2">{q}</h3>
                <p className="text-sm text-[#55433d] leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="max-w-3xl mx-auto px-6 text-center py-16">
          <h2 className="text-4xl landing-serif mb-6">
            Your career deserves a dedicated space.
          </h2>
          <p className="text-lg text-[#55433d] mb-10 max-w-md mx-auto leading-relaxed">
            Join thousands of professionals who have made Jobnest their career
            sanctuary — free to start, no credit card required.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link
              href="/signup"
              className="px-10 py-4 rounded-full font-bold text-lg transition-all landing-btn-hero-cta"
            >
              Get Started Free
            </Link>
            <Link
              href="/"
              className="px-10 py-4 rounded-full font-bold text-lg transition-all border landing-btn-hero-ghost"
            >
              Learn More
            </Link>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t py-12 landing-footer">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between gap-8">
          <div className="flex items-center gap-2.5">
            <Image src="/new_logo_1.png" alt="Jobnest" width={28} height={28} />
            <span className="text-lg landing-logo-text">Jobnest</span>
          </div>
          <div className="flex flex-wrap gap-8 text-sm landing-footer-links">
            <Link href="/" className="landing-footer-nav-link">Overview</Link>
            <Link href="/#features" className="landing-footer-nav-link">Features</Link>
            <Link href="/pricing" className="landing-footer-nav-link">Pricing</Link>
            <Link href="/privacy" className="landing-footer-nav-link">Privacy</Link>
            <Link href="/terms" className="landing-footer-nav-link">Terms</Link>
            <Link href="/cookies" className="landing-footer-nav-link">Cookies</Link>
            <Link href="/contact" className="landing-footer-nav-link">Contact</Link>
            <Link href="/privacy#do-not-sell" className="landing-footer-nav-link">Do Not Sell My Info</Link>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 mt-8 pt-6 border-t landing-footer-divider">
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
        </div>
      </footer>
    </div>
  );
}
