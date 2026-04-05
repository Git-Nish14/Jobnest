"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Bell, Clock, Calendar, X } from "lucide-react";

interface NotifCount {
  overdueReminders: number;
  upcomingInterviews: number;
  total: number;
}

const POLL_INTERVAL_MS = 60_000; // refresh every 60 s

export function NotificationBell() {
  const [counts, setCounts] = useState<NotifCount | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const fetchCounts = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/count", { cache: "no-store" });
      if (res.ok) setCounts(await res.json());
    } catch {
      // Non-critical — fail silently; bell shows no badge
    }
  }, []);

  // Fetch on mount, then poll.
  // fetchCounts is async — setCounts runs only after await, not synchronously.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCounts();
    const timer = setInterval(fetchCounts, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [fetchCounts]);

  // Close popover on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const total = counts?.total ?? 0;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={
          total > 0
            ? `${total} notification${total !== 1 ? "s" : ""} — click to view`
            : "Notifications — no new alerts"
        }
        onClick={() => setOpen((o) => !o)}
        className="relative h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
      >
        <Bell className="h-4.5 w-4.5" />
        {total > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-0.5 text-[9px] font-bold leading-none text-white"
          >
            {total > 99 ? "99+" : total}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border bg-popover shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b">
            <span className="text-sm font-semibold">Notifications</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close notifications"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {total === 0 ? (
            <div className="px-4 py-6 text-center">
              <Bell className="h-7 w-7 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">You&apos;re all caught up!</p>
            </div>
          ) : (
            <div className="divide-y">
              {(counts?.overdueReminders ?? 0) > 0 && (
                <Link
                  href="/reminders"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                    <Clock className="h-4 w-4 text-destructive" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-destructive">
                      {counts!.overdueReminders} overdue reminder{counts!.overdueReminders !== 1 ? "s" : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">Tap to review and complete</p>
                  </div>
                </Link>
              )}

              {(counts?.upcomingInterviews ?? 0) > 0 && (
                <Link
                  href="/interviews"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Calendar className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {counts!.upcomingInterviews} interview{counts!.upcomingInterviews !== 1 ? "s" : ""} in 24 h
                    </p>
                    <p className="text-xs text-muted-foreground">Tap to see your schedule</p>
                  </div>
                </Link>
              )}
            </div>
          )}

          {/* View all link — always shown */}
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center py-2.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors border-t"
          >
            View all notifications →
          </Link>
        </div>
      )}
    </div>
  );
}
