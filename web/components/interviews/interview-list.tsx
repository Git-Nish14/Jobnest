"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Clock, Video, MapPin, User, MoreVertical, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Scheduled":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
      case "Completed":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
      case "Cancelled":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
      case "Rescheduled":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this interview?")) return;

    setDeletingId(id);
    const supabase = createClient();

    const { error } = await supabase.from("interviews").delete().eq("id", id);

    if (error) {
      toast.error("Failed to delete interview");
    } else {
      toast.success("Interview deleted");
      router.refresh();
    }

    setDeletingId(null);
  };

  const upcomingInterviews = interviews.filter(
    (i) => new Date(i.scheduled_at) >= new Date() && i.status === "Scheduled"
  );
  const pastInterviews = interviews.filter(
    (i) => new Date(i.scheduled_at) < new Date() || i.status !== "Scheduled"
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Interviews
        </CardTitle>
        <InterviewForm applicationId={applicationId} />
      </CardHeader>
      <CardContent>
        {interviews.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No interviews scheduled yet
          </p>
        ) : (
          <div className="space-y-6">
            {/* Upcoming Interviews */}
            {upcomingInterviews.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">Upcoming</h4>
                {upcomingInterviews.map((interview) => (
                  <InterviewCard
                    key={interview.id}
                    interview={interview}
                    applicationId={applicationId}
                    formatDate={formatDate}
                    formatTime={formatTime}
                    getStatusColor={getStatusColor}
                    onDelete={handleDelete}
                    isDeleting={deletingId === interview.id}
                  />
                ))}
              </div>
            )}

            {/* Past Interviews */}
            {pastInterviews.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">Past</h4>
                {pastInterviews.map((interview) => (
                  <InterviewCard
                    key={interview.id}
                    interview={interview}
                    applicationId={applicationId}
                    formatDate={formatDate}
                    formatTime={formatTime}
                    getStatusColor={getStatusColor}
                    onDelete={handleDelete}
                    isDeleting={deletingId === interview.id}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface InterviewCardProps {
  interview: Interview;
  applicationId: string;
  formatDate: (date: string) => string;
  formatTime: (date: string) => string;
  getStatusColor: (status: string) => string;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}

function InterviewCard({
  interview,
  applicationId,
  formatDate,
  formatTime,
  getStatusColor,
  onDelete,
  isDeleting,
}: InterviewCardProps) {
  return (
    <div className="p-4 rounded-lg border bg-muted/30">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{interview.type}</span>
            <span className="text-xs text-muted-foreground">Round {interview.round}</span>
            <span className={`text-xs px-2 py-0.5 rounded ${getStatusColor(interview.status)}`}>
              {interview.status}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDate(interview.scheduled_at)} at {formatTime(interview.scheduled_at)}
            </span>
            {interview.duration_minutes && (
              <span>({interview.duration_minutes} min)</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
            {interview.meeting_url && (
              <a
                href={interview.meeting_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary hover:underline"
              >
                <Video className="h-3 w-3" />
                Join Meeting
              </a>
            )}
            {interview.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {interview.location}
              </span>
            )}
            {interview.interviewer_names && interview.interviewer_names.length > 0 && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {interview.interviewer_names.join(", ")}
              </span>
            )}
          </div>

          {interview.preparation_notes && (
            <div className="mt-3 text-sm">
              <p className="font-medium text-xs text-muted-foreground mb-1">Prep Notes:</p>
              <p className="text-muted-foreground whitespace-pre-wrap">
                {interview.preparation_notes}
              </p>
            </div>
          )}

          {interview.post_interview_notes && (
            <div className="mt-3 text-sm">
              <p className="font-medium text-xs text-muted-foreground mb-1">Post-Interview Notes:</p>
              <p className="text-muted-foreground whitespace-pre-wrap">
                {interview.post_interview_notes}
              </p>
            </div>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <InterviewForm applicationId={applicationId} interview={interview} />
            <DropdownMenuItem
              onClick={() => onDelete(interview.id)}
              disabled={isDeleting}
              className="text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
