"use client";

import { useState, useTransition } from "react";
import { Target, TrendingUp, Users } from "lucide-react";
import { toast } from "sonner";
import type { Contact } from "@/types";

interface ConnectionGoalWidgetProps {
  initialGoal: number;
  thisWeekCount: number;
  suggestedContacts: Contact[];
}

export function ConnectionGoalWidget({
  initialGoal,
  thisWeekCount,
  suggestedContacts,
}: ConnectionGoalWidgetProps) {
  const [goal, setGoal]     = useState(initialGoal);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]   = useState(String(initialGoal));
  const [, startTransition] = useTransition();

  const pct        = Math.min(100, Math.round((thisWeekCount / Math.max(goal, 1)) * 100));
  const onTrack    = thisWeekCount >= goal;
  const barColor   = onTrack ? "bg-emerald-500" : pct >= 60 ? "bg-amber-500" : "bg-[#99462a]";

  function saveGoal() {
    const n = parseInt(draft, 10);
    if (!Number.isInteger(n) || n < 1 || n > 50) {
      toast.error("Goal must be between 1 and 50.");
      setDraft(String(goal));
      setEditing(false);
      return;
    }
    setGoal(n);
    setEditing(false);
    startTransition(async () => {
      try {
        const res = await fetch("/api/profile/update-connection-goal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ weeklyConnectionGoal: n }),
        });
        if (!res.ok) toast.error("Failed to save goal.");
      } catch {
        toast.error("Failed to save goal.");
      }
    });
  }

  return (
    <div className="db-content-card space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-[#99462a]" />
          <span className="font-semibold text-sm text-[#55433d] dark:text-[#c9a99a]">
            Weekly Connection Goal
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[#7a5c52] dark:text-[#b08070]">
            {thisWeekCount} /
          </span>
          {editing ? (
            <input
              type="number"
              min={1}
              max={50}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={saveGoal}
              onKeyDown={(e) => { if (e.key === "Enter") saveGoal(); if (e.key === "Escape") { setDraft(String(goal)); setEditing(false); } }}
              className="w-14 rounded border border-[#dbc1b9]/60 bg-[#f4f3f1] px-2 py-0.5 text-center text-[16px] sm:text-sm font-semibold text-[#55433d] dark:bg-[#1a1108] dark:border-[#4a3020] dark:text-[#c9a99a] focus:outline-none focus:ring-2 focus:ring-[#99462a]/30"
              autoFocus
            />
          ) : (
            <button
              onClick={() => { setDraft(String(goal)); setEditing(true); }}
              className="font-semibold text-[#55433d] dark:text-[#c9a99a] underline decoration-dotted cursor-pointer hover:text-[#99462a]"
              title="Click to edit goal"
            >
              {goal}
            </button>
          )}
          <span className="text-[#7a5c52] dark:text-[#b08070]">this week</span>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="h-2 rounded-full bg-[#e8ddd8] dark:bg-[#2a1a10] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-[#7a5c52] dark:text-[#b08070]">
          {onTrack
            ? "🎉 Goal reached this week!"
            : `${goal - thisWeekCount} more contact${goal - thisWeekCount === 1 ? "" : "s"} to hit your goal`}
        </p>
      </div>

      {/* Suggested contacts */}
      {suggestedContacts.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp className="h-3.5 w-3.5 text-[#99462a]" />
            <span className="text-xs font-semibold text-[#55433d] dark:text-[#c9a99a] uppercase tracking-wider">
              Suggested to contact
            </span>
          </div>
          <ul className="space-y-1.5">
            {suggestedContacts.slice(0, 4).map((c) => (
              <li key={c.id} className="flex items-center gap-2 text-sm">
                <div className="h-6 w-6 rounded-full bg-[#99462a]/10 dark:bg-[#99462a]/20 flex items-center justify-center flex-shrink-0">
                  <Users className="h-3.5 w-3.5 text-[#99462a]" />
                </div>
                <span className="font-medium text-[#3d2b23] dark:text-[#e8d5cc] min-w-0 truncate">{c.name}</span>
                {c.company && (
                  <span className="text-[#7a5c52] dark:text-[#b08070] truncate">· {c.company}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
