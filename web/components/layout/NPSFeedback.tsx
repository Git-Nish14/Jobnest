"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { X, Star, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const FIRST_SHOW_DAYS  = 7;
const INTERVAL_DAYS    = 15;
const DISMISSED_AT_KEY = "jobnest_nps_dismissed_at";
const DAY_MS = 1000 * 60 * 60 * 24;

function daysSince(isoOrTimestamp: string | number): number {
  const ts = typeof isoOrTimestamp === "number"
    ? isoOrTimestamp
    : new Date(isoOrTimestamp).getTime();
  return (Date.now() - ts) / DAY_MS;
}

export function NPSFeedback() {
  const [show, setShow]             = useState(false);
  const [score, setScore]           = useState<number | null>(null);
  const [comment, setComment]       = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]             = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const dismissedAt = localStorage.getItem(DISMISSED_AT_KEY);
      if (dismissedAt && daysSince(parseInt(dismissedAt, 10)) < INTERVAL_DAYS) return;
      if (dismissedAt) localStorage.removeItem(DISMISSED_AT_KEY);
    } catch { /* private mode */ }

    let cancelled = false;
    const check = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;

        let firstSeen: string | undefined = user.user_metadata?.first_seen;
        if (!firstSeen) {
          firstSeen = new Date().toISOString();
          await supabase.auth.updateUser({ data: { first_seen: firstSeen } });
          return;
        }
        if (daysSince(firstSeen) < FIRST_SHOW_DAYS) return;

        const lastSubmittedAt: string | undefined = user.user_metadata?.nps_last_submitted_at;
        if (lastSubmittedAt && daysSince(lastSubmittedAt) < INTERVAL_DAYS) return;

        if (!cancelled) setShow(true);
      } catch { /* non-fatal */ }
    };

    const t = setTimeout(check, 3000);
    return () => {
      cancelled = true;
      clearTimeout(t);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  function dismiss() {
    try { localStorage.setItem(DISMISSED_AT_KEY, Date.now().toString()); } catch { /* ok */ }
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
        const supabase = createClient();
        await supabase.auth.updateUser({ data: { nps_last_submitted_at: new Date().toISOString() } });
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
    /*
     * Layout: full-width card on mobile (above the tab bar), right-aligned
     * card on desktop. Uses the same atelier-bottom-card background as the
     * cookie banner — consistent with the site's navigation chrome.
     *
     * Score buttons use overflow-x-auto so all 11 fit on any screen width.
     */
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Quick feedback"
      className={cn(
        "fixed z-50 atelier-bottom-card rounded-2xl overflow-hidden",
        "animate-in slide-in-from-bottom-4 duration-300",
        /* Mobile: full-width above the tab bar */
        "inset-x-4 bottom-[calc(env(safe-area-inset-bottom,0px)+5.75rem)]",
        /* Desktop: right-aligned card */
        "md:inset-x-auto md:right-6 md:bottom-6 md:w-96"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between px-4 pt-4 pb-2">
        <div>
          <p className="font-semibold text-sm text-[#1a1c1b] dark:text-white">
            {done ? "Thank you! 🎉" : "How's Jobnest working for you?"}
          </p>
          {!done && (
            <p className="text-xs text-[#88726c] dark:text-white/45 mt-0.5">
              Rate from 0 (not at all) to 10 (love it)
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss feedback"
          className="min-h-11 min-w-11 flex items-center justify-center rounded-lg text-[#88726c] dark:text-white/40 hover:text-[#1a1c1b] dark:hover:text-white hover:bg-[#99462a]/8 dark:hover:bg-white/8 transition-colors -mr-2 -mt-1"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {!done && (
        <div className="px-4 pb-4 space-y-3">

          {/* Score row — horizontally scrollable so all 11 fit on any screen */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
            {Array.from({ length: 11 }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setScore(i)}
                aria-label={`Score ${i}`}
                aria-pressed={score === i ? true : false}
                className={cn(
                  "shrink-0 h-9 w-9 rounded-xl text-xs font-semibold transition-all",
                  score === i
                    ? "bg-[#99462a] dark:bg-[#ccff00] text-white dark:text-black scale-110 shadow-sm"
                    : "bg-[#f4f3f1] dark:bg-white/8 text-[#55433d] dark:text-white/60 hover:bg-[#99462a]/15 hover:text-[#99462a] dark:hover:text-[#ccff00]"
                )}
              >
                {i}
              </button>
            ))}
          </div>

          {/* Optional comment */}
          {score !== null && (
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Any thoughts? (optional)"
              rows={2}
              maxLength={1000}
              className="w-full text-[16px] sm:text-sm rounded-xl border border-[#dbc1b9]/50 dark:border-white/10 bg-[#f4f3f1]/60 dark:bg-white/5 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#99462a] dark:focus:ring-[#ccff00] resize-none text-[#1a1c1b] dark:text-white placeholder:text-[#88726c] dark:placeholder:text-white/30"
            />
          )}

          <button
            type="button"
            disabled={score === null || submitting}
            onClick={submit}
            className="w-full flex items-center justify-center gap-2 rounded-full bg-[#99462a] dark:bg-[#ccff00] px-4 py-2.5 text-sm font-semibold text-white dark:text-black hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending…</>
              : <><Star className="h-3.5 w-3.5" /> Send Feedback</>
            }
          </button>
        </div>
      )}

      {done && (
        <div className="px-4 pb-4">
          <p className="text-xs text-[#88726c] dark:text-white/45">
            Your feedback helps us make Jobnest better for everyone.
          </p>
        </div>
      )}
    </div>
  );
}
