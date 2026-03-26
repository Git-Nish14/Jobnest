"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import type { Reminder } from "@/types";

type ReminderWithApp = Reminder & {
  job_applications?: { company: string; position: string } | null;
};

interface AtelierTasksPanelProps {
  reminders: ReminderWithApp[];
}

const QUOTES = [
  "Your future is created by what you do today.",
  "Every application is a step closer.",
  "Consistency is the foundation of success.",
];

function dueLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days < 0) return "Overdue";
  if (days === 0) return "Due today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

export function AtelierTasksPanel({ reminders }: AtelierTasksPanelProps) {
  const shown = reminders.slice(0, 3);
  // Use stable index on SSR (avoids server-UTC vs client-local hydration mismatch).
  // Update to the actual day's quote after mount.
  const [quote, setQuote] = useState(QUOTES[0]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuote(QUOTES[new Date().getDay() % QUOTES.length]);
  }, []);

  const handleComplete = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("reminders")
      .update({ is_completed: true, completed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error("Failed to complete reminder");
    } else {
      toast.success("Reminder completed");
      window.location.reload();
    }
  };

  return (
    <div className="db-panel h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h2 className="db-panel-title">Upcoming tasks</h2>
        {reminders.length > 3 && (
          <Link href="/reminders" className="db-link-primary text-xs">
            View all
          </Link>
        )}
      </div>

      {shown.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-[#55433d] text-sm text-center gap-2">
          <p>No pending reminders.</p>
          <Link href="/reminders" className="db-link-primary text-xs">Add one</Link>
        </div>
      ) : (
        <div className="space-y-5 flex-1">
          {shown.map((r) => (
            <div key={r.id} className="flex items-start gap-3">
              <button
                className="db-complete-btn"
                onClick={() => handleComplete(r.id)}
                title="Mark complete"
                type="button"
              />
              <div className={`${r.is_completed ? "opacity-40" : ""}`}>
                <p className={`text-sm font-semibold text-[#1a1c1b] ${r.is_completed ? "line-through" : ""}`}>
                  {r.title}
                </p>
                <p className="text-xs text-[#55433d] mt-0.5">
                  {r.is_completed ? "Completed" : dueLabel(r.remind_at)}
                  {r.job_applications && ` · ${r.job_applications.company}`}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-auto pt-6">
        <div className="db-quote-block">&ldquo;{quote}&rdquo;</div>
      </div>
    </div>
  );
}
