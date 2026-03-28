"use client";

import { useState } from "react";
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

interface ReminderListProps {
  reminders: (Reminder & { job_applications?: { company: string; position: string } | null })[];
  showCompleted?: boolean;
}

export function ReminderList({ reminders, showCompleted }: ReminderListProps) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

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

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  };

  const formatTime = (dateString: string) =>
    new Date(dateString).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  const handleComplete = async (id: string) => {
    setLoadingId(id);
    const supabase = createClient();
    const { error } = await supabase
      .from("reminders")
      .update({ is_completed: true, completed_at: new Date().toISOString() })
      .eq("id", id);

    if (error) toast.error("Failed to complete reminder");
    else { toast.success("Reminder completed"); router.refresh(); }
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
    else { toast.success("Reminder deleted"); router.refresh(); }
    setLoadingId(null);
  };

  // Atelier-toned type badges
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
        <div
          key={reminder.id}
          className={`flex items-start gap-3 p-4 rounded-xl transition-colors ${
            showCompleted
              ? "bg-[#f4f3f1]/60 opacity-60"
              : "bg-[#f4f3f1] hover:bg-[#e9e8e6]"
          }`}
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
      ))}
    </div>
  );
}
