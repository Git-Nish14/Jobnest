"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Download, Loader2, Pencil, Check } from "lucide-react";
import { toast } from "sonner";
import type { WeeklyTrend } from "@/types";

interface Props {
  weeklyTrends: WeeklyTrend[];
  thisWeek: number;
}

const GOAL_KEY = "jobnest_weekly_goal";
const DEFAULT_GOAL = 5;

function clampGoal(v: number) {
  return Math.max(1, Math.min(100, Math.round(v)));
}

export function WeeklyCadence({ weeklyTrends, thisWeek }: Props) {
  const [goal, setGoal] = useState(DEFAULT_GOAL);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [exporting, setExporting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load goal from localStorage once on mount
  useEffect(() => {
    const stored = localStorage.getItem(GOAL_KEY);
    if (stored) {
      const n = parseInt(stored, 10);
      if (!isNaN(n)) setGoal(clampGoal(n));
    }
  }, []);

  const saveGoal = useCallback(() => {
    const n = parseInt(draft, 10);
    if (!isNaN(n) && n > 0) {
      const clamped = clampGoal(n);
      setGoal(clamped);
      localStorage.setItem(GOAL_KEY, String(clamped));
    }
    setEditing(false);
  }, [draft]);

  useEffect(() => {
    if (editing) {
      setDraft(String(goal));
      setTimeout(() => inputRef.current?.select(), 0);
    }
  }, [editing, goal]);

  // Last 12 weeks for the mini chart
  const chartWeeks = weeklyTrends.slice(-12);
  const maxCount = Math.max(...chartWeeks.map((w) => w.count), 1);

  const pct = Math.min(Math.round((thisWeek / goal) * 100), 100);
  const overGoal = thisWeek >= goal;

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const res = await fetch(`/api/export/weekly-report?goal=${goal}`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `weekly-report-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Weekly report downloaded");
    } catch {
      toast.error("Failed to export report");
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="db-content-card">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="db-headline text-lg font-semibold text-foreground">Weekly Cadence</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Track your application pace and export a PDF report
          </p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#dbc1b9]/40 dark:border-white/10 bg-[#f4f3f1] dark:bg-white/6 text-[#55433d] dark:text-white/70 hover:bg-[#e9e8e6] dark:hover:bg-white/10 transition-colors disabled:opacity-50"
        >
          {exporting
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Download className="h-3.5 w-3.5" />}
          Weekly report
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Left: goal progress */}
        <div className="flex flex-col gap-4">
          {/* This week vs goal */}
          <div className="rounded-xl border border-border bg-[#f4f3f1]/60 dark:bg-[#0f0f0f] px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              This week
            </p>

            {/* Progress bar */}
            <div className="flex items-end gap-3 mb-3">
              <span className={`text-4xl font-bold tabular-nums leading-none ${
                overGoal ? "text-emerald-600 dark:text-emerald-400" : "text-[#99462a] dark:text-[#ccff00]"
              }`}>
                {thisWeek}
              </span>
              <span className="text-sm text-muted-foreground mb-1">
                / {editing ? (
                  <span className="inline-flex items-center gap-1">
                    <input
                      ref={inputRef}
                      type="number"
                      min={1}
                      max={100}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveGoal();
                        if (e.key === "Escape") setEditing(false);
                      }}
                      onBlur={saveGoal}
                      className="w-12 text-sm text-foreground border-b border-[#99462a] bg-transparent outline-none tabular-nums"
                      aria-label="Weekly goal"
                    />
                    <button type="button" onClick={saveGoal} className="text-[#99462a] dark:text-[#ccff00]">
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors group"
                    title="Edit weekly goal"
                  >
                    {goal} goal
                    <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                  </button>
                )}
              </span>
            </div>

            <div className="h-2 rounded-full bg-[#dbc1b9]/30 dark:bg-white/8 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  overGoal
                    ? "bg-emerald-500 dark:bg-emerald-400"
                    : "bg-[#99462a] dark:bg-[#ccff00]"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>

            <p className="text-[11px] text-muted-foreground mt-2">
              {overGoal
                ? `Goal hit! ${thisWeek - goal > 0 ? `${thisWeek - goal} above target` : "Right on target"}`
                : `${goal - thisWeek} more to reach your goal`}
            </p>
          </div>
        </div>

        {/* Right: 12-week velocity mini chart */}
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            12-week velocity
          </p>
          <div className="flex-1 flex items-end gap-1 h-24" aria-label="12-week application velocity chart">
            {chartWeeks.map((w, i) => {
              const barPct = maxCount > 0 ? Math.max((w.count / maxCount) * 100, w.count > 0 ? 6 : 0) : 0;
              const isLatest = i === chartWeeks.length - 1;
              return (
                <div
                  key={w.week}
                  className="flex-1 flex flex-col items-center justify-end h-full group relative"
                  title={`${w.week}: ${w.count} apps`}
                >
                  <div
                    className={`w-full rounded-sm transition-all duration-300 ${
                      isLatest
                        ? "bg-[#99462a] dark:bg-[#ccff00]"
                        : "bg-[#dbc1b9]/60 dark:bg-white/15 group-hover:bg-[#99462a]/40 dark:group-hover:bg-[#ccff00]/30"
                    }`}
                    style={{ height: `${barPct}%` }}
                  />
                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                    <div className="bg-foreground text-background text-[9px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap">
                      {w.count}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {/* X-axis: first + last label */}
          <div className="flex justify-between text-[9px] text-muted-foreground/50">
            <span>{chartWeeks[0]?.week}</span>
            <span className="text-[#99462a] dark:text-[#ccff00] font-semibold">
              {chartWeeks[chartWeeks.length - 1]?.week} (now)
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
