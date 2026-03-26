"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Clock, Video, MapPin, User, MoreVertical, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui";
import { InterviewForm } from "./interview-form";
import type { Interview } from "@/types";

interface InterviewListProps {
  applicationId: string;
  interviews: Interview[];
}

export function InterviewList({ applicationId, interviews }: InterviewListProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const handleDeleteClick = (id: string) => {
    setConfirmingId(id);
    setTimeout(() => setConfirmingId((cur) => (cur === id ? null : cur)), 4000);
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "numeric", year: "numeric",
    });

  const formatTime = (dateString: string) =>
    new Date(dateString).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  // Atelier-toned status badges
  function statusBadge(status: string) {
    const map: Record<string, string> = {
      "Scheduled":   "bg-[#006d34]/10 text-[#006d34]",
      "Completed":   "bg-[#55433d]/10 text-[#55433d]",
      "Cancelled":   "bg-[#ba1a1a]/10 text-[#ba1a1a]",
      "Rescheduled": "bg-amber-500/10 text-amber-700",
    };
    return map[status] ?? "bg-[#55433d]/10 text-[#55433d]";
  }

  const handleDeleteConfirm = async (id: string) => {
    setConfirmingId(null);
    setDeletingId(id);
    const supabase = createClient();
    const { error } = await supabase.from("interviews").delete().eq("id", id);
    if (error) toast.error("Failed to delete interview");
    else { toast.success("Interview deleted"); router.refresh(); }
    setDeletingId(null);
  };

  const upcomingInterviews = interviews.filter(
    (i) => new Date(i.scheduled_at) >= new Date() && i.status === "Scheduled"
  );
  const pastInterviews = interviews.filter(
    (i) => new Date(i.scheduled_at) < new Date() || i.status !== "Scheduled"
  );

  return (
    <section className="db-content-card">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <h2 className="db-headline text-xl font-semibold text-[#1a1c1b] flex items-center gap-2">
          <Calendar className="h-5 w-5 text-[#99462a]" />
          Interviews
        </h2>
        <InterviewForm applicationId={applicationId} />
      </div>

      {interviews.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-center">
          <div className="h-12 w-12 rounded-xl bg-[#f4f3f1] flex items-center justify-center mb-3">
            <Plus className="h-5 w-5 text-[#55433d]/40" />
          </div>
          <p className="text-[#55433d] font-medium text-sm">No interviews scheduled yet</p>
          <p className="text-xs text-[#55433d]/60 mt-1">Schedule your first interview above</p>
        </div>
      ) : (
        <div className="space-y-6">
          {upcomingInterviews.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#55433d]/50 mb-3">Upcoming</p>
              <div className="space-y-3">
                {upcomingInterviews.map((interview) => (
                  <InterviewCard
                    key={interview.id}
                    interview={interview}
                    applicationId={applicationId}
                    formatDate={formatDate}
                    formatTime={formatTime}
                    statusBadge={statusBadge}
                    onDeleteClick={handleDeleteClick}
                    onDeleteConfirm={handleDeleteConfirm}
                    isDeleting={deletingId === interview.id}
                    isConfirming={confirmingId === interview.id}
                  />
                ))}
              </div>
            </div>
          )}

          {pastInterviews.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#55433d]/50 mb-3">Past</p>
              <div className="space-y-3">
                {pastInterviews.map((interview) => (
                  <InterviewCard
                    key={interview.id}
                    interview={interview}
                    applicationId={applicationId}
                    formatDate={formatDate}
                    formatTime={formatTime}
                    statusBadge={statusBadge}
                    onDeleteClick={handleDeleteClick}
                    onDeleteConfirm={handleDeleteConfirm}
                    isDeleting={deletingId === interview.id}
                    isConfirming={confirmingId === interview.id}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

interface InterviewCardProps {
  interview: Interview;
  applicationId: string;
  formatDate: (date: string) => string;
  formatTime: (date: string) => string;
  statusBadge: (status: string) => string;
  onDeleteClick: (id: string) => void;
  onDeleteConfirm: (id: string) => void;
  isDeleting: boolean;
  isConfirming: boolean;
}

function InterviewCard({
  interview,
  applicationId,
  formatDate,
  formatTime,
  statusBadge,
  onDeleteClick,
  onDeleteConfirm,
  isDeleting,
  isConfirming,
}: InterviewCardProps) {
  return (
    <div className="p-4 rounded-xl bg-[#f4f3f1] hover:bg-[#e9e8e6] transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-semibold text-[#1a1c1b] text-sm">{interview.type}</span>
            <span className="text-xs text-[#55433d]/60">Round {interview.round}</span>
            <span className={`db-status-badge text-[10px] ${statusBadge(interview.status)}`}>
              {interview.status}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-[#55433d]/70">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3 shrink-0" />
              {formatDate(interview.scheduled_at)} at {formatTime(interview.scheduled_at)}
              {interview.duration_minutes && ` · ${interview.duration_minutes} min`}
            </span>
            {interview.meeting_url && (
              <a
                href={interview.meeting_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[#99462a] hover:underline underline-offset-2 font-medium"
              >
                <Video className="h-3 w-3 shrink-0" />
                Join
              </a>
            )}
            {interview.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3 shrink-0" />
                {interview.location}
              </span>
            )}
            {interview.interviewer_names && interview.interviewer_names.length > 0 && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3 shrink-0" />
                {interview.interviewer_names.join(", ")}
              </span>
            )}
          </div>

          {interview.preparation_notes && (
            <div className="mt-2.5 pt-2.5 border-t border-[#dbc1b9]/18">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#55433d]/50 mb-1">Prep Notes</p>
              <p className="text-xs text-[#55433d]/70 whitespace-pre-wrap leading-relaxed">
                {interview.preparation_notes}
              </p>
            </div>
          )}

          {interview.post_interview_notes && (
            <div className="mt-2.5 pt-2.5 border-t border-[#dbc1b9]/18">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#55433d]/50 mb-1">Post-Interview Notes</p>
              <p className="text-xs text-[#55433d]/70 whitespace-pre-wrap leading-relaxed">
                {interview.post_interview_notes}
              </p>
            </div>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Interview options"
              className="h-8 w-8 flex items-center justify-center rounded-lg text-[#55433d]/50 hover:text-[#99462a] hover:bg-[#99462a]/8 transition-colors shrink-0"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <InterviewForm applicationId={applicationId} interview={interview} />
            {isConfirming ? (
              <DropdownMenuItem
                onClick={() => onDeleteConfirm(interview.id)}
                className="text-[#ba1a1a] font-semibold"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Confirm delete
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() => onDeleteClick(interview.id)}
                disabled={isDeleting}
                className="text-[#ba1a1a]"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {isDeleting ? "Deleting..." : "Delete"}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
