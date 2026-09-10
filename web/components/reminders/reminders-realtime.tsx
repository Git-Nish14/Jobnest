"use client";

/**
 * Client wrapper that subscribes the reminders page to Supabase Realtime.
 * INSERT/UPDATE/DELETE on the `reminders` table for the current user triggers
 * a lightweight state update instead of a full server router.refresh().
 *
 * The parent server component passes initial data; this component owns the
 * live copy and passes mutation handlers down to ReminderList.
 */

import { useState, useEffect, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ReminderList } from "./reminder-list";
import { Bell, Clock, CheckCircle2 } from "lucide-react";
import type { Reminder } from "@/types";

type ReminderWithApp = Reminder & {
  job_applications?: { company: string; position: string } | null;
};

interface Props {
  initialReminders:    ReminderWithApp[];
  initialDueReminders: ReminderWithApp[];
}

export function RemindersRealtimeProvider({ initialReminders, initialDueReminders }: Props) {
  // Lazy initializer — the merge is only computed once (on mount), not on every render.
  // getDueReminders includes the job_applications join; getReminders does not.
  // We overlay the join data so overdue items show their linked application name.
  const [reminders, setReminders] = useState<ReminderWithApp[]>(() =>
    initialReminders.map((r) => {
      const withJoin = initialDueReminders.find((d) => d.id === r.id);
      return withJoin ?? r;
    })
  );
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Full server re-fetch — called after mutations to stay in sync with RLS/joins
  const refresh = useCallback(() => {
    startTransition(() => { router.refresh(); });
  }, [router]);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled || !user) return;

      channel = supabase
        .channel(`reminders-page-${user.id}`)
        .on(
          "postgres_changes",
          {
            event:  "*",
            schema: "public",
            table:  "reminders",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            if (payload.eventType === "INSERT") {
              // Optimistically prepend; join data will arrive after router.refresh
              setReminders((prev) => {
                const newRow = payload.new as ReminderWithApp;
                const exists = prev.some((r) => r.id === newRow.id);
                return exists ? prev : [newRow, ...prev];
              });
              // Full refresh to get job_applications join & correct ordering
              refresh();
            } else if (payload.eventType === "UPDATE") {
              setReminders((prev) =>
                prev.map((r) =>
                  r.id === payload.new.id
                    ? { ...r, ...(payload.new as ReminderWithApp) }
                    : r
                )
              );
              refresh();
            } else if (payload.eventType === "DELETE") {
              setReminders((prev) => prev.filter((r) => r.id !== payload.old.id));
            }
          }
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [refresh]);

  // Derived state — mirrors the server component logic
  const pending  = reminders.filter((r) => !r.is_completed);
  const completed = reminders.filter((r) => r.is_completed);

  // Recompute overdue from live state
  const now = new Date().toISOString();
  const overdue = pending.filter((r) => r.remind_at < now);

  return (
    <div className="space-y-8">
      {/* Overdue */}
      {overdue.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-4">
            <Clock className="h-5 w-5 text-[#ba1a1a]" />
            <h2 className="db-headline text-xl font-semibold text-[#ba1a1a]">
              Overdue ({overdue.length})
            </h2>
          </div>
          <div className="db-content-card border border-[#ba1a1a]/15">
            <ReminderList reminders={overdue} onMutate={refresh} />
          </div>
        </section>
      )}

      {/* Pending */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <Bell className="h-5 w-5 text-[#99462a]" />
          <h2 className="db-headline text-xl font-semibold text-[#1a1c1b]">
            Upcoming Reminders
          </h2>
        </div>
        <div className="db-content-card">
          {pending.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <Bell className="h-10 w-10 text-[#55433d]/30 mb-3" />
              <p className="text-[#55433d] font-medium">No pending reminders</p>
              <p className="text-sm text-[#55433d]/60 mt-1">
                Create reminders to stay on top of follow-ups
              </p>
            </div>
          ) : (
            <ReminderList reminders={pending} onMutate={refresh} />
          )}
        </div>
      </section>

      {/* Completed */}
      {completed.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle2 className="h-5 w-5 text-[#55433d]/50" />
            <h2 className="db-headline text-xl font-semibold text-[#55433d]">
              Completed ({completed.length})
            </h2>
          </div>
          <div className="db-content-card">
            <ReminderList reminders={completed.slice(0, 10)} showCompleted onMutate={refresh} />
          </div>
        </section>
      )}
    </div>
  );
}
