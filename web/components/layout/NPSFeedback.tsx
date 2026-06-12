"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { X, Star } from "lucide-react";
import { cn } from "@/lib/utils";

// How long after signup before the first show
const FIRST_SHOW_DAYS = 7;
// Minimum gap between any two shows (submit OR dismiss)
// 15 days ≈ twice a month
const INTERVAL_DAYS = 15;

// localStorage key — stores ISO timestamp of last dismissal
const DISMISSED_AT_KEY = "jobnest_nps_dismissed_at";

/** ms in one day */
const DAY_MS = 1000 * 60 * 60 * 24;

function daysSince(isoOrTimestamp: string | number): number {
  const ts = typeof isoOrTimestamp === "number"
    ? isoOrTimestamp
    : new Date(isoOrTimestamp).getTime();
  return (Date.now() - ts) / DAY_MS;
}

export function NPSFeedback() {
  const [show, setShow]       = useState(false);
  const [score, setScore]     = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]       = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // ── Fast-path: check localStorage dismiss timestamp ────────────────────
    // If the user dismissed within the last INTERVAL_DAYS days, skip network.
    try {
      const dismissedAt = localStorage.getItem(DISMISSED_AT_KEY);
      if (dismissedAt && daysSince(parseInt(dismissedAt, 10)) < INTERVAL_DAYS) {
        return; // still inside the quiet window
      }
      // Expired dismissal — clear it so the next check is a fresh start
      if (dismissedAt) localStorage.removeItem(DISMISSED_AT_KEY);
    } catch { /* private / restricted mode */ }

    let cancelled = false;

    const check = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;

        // ── Stamp first_seen on first visit ─────────────────────────────────
        let firstSeen: string | undefined = user.user_metadata?.first_seen;
        if (!firstSeen) {
          firstSeen = new Date().toISOString();
          await supabase.auth.updateUser({ data: { first_seen: firstSeen } });
          return; // don't show immediately on first visit
        }

        // ── Require FIRST_SHOW_DAYS since sign-up ───────────────────────────
        if (daysSince(firstSeen) < FIRST_SHOW_DAYS) return;

        // ── Twice-a-month: check last submission timestamp ──────────────────
        // Legacy: users who had the old boolean `nps_submitted: true` will
        // have no nps_last_submitted_at — treat as if they submitted a very
        // long time ago so the new interval check takes over cleanly.
        const lastSubmittedAt: string | undefined =
          user.user_metadata?.nps_last_submitted_at;

        if (lastSubmittedAt && daysSince(lastSubmittedAt) < INTERVAL_DAYS) {
          return; // submitted too recently — respect the interval
        }

        if (!cancelled) setShow(true);
      } catch { /* non-fatal — don't break the dashboard */ }
    };

    // Small delay so the widget doesn't fight with first-paint
    const t = setTimeout(check, 3000);
    return () => {
      cancelled = true;
      clearTimeout(t);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  function dismiss() {
    // Store the current timestamp so we respect the INTERVAL_DAYS quiet window
    try {
      localStorage.setItem(DISMISSED_AT_KEY, Date.now().toString());
    } catch { /* private mode */ }
    setShow(false);
  }

  async function submit() {
    if (score === null) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score, comment }),
      });

      if (res.ok) {
        // Stamp the submission time so the widget won't re-show for INTERVAL_DAYS
        const supabase = createClient();
        await supabase.auth.updateUser({
          data: { nps_last_submitted_at: new Date().toISOString() },
        });

        // Clear any lingering dismiss timestamp — the submission timestamp takes over
        try { localStorage.removeItem(DISMISSED_AT_KEY); } catch { /* ok */ }

        setDone(true);
        closeTimerRef.current = setTimeout(() => setShow(false), 2500);
      } else {
        toast.error("Couldn't save feedback — please try again.");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Quick feedback"
      className="fixed bottom-20 md:bottom-6 right-4 z-50 w-80 rounded-2xl border border-border bg-background shadow-xl ring-1 ring-black/5 animate-in slide-in-from-bottom-4 duration-300"
    >
      <div className="flex items-start justify-between px-4 pt-4 pb-2">
        <div>
          <p className="font-semibold text-sm text-foreground">
            {done ? "Thank you! 🎉" : "How's Jobnest working for you?"}
          </p>
          {!done && (
            <p className="text-xs text-muted-foreground mt-0.5">
              0 = Not at all · 10 = Absolutely love it
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss feedback"
          className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors -mr-1"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {!done && (
        <div className="px-4 pb-4 space-y-3">
          {/* Score row */}
          <div className="flex gap-1 flex-wrap">
            {Array.from({ length: 11 }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setScore(i)}
                aria-label={`Score ${i}`}
                className={cn(
                  "h-7 w-7 rounded-lg text-xs font-semibold transition-all",
                  score === i
                    ? "bg-[#99462a] text-white scale-110 shadow-sm"
                    : "bg-muted text-muted-foreground hover:bg-[#99462a]/15 hover:text-[#99462a]"
                )}
              >
                {i}
              </button>
            ))}
          </div>

          {/* Optional comment — font-size 16px on mobile prevents iOS zoom */}
          {score !== null && (
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Any thoughts? (optional)"
              rows={2}
              maxLength={1000}
              className="w-full text-[16px] sm:text-xs rounded-xl border border-border bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          )}

          <button
            type="button"
            disabled={score === null || submitting}
            onClick={submit}
            className="w-full db-btn-page-primary text-sm py-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Star className="h-3.5 w-3.5" />
            {submitting ? "Sending…" : "Send Feedback"}
          </button>
        </div>
      )}

      {done && (
        <div className="px-4 pb-4">
          <p className="text-xs text-muted-foreground">
            Your feedback helps us make Jobnest better for everyone.
          </p>
        </div>
      )}
    </div>
  );
}
