"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { Check, Sparkles, GraduationCap, BadgeCheck } from "lucide-react";
import Link from "next/link";

interface Props {
  user: User | null;
  isSubscribed: boolean;
  stripeReady: boolean;
  annualReady: boolean;
}

const FREE_FEATURES = [
  "Unlimited job applications",
  "AI-powered assistant (NESTAi)",
  "Interview tracking & reminders",
  "Deadline & follow-up alerts",
  "Document storage & management",
  "Email templates library",
  "Contact relationship manager",
  "Salary comparison tracker",
  "Data export (CSV & JSON)",
];

const PRO_FEATURES = [
  "Everything in Free",
  "Advanced analytics & insights",
  "Team collaboration",
  "API access",
  "Bulk import & advanced export",
  "Custom integrations",
  "Priority support",
  "Early access to new features",
];

type BillingInterval = "monthly" | "annual";

export function PricingPlans({
  user,
  isSubscribed,
  stripeReady,
  annualReady,
}: Props) {
  const router = useRouter();
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const [loading, setLoading] = useState<"pro" | "student" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const MONTHLY_PRICE = 9;
  const ANNUAL_MONTHLY = 7; // $84/yr ÷ 12
  const ANNUAL_TOTAL = 84;
  const SAVINGS_PCT = Math.round((1 - ANNUAL_MONTHLY / MONTHLY_PRICE) * 100);

  const displayPrice =
    interval === "annual" ? ANNUAL_MONTHLY : MONTHLY_PRICE;

  async function checkout(opts: { trial?: boolean } = {}) {
    setError(null);
    if (!user) {
      router.push("/login?next=/pricing");
      return;
    }

    const key = opts.trial ? "student" : "pro";
    setLoading(key);

    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval, trial: opts.trial ?? false }),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Something went wrong. Please try again.");
        setLoading(null);
        return;
      }
      if (json.url) window.location.href = json.url;
    } catch {
      setError("Network error. Please try again.");
      setLoading(null);
    }
  }

  return (
    <div>
      {/* ── Billing interval toggle ── */}
      {stripeReady && annualReady && (
        <div className="flex justify-center mb-10">
          <div className="pricing-billing-toggle">
            <button
              type="button"
              onClick={() => setInterval("monthly")}
              className={`pricing-toggle-btn${interval === "monthly" ? " pricing-toggle-btn-active" : ""}`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setInterval("annual")}
              className={`pricing-toggle-btn${interval === "annual" ? " pricing-toggle-btn-active" : ""}`}
            >
              Annual
              <span className="pricing-save-badge">Save {SAVINGS_PCT}%</span>
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-center text-sm text-red-500 mb-6 font-medium">
          {error}
        </p>
      )}

      {/* ── Plan cards ── */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Free */}
        <div className="bg-[#f4f3f1] rounded-2xl p-9 flex flex-col pricing-card">
          <div className="mb-8">
            <p className="text-xs font-bold uppercase tracking-widest text-[#55433d] mb-3">
              Free
            </p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-6xl font-bold text-[#1a1c1b] landing-serif">
                $0
              </span>
              <span className="text-[#55433d] text-lg">/ forever</span>
            </div>
            <p className="text-sm text-[#55433d] mt-3">
              Everything you need to land your dream job.
            </p>
          </div>

          <ul className="space-y-3.5 flex-1 mb-9">
            {FREE_FEATURES.map((f) => (
              <li
                key={f}
                className="flex items-center gap-3 text-sm text-[#55433d]"
              >
                <Check className="w-4 h-4 text-[#99462a] shrink-0" />
                {f}
              </li>
            ))}
          </ul>

          <Link
            href="/signup"
            className="block text-center px-8 py-3.5 rounded-full font-bold text-white transition-colors landing-btn-hero-cta"
          >
            Get Started Free
          </Link>
        </div>

        {/* Pro */}
        <div className="relative bg-[#1a1c1b] rounded-2xl p-9 flex flex-col overflow-hidden pricing-card pricing-card-dark">
          {/* Top accent line */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#d97757]/50 to-transparent" />
          {/* Glow */}
          <div className="absolute -bottom-20 -right-20 w-64 h-64 rounded-full bg-[#99462a]/15 blur-3xl pointer-events-none" />

          {/* Most popular badge */}
          <div className="absolute top-5 right-5">
            <span className="pricing-popular-badge">
              <Sparkles className="inline w-3 h-3 mr-1" />
              Most Popular
            </span>
          </div>

          <div className="mb-8 relative">
            <p className="text-xs font-bold uppercase tracking-widest text-[#d97757] mb-3">
              Pro
            </p>
            <div className="flex items-end gap-2">
              <span className="text-6xl font-bold text-white landing-serif">
                ${displayPrice}
              </span>
              <div className="pb-2">
                <p className="text-white/50 text-base leading-none">/mo</p>
                {interval === "annual" && (
                  <p className="text-[11px] text-white/35 mt-1">
                    billed ${ANNUAL_TOTAL}/year
                  </p>
                )}
              </div>
            </div>
            {interval === "annual" && (
              <p className="text-[11px] font-bold text-[#d97757] mt-2">
                You save ${(MONTHLY_PRICE - ANNUAL_MONTHLY) * 12}/year
              </p>
            )}
            <p className="text-sm text-white/60 mt-3">
              Advanced tools for power users and teams.
            </p>
          </div>

          <ul className="space-y-3.5 flex-1 mb-9 relative">
            {PRO_FEATURES.map((f) => (
              <li
                key={f}
                className="flex items-center gap-3 text-sm text-white/75"
              >
                <Check className="w-4 h-4 text-[#d97757] shrink-0" />
                {f}
              </li>
            ))}
          </ul>

          <div className="relative">
            {isSubscribed ? (
              <div className="block w-full text-center px-8 py-3.5 rounded-full font-bold text-[#1a1c1b]/50 bg-[#d97757]/30 cursor-not-allowed select-none">
                Current Plan
              </div>
            ) : !stripeReady ? (
              <div className="block w-full text-center px-8 py-3.5 rounded-full font-bold text-white/30 bg-white/8 cursor-not-allowed select-none">
                Coming Soon
              </div>
            ) : (
              <button
                type="button"
                onClick={() => checkout()}
                disabled={loading !== null}
                className="pricing-pro-btn"
              >
                {loading === "pro"
                  ? "Redirecting…"
                  : user
                    ? "Subscribe to Pro"
                    : "Get Started"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Student offer ── */}
      {stripeReady && (
        <div className="mt-6 pricing-student-card">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6 p-8">
            {/* Icon */}
            <div className="pricing-student-icon-wrap shrink-0">
              <GraduationCap className="w-6 h-6 text-[#d97757]" />
            </div>

            {/* Copy */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <h3 className="font-bold text-white text-lg leading-snug">
                  Student offer — 1 month free
                </h3>
                <span className="pricing-no-commitment-badge">
                  No commitment
                </span>
              </div>
              <p className="text-sm text-white/55 leading-relaxed">
                Get full Pro access for 30 days on us — no charge until after
                your trial ends. Cancel any time before and you&apos;ll pay
                nothing. Valid for students and recent graduates.
              </p>
            </div>

            {/* CTA */}
            <div className="shrink-0 w-full md:w-auto">
              {isSubscribed ? (
                <div className="text-center px-7 py-3 rounded-full text-sm font-bold text-white/30 bg-white/8 cursor-not-allowed select-none">
                  Already on Pro
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => checkout({ trial: true })}
                  disabled={loading !== null}
                  className="pricing-student-btn"
                >
                  {loading === "student"
                    ? "Redirecting…"
                    : "Claim Student Offer →"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Reassurance line ── */}
      <p className="text-center text-sm text-[#55433d] mt-6">
        <BadgeCheck className="inline w-4 h-4 text-[#99462a] mr-1.5 -mt-0.5" />
        No credit card required for Free · Billed securely via Stripe · Cancel
        anytime
      </p>
    </div>
  );
}
