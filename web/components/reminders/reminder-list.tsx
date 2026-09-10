"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { Clock, CheckCircle2, Trash2, MoreVertical } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui";
import type { Reminder } from "@/types";
import { formatDate as fmtDate_, formatTime as formatTime_ } from "@/lib/utils/date";

interface ReminderListProps {
  reminders: (Reminder & { job_applications?: { company: string; position: string } | null })[];
  showCompleted?: boolean;
  onMutate?: () => void;
}

const SWIPE_THRESHOLD = 72; // px right-swipe to trigger completion
const SWIPE_MAX = 120;      // cap visual translation

export function ReminderList({ reminders, showCompleted, onMutate }: ReminderListProps) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  // ── Swipe gesture — refs only, zero state updates during gesture ──────────
  // Storing swipe position in state would re-render every card on every
  // touchmove (up to 120 fps on ProMotion), causing guaranteed jank on mobile.
  // Direct DOM style mutation is the correct pattern for touch animations.
  const touchStartX   = useRef<number>(0);
  const touchStartY   = useRef<number>(0);
  const swipeDir      = useRef<"h" | "v" | null>(null);
  const swipingId     = useRef<string | null>(null);
  const swipeDelta    = useRef<number>(0);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (diff < 0) {
      const absDays = Math.abs(days);
      if (absDays === 0) return "Today (overdue)";
      if (absDays === 1) return "Yesterday";
      return `${absDays} days ago`;
    }
    if (days === 0) return "Today";
    if (days === 1) return "Tomorrow";
    if (days < 7) return `In ${days} days`;
    return fmtDate_(dateString);
  };

  const formatTime = (dateString: string) => formatTime_(dateString);

  const handleComplete = async (id: string) => {
    setLoadingId(id);
    const supabase = createClient();
    const { error } = await supabase
      .from("reminders")
      .update({ is_completed: true, completed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error("Failed to complete reminder");
    else { toast.success("Reminder completed"); if (onMutate) { onMutate(); } else { router.refresh(); } }
    setLoadingId(null);
  };

  const handleDeleteClick = (id: string) => {
    setConfirmingId(id);
    setTimeout(() => setConfirmingId((cur) => (cur === id ? null : cur)), 4000);
  };

  const handleDeleteConfirm = async (id: string) => {
    setConfirmingId(null);
    setLoadingId(id);
    const supabase = createClient();
    const { error } = await supabase.from("reminders").delete().eq("id", id);
    if (error) toast.error("Failed to delete reminder");
    else { toast.success("Reminder deleted"); if (onMutate) { onMutate(); } else { router.refresh(); } }
    setLoadingId(null);
  };

  // ── Swipe handlers — no setState, all DOM mutations ───────────────────────
  const getSwipeEls = (id: string) => ({
    card:     document.querySelector<HTMLElement>(`[data-swipe-card="${id}"]`),
    backdrop: document.querySelector<HTMLElement>(`[data-swipe-backdrop="${id}"]`),
    label:    document.querySelector<HTMLElement>(`[data-swipe-label="${id}"]`),
  });

  const resetSwipe = (id: string) => {
    const { card, backdrop, label } = getSwipeEls(id);
    if (card)     { card.style.transition = "transform 0.25s ease"; card.style.transform = ""; }
    if (backdrop) backdrop.style.opacity = "0";
    if (label)    label.style.display = "none";
  };

  const handleTouchStart = (id: string, e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    swipeDir.current    = null;
    swipingId.current   = id;
    swipeDelta.current  = 0;
    // Remove CSS transition so the card tracks the finger without lag
    const card = document.querySelector<HTMLElement>(`[data-swipe-card="${id}"]`);
    if (card) card.style.transition = "none";
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const id = swipingId.current;
    if (!id) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;

    // Direction lock: first 10 px determines H vs V, then we stop re-evaluating
    if (!swipeDir.current) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      swipeDir.current = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
    }
    if (swipeDir.current !== "h" || dx <= 0) return;

    const delta = Math.min(dx, SWIPE_MAX);
    swipeDelta.current = delta;

    const { card, backdrop, label } = getSwipeEls(id);
    if (card)     card.style.transform = `translateX(${delta}px)`;
    if (backdrop) backdrop.style.opacity = String(Math.min(delta / SWIPE_THRESHOLD, 1));
    if (label)    label.style.display = delta >= SWIPE_THRESHOLD ? "" : "none";
  };

  const handleTouchEnd = async () => {
    const id    = swipingId.current;
    if (!id) return;
    const delta         = swipeDelta.current;
    const wasHorizontal = swipeDir.current === "h";

    swipingId.current  = null;
    swipeDelta.current = 0;
    swipeDir.current   = null;

    resetSwipe(id);

    if (wasHorizontal && delta >= SWIPE_THRESHOLD) {
      await handleComplete(id);
    }
  };

  function typeBadge(type: string) {
    const map: Record<string, string> = {
      "Follow Up":  "bg-[#99462a]/10 text-[#99462a]",
      "Interview":  "bg-[#006d34]/10 text-[#006d34]",
      "Deadline":   "bg-[#ba1a1a]/10 text-[#ba1a1a]",
      "Offer":      "bg-[#006d34]/14 text-[#005225]",
    };
    return map[type] ?? "bg-[#55433d]/10 text-[#55433d]";
  }

  return (
    <div className="space-y-2">
      {reminders.map((reminder) => (
        <div key={reminder.id} className="relative overflow-hidden rounded-xl">
          {/* Green swipe-to-complete backdrop — starts invisible, animated via DOM refs */}
          {!showCompleted && (
            <div
              aria-hidden
              data-swipe-backdrop={reminder.id}
              className="absolute inset-0 flex items-center pl-5 gap-2 bg-[#006d34] rounded-xl"
              style={{ opacity: 0 }}
            >
              <CheckCircle2 className="h-5 w-5 text-white shrink-0" />
              <span
                data-swipe-label={reminder.id}
                className="text-white text-sm font-semibold"
                style={{ display: "none" }}
              >
                Complete
              </span>
            </div>
          )}

          {/* Card — translated via DOM ref, CSS transition re-added on release */}
          <div
            data-swipe-card={reminder.id}
            className={`flex items-start gap-3 p-4 rounded-xl transition-colors select-none ${
              showCompleted
                ? "bg-[#f4f3f1]/60 opacity-60"
                : "bg-[#f4f3f1] hover:bg-[#e9e8e6]"
            }`}
            style={{ transition: "transform 0.25s ease" }}
            onTouchStart={!showCompleted ? (e) => handleTouchStart(reminder.id, e) : undefined}
            onTouchMove={!showCompleted ? handleTouchMove : undefined}
            onTouchEnd={!showCompleted ? handleTouchEnd : undefined}
          >
            {!showCompleted && (
              <button
                type="button"
                className="db-complete-btn shrink-0 mt-0.5"
                onClick={() => handleComplete(reminder.id)}
                disabled={loadingId === reminder.id}
                aria-label={`Mark "${reminder.title}" as complete`}
                title="Mark as complete"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-[#dbc1b9]" />
              </button>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className={`font-semibold text-[#1a1c1b] text-sm ${showCompleted ? "line-through" : ""}`}>
                    {reminder.title}
                  </p>
                  {reminder.job_applications && (
                    <Link
                      href={`/applications/${reminder.application_id}`}
                      className="text-xs text-[#99462a] hover:underline underline-offset-2"
                    >
                      {reminder.job_applications.company} — {reminder.job_applications.position}
                    </Link>
                  )}
                  {reminder.description && (
                    <p className="text-sm text-[#55433d]/70 mt-1 leading-relaxed">
                      {reminder.description}
                    </p>
                  )}
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="Reminder options"
                      className="h-8 w-8 flex items-center justify-center rounded-lg text-[#55433d]/50 hover:text-[#99462a] hover:bg-[#99462a]/8 transition-colors shrink-0"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {confirmingId === reminder.id ? (
                      <DropdownMenuItem
                        onClick={() => handleDeleteConfirm(reminder.id)}
                        className="text-[#ba1a1a] font-semibold"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Confirm delete
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        onClick={() => handleDeleteClick(reminder.id)}
                        disabled={loadingId === reminder.id}
                        className="text-[#ba1a1a]"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {loadingId === reminder.id ? "Deleting..." : "Delete"}
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <span className={`db-status-badge text-[10px] ${typeBadge(reminder.type)}`}>
                  {reminder.type}
                </span>
                <span className="text-xs text-[#55433d]/60 flex items-center gap-1">
                  <Clock className="h-3 w-3 shrink-0" />
                  {formatDate(reminder.remind_at)} at {formatTime(reminder.remind_at)}
                </span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
