"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bell, Clock, Calendar, Info, CreditCard, User,
  CheckCheck, Trash2, Loader2, ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchWithRetry } from "@/lib/utils/fetch-retry";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────────
type NotifType =
  | "overdue_reminder"
  | "upcoming_interview"
  | "system"
  | "account"
  | "billing";

interface Notification {
  id: string;
  type: NotifType;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

type Filter = "all" | "unread" | "read";

// ── Icon map ──────────────────────────────────────────────────────────────────
function NotifIcon({ type, read }: { type: NotifType; read: boolean }) {
  const base = "h-8 w-8 rounded-full flex items-center justify-center shrink-0";
  const iconCls = "h-4 w-4";

  const map: Record<NotifType, { bg: string; text: string; icon: React.ReactNode }> = {
    overdue_reminder:   { bg: "bg-destructive/10", text: "text-destructive",   icon: <Clock className={iconCls} /> },
    upcoming_interview: { bg: "bg-primary/10",     text: "text-primary",       icon: <Calendar className={iconCls} /> },
    system:             { bg: "bg-muted",           text: "text-muted-foreground", icon: <Info className={iconCls} /> },
    account:            { bg: "bg-violet-100 dark:bg-violet-900/30", text: "text-violet-600", icon: <User className={iconCls} /> },
    billing:            { bg: "bg-amber-100 dark:bg-amber-900/30",   text: "text-amber-600",  icon: <CreditCard className={iconCls} /> },
  };

  const { bg, text, icon } = map[type] ?? map.system;

  return (
    <div className={cn(base, bg, text, read && "opacity-50")}>
      {icon}
    </div>
  );
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)   return "Just now";
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)   return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function NotificationsPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [filter, setFilter] = useState<Filter>("all");
  const [items, setItems] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkPending, setBulkPending] = useState<"read-all" | "clear" | null>(null);

  // ── Fetch notifications ────────────────────────────────────────────────────
  const fetchNotifications = useCallback(async (f: Filter, cursor?: string) => {
    const params = new URLSearchParams({ filter: f });
    if (cursor) params.set("cursor", cursor);

    const res = await fetchWithRetry(`/api/notifications?${params}`);
    if (!res.ok) throw new Error("Failed to load notifications");
    return res.json() as Promise<{
      notifications: Notification[];
      hasMore: boolean;
      nextCursor: string | null;
      unreadCount: number;
    }>;
  }, []);

  // Initial load + when filter changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setItems([]);
    setNextCursor(null);
    setHasMore(false);

    fetchNotifications(filter)
      .then((data) => {
        if (cancelled) return;
        setItems(data.notifications);
        setHasMore(data.hasMore);
        setNextCursor(data.nextCursor);
        setUnreadCount(data.unreadCount);
      })
      .catch(() => toast.error("Couldn't load notifications"))
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [filter, fetchNotifications]);

  // Load more
  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await fetchNotifications(filter, nextCursor);
      setItems((prev) => [...prev, ...data.notifications]);
      setHasMore(data.hasMore);
      setNextCursor(data.nextCursor);
    } catch {
      toast.error("Couldn't load more notifications");
    } finally {
      setLoadingMore(false);
    }
  };

  // ── Mark single read/unread (optimistic) ──────────────────────────────────
  const toggleRead = async (id: string, currentlyRead: boolean) => {
    const newRead = !currentlyRead;

    // Optimistic update
    setItems((prev) =>
      prev.map((n) => n.id === id ? { ...n, is_read: newRead } : n)
    );
    setUnreadCount((c) => newRead ? Math.max(0, c - 1) : c + 1);

    const res = await fetchWithRetry(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_read: newRead }),
    });

    if (!res.ok) {
      // Revert
      setItems((prev) =>
        prev.map((n) => n.id === id ? { ...n, is_read: currentlyRead } : n)
      );
      setUnreadCount((c) => newRead ? c + 1 : Math.max(0, c - 1));
      toast.error("Couldn't update notification");
    }
  };

  // ── Click card body — navigate + mark read ─────────────────────────────────
  const handleCardClick = async (n: Notification) => {
    if (!n.is_read) await toggleRead(n.id, false);
    if (n.link) {
      startTransition(() => router.push(n.link!));
    }
  };

  // ── Delete single (optimistic) ────────────────────────────────────────────
  const deleteOne = async (id: string, wasUnread: boolean) => {
    setDeletingId(id);
    setItems((prev) => prev.filter((n) => n.id !== id));
    if (wasUnread) setUnreadCount((c) => Math.max(0, c - 1));

    const res = await fetchWithRetry(`/api/notifications/${id}`, { method: "DELETE" });
    setDeletingId(null);

    if (!res.ok) {
      toast.error("Couldn't delete notification");
      // Re-fetch to restore state
      fetchNotifications(filter).then((d) => {
        setItems(d.notifications);
        setUnreadCount(d.unreadCount);
      });
    }
  };

  // ── Mark all read ─────────────────────────────────────────────────────────
  const markAllRead = async () => {
    setBulkPending("read-all");
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);

    const res = await fetchWithRetry("/api/notifications/read-all", { method: "POST" });
    setBulkPending(null);

    if (!res.ok) {
      toast.error("Couldn't mark all as read");
      fetchNotifications(filter).then((d) => {
        setItems(d.notifications);
        setUnreadCount(d.unreadCount);
      });
    } else {
      toast.success("All notifications marked as read");
    }
  };

  // ── Clear all ─────────────────────────────────────────────────────────────
  const clearAll = async () => {
    if (!confirm("Delete all notifications? This cannot be undone.")) return;
    setBulkPending("clear");
    const prevItems = items;
    const prevCount = unreadCount;
    setItems([]);
    setUnreadCount(0);
    setHasMore(false);
    setNextCursor(null);

    const res = await fetchWithRetry("/api/notifications", { method: "DELETE" });
    setBulkPending(null);

    if (!res.ok) {
      toast.error("Couldn't clear notifications");
      setItems(prevItems);
      setUnreadCount(prevCount);
    } else {
      toast.success("All notifications cleared");
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const TABS: { id: Filter; label: string }[] = [
    { id: "all",    label: "All" },
    { id: "unread", label: `Unread${unreadCount > 0 ? ` (${unreadCount})` : ""}` },
    { id: "read",   label: "Read" },
  ];

  const empty =
    !loading &&
    items.length === 0 &&
    !hasMore;

  return (
    <div className="max-w-2xl">

      {/* ── Page header ── */}
      <header className="db-page-header mb-6">
        <div>
          <h1 className="db-page-title flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" />
            Notifications
          </h1>
          <p className="db-page-subtitle">
            Stay on top of overdue reminders and upcoming interviews.
          </p>
        </div>

        {/* Bulk actions */}
        <div className="flex items-center gap-2 shrink-0">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              disabled={bulkPending !== null}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
            >
              {bulkPending === "read-all"
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <CheckCheck className="h-3.5 w-3.5" />}
              Mark all read
            </button>
          )}
          {items.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              disabled={bulkPending !== null}
              className="flex items-center gap-1.5 text-sm text-destructive/70 hover:text-destructive transition-colors disabled:opacity-40"
            >
              {bulkPending === "clear"
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Trash2 className="h-3.5 w-3.5" />}
              Clear all
            </button>
          )}
        </div>
      </header>

      {/* ── Filter tabs ── */}
      <div className="flex gap-1 border-b mb-4">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id)}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors -mb-px border-b-2",
              filter === tab.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── List ── */}
      <div className="space-y-1">

        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {empty && (
          <div className="flex flex-col items-center py-16 text-center">
            <Bell className="h-10 w-10 text-muted-foreground/25 mb-3" />
            <p className="font-medium text-muted-foreground">
              {filter === "unread" ? "No unread notifications" :
               filter === "read"   ? "No read notifications" :
               "You're all caught up!"}
            </p>
            <p className="text-sm text-muted-foreground/60 mt-1">
              Overdue reminders and upcoming interviews will appear here.
            </p>
          </div>
        )}

        {items.map((n) => (
          <div
            key={n.id}
            className={cn(
              "group flex items-start gap-3 rounded-xl px-4 py-3.5 transition-colors",
              n.is_read
                ? "hover:bg-muted/40"
                : "bg-primary/4 hover:bg-primary/6 dark:bg-primary/8",
              (isPending && n.link) && "opacity-60 pointer-events-none"
            )}
          >
            {/* Icon */}
            <div className="mt-0.5">
              <NotifIcon type={n.type} read={n.is_read} />
            </div>

            {/* Content — clicking navigates + marks read */}
            <button
              type="button"
              className="flex-1 text-left min-w-0"
              onClick={() => handleCardClick(n)}
            >
              <p className={cn(
                "text-sm font-medium leading-tight",
                n.is_read ? "text-muted-foreground" : "text-foreground"
              )}>
                {n.title}
                {!n.is_read && (
                  <span className="inline-block ml-2 h-1.5 w-1.5 rounded-full bg-primary align-middle" />
                )}
              </p>
              {n.body && (
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed truncate">
                  {n.body}
                </p>
              )}
              <p className="text-[11px] text-muted-foreground/50 mt-1">
                {relativeTime(n.created_at)}
              </p>
            </button>

            {/* Actions — visible on hover */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              {/* Toggle read/unread */}
              <button
                type="button"
                title={n.is_read ? "Mark unread" : "Mark read"}
                onClick={() => toggleRead(n.id, n.is_read)}
                className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <CheckCheck className={cn("h-3.5 w-3.5", !n.is_read && "text-primary")} />
              </button>

              {/* Delete */}
              <button
                type="button"
                title="Delete notification"
                onClick={() => deleteOne(n.id, !n.is_read)}
                disabled={deletingId === n.id}
                className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-colors disabled:opacity-40"
              >
                {deletingId === n.id
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Trash2 className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        ))}

        {/* Load more */}
        {hasMore && (
          <div className="flex justify-center pt-4">
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              {loadingMore
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <ChevronDown className="h-4 w-4" />}
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          </div>
        )}
      </div>

      {/* ── Tip ── */}
      {!loading && !empty && (
        <p className="text-xs text-muted-foreground/40 text-center mt-8">
          Notifications are generated daily by the overdue-reminders check.{" "}
          <Link href="/profile" className="hover:text-muted-foreground transition-colors">
            Manage email preferences →
          </Link>
        </p>
      )}
    </div>
  );
}
