"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Clock, CheckCircle2, Trash2, MoreVertical } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  Button,
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

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const handleComplete = async (id: string) => {
    setLoadingId(id);
    const supabase = createClient();

    const { error } = await supabase
      .from("reminders")
      .update({
        is_completed: true,
        completed_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      toast.error("Failed to complete reminder");
    } else {
      toast.success("Reminder completed");
      router.refresh();
    }

    setLoadingId(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this reminder?")) return;

    setLoadingId(id);
    const supabase = createClient();

    const { error } = await supabase.from("reminders").delete().eq("id", id);

    if (error) {
      toast.error("Failed to delete reminder");
    } else {
      toast.success("Reminder deleted");
      router.refresh();
    }

    setLoadingId(null);
  };

  const getReminderTypeColor = (type: string) => {
    switch (type) {
      case "Follow Up":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
      case "Interview":
        return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300";
      case "Deadline":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  return (
    <div className="space-y-3">
      {reminders.map((reminder) => (
        <div
          key={reminder.id}
          className={`flex items-start gap-3 p-4 rounded-lg border ${
            showCompleted ? "opacity-60" : "hover:bg-muted/50"
          } transition-colors`}
        >
          {!showCompleted && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 flex-shrink-0 mt-0.5"
              onClick={() => handleComplete(reminder.id)}
              disabled={loadingId === reminder.id}
              title="Mark as complete"
            >
              <CheckCircle2 className="h-5 w-5 text-muted-foreground hover:text-primary" />
            </Button>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className={`font-medium ${showCompleted ? "line-through" : ""}`}>
                  {reminder.title}
                </p>
                {reminder.job_applications && (
                  <Link
                    href={`/applications/${reminder.application_id}`}
                    className="text-sm text-primary hover:underline"
                  >
                    {reminder.job_applications.company} - {reminder.job_applications.position}
                  </Link>
                )}
                {reminder.description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {reminder.description}
                  </p>
                )}
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => handleDelete(reminder.id)}
                    disabled={loadingId === reminder.id}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex items-center gap-3 mt-2">
              <span className={`text-xs px-2 py-0.5 rounded ${getReminderTypeColor(reminder.type)}`}>
                {reminder.type}
              </span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDate(reminder.remind_at)} at {formatTime(reminder.remind_at)}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
