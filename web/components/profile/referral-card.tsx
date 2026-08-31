"use client";

import { useState, useEffect } from "react";
import { Gift, Copy, CheckCheck, Users, TrendingUp, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ReferralData {
  code: string;
  referralUrl: string;
  stats: { clicks: number; signups: number; converted: number };
  events: Array<{ status: string; rewardGranted: boolean; joinedAt: string }>;
}

export function ReferralCard() {
  const [data, setData]       = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied]   = useState(false);

  useEffect(() => {
    fetch("/api/referrals", { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((j) => j && setData(j))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function copyLink() {
    if (!data) return;
    navigator.clipboard.writeText(data.referralUrl).then(() => {
      setCopied(true);
      toast.success("Referral link copied!");
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => toast.error("Could not copy link"));
  }

  return (
    <div className="db-content-card">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/30 shrink-0">
          <Gift className="h-5 w-5 text-violet-600 dark:text-violet-400" />
        </div>
        <div>
          <h2 className="db-headline text-lg">Refer a friend</h2>
          <p className="text-sm text-muted-foreground">
            Share Jobnest &mdash; when a friend upgrades to Pro, you both get 1 free month.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your referral link…
        </div>
      ) : !data ? (
        <p className="text-sm text-muted-foreground">Could not load referral data. Please refresh.</p>
      ) : (
        <>
          {/* Referral link */}
          <div className="flex gap-2 mb-6">
            <div className="flex-1 min-w-0 rounded-lg border border-[#dbc1b9]/50 bg-[#f9f7f5] dark:bg-[#1a1c1b] px-3 py-2.5">
              <p className="text-xs text-muted-foreground mb-0.5 font-medium">Your invite link</p>
              <p className="text-sm font-mono truncate text-[#1a1c1b] dark:text-[#faf9f7]">
                {data.referralUrl}
              </p>
            </div>
            <button
              type="button"
              onClick={copyLink}
              className={cn(
                "shrink-0 flex items-center gap-1.5 px-3 rounded-lg border text-sm font-medium transition-all",
                copied
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400"
                  : "border-[#dbc1b9]/50 bg-white dark:bg-[#1a1c1b] hover:bg-[#f4f3f1] dark:hover:bg-[#252827] text-[#1a1c1b] dark:text-[#faf9f7]"
              )}
            >
              {copied ? <CheckCheck className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { icon: ExternalLink, label: "Link clicks", value: data.stats.clicks },
              { icon: Users,        label: "Sign-ups",   value: data.stats.signups },
              { icon: TrendingUp,   label: "Converted",  value: data.stats.converted },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="rounded-lg border border-[#dbc1b9]/40 bg-[#f9f7f5] dark:bg-[#1a1c1b] p-3 text-center">
                <Icon className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                <p className="text-xl font-bold tabular-nums text-[#1a1c1b] dark:text-[#faf9f7]">{value}</p>
                <p className="text-[11px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>

          {/* How it works */}
          <div className="rounded-lg bg-violet-50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/30 p-4">
            <p className="text-xs font-semibold text-violet-700 dark:text-violet-400 mb-2 uppercase tracking-wide">How it works</p>
            <ol className="space-y-1 text-sm text-violet-800 dark:text-violet-300">
              <li>1. Share your unique link with a friend who&apos;s job hunting.</li>
              <li>2. They sign up — no credit card needed.</li>
              <li>3. When they upgrade to Pro, you both get 1 free month added automatically.</li>
            </ol>
          </div>

          {/* Recent referral events */}
          {data.events.length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Recent referrals
              </p>
              <ul className="space-y-1.5">
                {data.events.slice(0, 5).map((ev, i) => (
                  <li key={i} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {new Date(ev.joinedAt).toLocaleDateString()}
                    </span>
                    <span className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-medium",
                      ev.status === "converted"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "bg-[#f4f3f1] text-muted-foreground dark:bg-[#252827]"
                    )}>
                      {ev.status === "converted" ? "Converted ✓" : "Signed up"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
