"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { X, Star } from "lucide-react";
import { cn } from "@/lib/utils";

const DISMISSED_KEY = "jobnest_nps_dismissed";
const NPS_DAYS = 7;

export function NPSFeedback() {
  const [show, setShow]       = useState(false);
  const [score, setScore]     = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]       = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Check localStorage dismissal first (no network needed)
    try {
      if (localStorage.getItem(DISMISSED_KEY)) return;
    } catch { /* private mode */ }

    let cancelled = false;
    const check = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;

        let firstSeen: string | undefined = user.user_metadata?.first_seen;

        // First visit — stamp the date so the 7-day countdown starts now
        if (!firstSeen) {
          firstSeen = new Date().toISOString();
          await supabase.auth.updateUser({ data: { first_seen: firstSeen } });
          return; // don't show immediately; let the countdown run
        }

        const daysSince = (Date.now() - new Date(firstSeen).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince < NPS_DAYS) return;

        // Don't re-show if user already submitted feedback (check user_metadata flag)
        if (user.user_metadata?.nps_submitted) return;

        if (!cancelled) setShow(true);
      } catch { /* non-fatal */ }
    };

    // Delay 3 s after mount so it doesn't interrupt first paint
    const t = setTimeout(check, 3000);
    return () => {
      cancelled = true;
      clearTimeout(t);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  function dismiss() {
    try { localStorage.setItem(DISMISSED_KEY, "1"); } catch { /* private mode */ }
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
        // Mark in user_metadata so we don't re-show
        const supabase = createClient();
        await supabase.auth.updateUser({ data: { nps_submitted: true } });
        setDone(true);
        closeTimerRef.current = setTimeout(() => setShow(false), 2000);
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

          {/* Optional comment */}
          {score !== null && (
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Any thoughts? (optional)"
              rows={2}
              maxLength={1000}
              className="w-full text-xs rounded-xl border border-border bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
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
