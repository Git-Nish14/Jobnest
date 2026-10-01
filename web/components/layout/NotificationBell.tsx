"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Bell, Clock, Calendar, Inbox, X, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface NotifCount {
  overdueReminders:    number;
  upcomingInterviews:  number;
  unreadNotifications: number;
  total:               number;
}

// Fallback poll interval — catches any missed Realtime events
const FALLBACK_POLL_MS = 5 * 60_000;

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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCounts();

    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled || !user) return;

      channel = supabase
        .channel(`notif-bell-${user.id}`)
        // notifications INSERT — optimistically increment badge from payload (zero round-trip)
        // then reconcile with server to stay accurate
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
          (payload) => {
            const row = payload.new as { is_read?: boolean };
            if (!row.is_read) {
              setCounts((prev) =>
                prev
                  ? { ...prev, unreadNotifications: prev.unreadNotifications + 1, total: prev.total + 1 }
                  : prev,
              );
            }
            fetchCounts();
          },
        )
        // UPDATE/DELETE on notifications — server reconcile (need REPLICA IDENTITY FULL for reliable old-row diff)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
          fetchCounts,
        )
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
          fetchCounts,
        )
        // reminders/interviews — time-based counts require server logic
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "reminders", filter: `user_id=eq.${user.id}` },
          fetchCounts,
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "interviews", filter: `user_id=eq.${user.id}` },
          fetchCounts,
        )
        .subscribe();
    });

    const fallback = setInterval(fetchCounts, FALLBACK_POLL_MS);

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
      clearInterval(fallback);
    };
  }, [fetchCounts]);

  // Close popover on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const total = counts?.total ?? 0;

  const items = [
    {
      show:     (counts?.overdueReminders ?? 0) > 0,
      href:     "/reminders",
      iconEl:   <Clock className="h-4 w-4 text-destructive" />,
      iconBg:   "bg-destructive/10",
      label:    `${counts?.overdueReminders ?? 0} overdue reminder${(counts?.overdueReminders ?? 0) !== 1 ? "s" : ""}`,
      sublabel: "Review and complete",
      labelCls: "text-destructive",
    },
    {
      show:     (counts?.upcomingInterviews ?? 0) > 0,
      href:     "/interviews",
      iconEl:   <Calendar className="h-4 w-4 text-primary" />,
      iconBg:   "bg-primary/10",
      label:    `${counts?.upcomingInterviews ?? 0} interview${(counts?.upcomingInterviews ?? 0) !== 1 ? "s" : ""} in 24 h`,
      sublabel: "See your schedule",
      labelCls: "",
    },
    {
      show:     (counts?.unreadNotifications ?? 0) > 0,
      href:     "/notifications",
      iconEl:   <Inbox className="h-4 w-4 text-muted-foreground" />,
      iconBg:   "bg-muted",
      label:    `${counts?.unreadNotifications ?? 0} unread notification${(counts?.unreadNotifications ?? 0) !== 1 ? "s" : ""}`,
      sublabel: "View all messages",
      labelCls: "",
    },
  ] as const;

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
              {items.filter((item) => item.show).map((item) => (
                // Entire row is the link — large tap target. "View" span is a visual affordance only
                // (not a nested interactive element) to satisfy HTML validity.
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors group"
                >
                  <div className={`h-8 w-8 rounded-full ${item.iconBg} flex items-center justify-center shrink-0`}>
                    {item.iconEl}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium ${item.labelCls}`}>{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.sublabel}</p>
                  </div>
                  <span className="shrink-0 flex items-center gap-0.5 rounded-md px-2 py-1 text-xs font-medium text-primary bg-primary/8 group-hover:bg-primary/15 transition-colors">
                    View
                    <ChevronRight className="h-3 w-3" />
                  </span>
                </Link>
              ))}
            </div>
          )}

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
